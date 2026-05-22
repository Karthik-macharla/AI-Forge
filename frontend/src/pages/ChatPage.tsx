import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InputBar, type InputBarHandle, type PendingAttachment } from "../components/chat/InputBar";
import { MessageList } from "../components/chat/MessageList";
import { ThreadSidebar } from "../components/chat/ThreadSidebar";
import { attachmentsApi, authApi, imageApi, videoApi, streamRag, messagesApi, streamChat, threadsApi } from "../lib/api";
import { queryNL2SQL } from "../lib/nl2sqlClient";
import { querySheetUrl } from "../lib/sheetsClient";
import { startResearchStream } from "../lib/researchClient";
import { useAuthStore } from "../store/auth";
import type { ChatMessage } from "../types/chat";

export default function ChatPage() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputBarRef = useRef<InputBarHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // When we create a thread ourselves (during send/attach) we already have
  // optimistic messages in state — skip the server reload triggered by the
  // activeThreadId change to avoid wiping them.
  const skipNextLoadRef = useRef(false);
  // Controls auto-scroll target after messages change:
  //   'bottom'    — active streaming, scroll to very end (default)
  //   'lastUser'  — DB restore, scroll to last user bubble so it's visible
  const scrollBehaviorRef = useRef<'bottom' | 'lastUser'>('bottom');
  const lastUserMsgRef = useRef<HTMLDivElement | null>(null);

  // ── Server state: thread list ──────────────────────────────────────────
  const { data: threads = [], isLoading: isLoadingThreads } = useQuery({
    queryKey: ["threads"],
    queryFn: () => threadsApi.list().then((r) => r.data),
    enabled: !!user,
  });

  // ── Load messages when active thread changes ───────────────────────────
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    // Skip reload when we just created this thread in handleSend/handleAttach
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }

    // Fetch messages + thread attachments in parallel to restore full history
    Promise.all([
      messagesApi.list(activeThreadId),
      attachmentsApi.listByThread(activeThreadId),
    ]).then(([msgRes, attRes]) => {
      // Build map: attachment-role message_id → list of attachments
      const attsByMsgId: Record<string, Array<{ id: string; name: string; previewUrl?: string; mimeType: string }>> = {};
      for (const att of attRes.data) {
        if (!attsByMsgId[att.message_id]) attsByMsgId[att.message_id] = [];
        attsByMsgId[att.message_id].push({
          id: att.id,
          name: att.file_name,
          // Restore inline preview for images; other types use FileCard which builds the URL from `id`
          previewUrl: att.mime_type.startsWith("image/") ? `/api/attachments/${att.id}/file` : undefined,
          mimeType: att.mime_type,
        });
      }

      // Walk all raw messages (including role:"attachment" placeholders) to
      // re-attach files to the user message that followed them.
      const rebuilt: ChatMessage[] = [];
      let pendingAtts: Array<{ id: string; name: string; previewUrl?: string; mimeType: string }> = [];
      let lastAttTs: Date | null = null;

      for (const m of msgRes.data as Array<{ id: string; role: string; content: string; created_at: string }>) {
        if (m.role === "attachment") {
          // Accumulate attachments until the next user message
          pendingAtts.push(...(attsByMsgId[m.id] ?? []));
          lastAttTs = new Date(m.created_at);
        } else if (m.role === "user") {
          if (m.content?.trim() || pendingAtts.length > 0) {
            rebuilt.push({
              role: "user",
              content: m.content ?? "",
              timestamp: new Date(m.created_at),
              attachments: pendingAtts.length > 0 ? [...pendingAtts] : undefined,
            });
          }
          pendingAtts = [];
          lastAttTs = null;
        } else if (m.role === "assistant" && m.content?.trim()) {
          rebuilt.push({
            role: "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
          });
          pendingAtts = []; // clear any orphaned buffers
          lastAttTs = null;
        }
      }

      // Flush any trailing RAG-only uploads: attachment placeholder was saved to DB
      // but the ✅ assistant confirmation was only in local state — restore both.
      if (pendingAtts.length > 0) {
        const ts = lastAttTs ?? new Date();
        rebuilt.push({
          role: "user",
          content: "",
          timestamp: ts,
          attachments: [...pendingAtts],
        });
        const names = pendingAtts.map((a) => `**${a.name}**`).join(", ");
        rebuilt.push({
          role: "assistant",
          content: `✅ ${names} ${pendingAtts.length === 1 ? "has" : "have"} been uploaded and indexed for document search. You can now use **Search my docs** to query it.`,
          timestamp: new Date(ts.getTime() + 1),
        });
      }

      // Scroll to last user message on restore so it's visible, not buried
      // under a long AI response when we auto-scroll.
      scrollBehaviorRef.current = 'lastUser';
      setMessages(rebuilt);
    });
  }, [activeThreadId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollBehaviorRef.current === 'lastUser') {
      // DB restore: scroll the last user bubble to the top of the viewport so
      // the user sees their message + the start of the AI response below it.
      scrollBehaviorRef.current = 'bottom'; // reset for next interaction
      lastUserMsgRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── Sidebar actions ────────────────────────────────────────────────────
  function handleNewThread() {
    setActiveThreadId(null);
    setMessages([]);
  }

  async function handleDeleteThread(id: string) {
    await threadsApi.delete(id);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
    }
  }

  async function handleRenameThread(id: string, title: string) {
    await threadsApi.rename(id, title);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  }

  async function handleLogout() {
    await authApi.logout();
    setUser(null);
  }

  // ── Attach file ────────────────────────────────────────────────────────
  async function handleAttach(file: File) {
    const threadId = await ensureThread("New Chat");
    try {
      const res = await attachmentsApi.upload(threadId, file);
      const att = res.data;
      const isImage = file.type.startsWith("image/");
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: att.id,
          name: file.name,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        },
      ]);
      setUploadError(null);
    } catch (err: unknown) {
      console.error("Attachment upload failed", err);
      // Extract backend error message if available
      const detail = (err as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail;
      const msg = typeof detail === "object" && detail?.message
        ? detail.message
        : typeof detail === "string"
        ? detail
        : "Upload failed. Please check the file type and size.";
      setUploadError(msg);
    }
  }

  function handleRemoveAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // ── Upload document for RAG indexing ──────────────────────────────────
  async function handleRagUpload(file: File) {
    const threadId = await ensureThread("New Chat");
    try {
      await attachmentsApi.upload(threadId, file);
      // Show a confirmation in the chat so the user knows it was indexed
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ **${file.name}** has been uploaded and indexed for document search. You can now use **Search my docs** to query it.`,
          timestamp: new Date(),
        },
      ]);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail;
      const msg = typeof detail === "object" && detail?.message
        ? detail.message
        : typeof detail === "string"
        ? detail
        : "Upload failed. Please check the file type and size.";
      setUploadError(msg);
    }
  }

  // ── Shared helper: ensure a thread exists ─────────────────────────────
  async function ensureThread(title: string): Promise<string> {
    if (activeThreadId) return activeThreadId;
    const res = await threadsApi.create(title.length > 60 ? title.slice(0, 60) + "…" : title);
    const id = res.data.id;
    skipNextLoadRef.current = true;
    setActiveThreadId(id);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    return id;
  }

  // ── Image generation ───────────────────────────────────────────────────
  async function handleGenerateImage(prompt: string) {
    const threadId = await ensureThread(prompt);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, timestamp: new Date() },
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);
    try {
      const res = await imageApi.generate(threadId, prompt);
      const imgUrl = res.data.image_url;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") updated[updated.length - 1] = { ...last, content: `![Generated image](${imgUrl})` };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) updated[updated.length - 1] = { ...last, content: "Sorry, image generation failed. Please try again." };
        return updated;
      });
    } finally {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  // ── Video generation ───────────────────────────────────────────────────
  async function handleGenerateVideo(prompt: string) {
    const threadId = await ensureThread(prompt);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, timestamp: new Date() },
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);
    try {
      const res = await videoApi.generate(threadId, prompt);
      const vidUrl = res.data.video_url;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") updated[updated.length - 1] = { ...last, content: `![video:Generated video](${vidUrl})` };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) updated[updated.length - 1] = { ...last, content: "Sorry, video generation failed. Please try again." };
        return updated;
      });
    } finally {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  // ── RAG document search ────────────────────────────────────────────────
  async function handleRagQuery(question: string) {
    const threadId = await ensureThread(question);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date() },
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);
    try {
      await streamRag(question, threadId, (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") updated[updated.length - 1] = { ...last, content: last.content + token };
          return updated;
        });
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) updated[updated.length - 1] = { ...last, content: "Sorry, the document search failed. Please try again." };
        return updated;
      });
    } finally {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  // ── Database Q&A (NL2SQL inline in chat) ──────────────────────────────
  // Streams SQL + answer into the current thread as a regular chat message.
  // The generated SQL is embedded as a markdown code block so MessageList
  // renders it with syntax highlighting automatically.
  async function handleDbQuery(question: string) {
    const threadId = await ensureThread(question);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date() },
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);

    let generatedSQL = "";
    let answerText = "";
    let receivedAnyEvent = false;

    try {
      for await (const event of queryNL2SQL(question)) {
        receivedAnyEvent = true;
        if (event.type === "sql") {
          generatedSQL = event.sql;
          // Show the SQL block immediately as it arrives
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `**Generated SQL**\n\`\`\`sql\n${generatedSQL}\n\`\`\`\n\n`,
              };
            }
            return updated;
          });
        } else if (event.type === "token") {
          answerText += event.token;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `**Generated SQL**\n\`\`\`sql\n${generatedSQL}\n\`\`\`\n\n${answerText}`,
              };
            }
            return updated;
          });
        } else if (event.type === "error") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `> ⚠️ **Database query error:** ${event.message}`,
              };
            }
            return updated;
          });
          break;
        } else if (event.type === "done") {
          break;
        }
      }
      // Stream closed with no events — means backend exception was swallowed inside StreamingResponse
      if (!receivedAnyEvent) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "> ⚠️ **Database query error:** Could not process your question. Please try rephrasing.",
            };
          }
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, the database query failed. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      const assistantContent = generatedSQL
        ? `**Generated SQL**\n\`\`\`sql\n${generatedSQL}\n\`\`\`\n\n${answerText}`
        : answerText;
      if (assistantContent) {
        messagesApi.save(threadId, [
          { role: "user", content: question },
          { role: "assistant", content: assistantContent },
        ]).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  // ── Google Sheet Q&A (inline in chat) ────────────────────────────────────
  async function handleSheetsQuery(question: string, sheetUrl: string) {
    const threadId = await ensureThread(question);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date() },
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);

    let answerText = "";
    try {
      for await (const event of querySheetUrl(sheetUrl, question)) {
        if (event.type === "token") {
          answerText += event.token;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + event.token,
              };
            }
            return updated;
          });
        } else if (event.type === "error") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `> ⚠️ **Sheet query error:** ${event.message}`,
              };
            }
            return updated;
          });
          break;
        } else if (event.type === "done") {
          break;
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, the sheet query failed. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      if (answerText) {
        messagesApi.save(threadId, [
          { role: "user", content: question },
          { role: "assistant", content: answerText },
        ]).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  // ── Research Digest Agent (inline in chat) ───────────────────────────
  function handleResearchQuery(question: string) {
    ensureThread(question).then((threadId) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question, timestamp: new Date() },
        { role: "assistant", content: "", timestamp: new Date() },
      ]);
      setIsLoading(true);

      const statusLines: string[] = [];
      let digestText = "";
      let paperCount = 0;

      const es = startResearchStream(question, 10);

      function updateBubble(content: string) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content };
          }
          return updated;
        });
      }

      const eventTypes = ["status", "tool_call", "thinking", "paper_found", "digest_chunk", "done", "error"];

      eventTypes.forEach((evType) => {
        es.addEventListener(evType, (e: MessageEvent) => {
          try {
            const ev = JSON.parse((e as MessageEvent).data);

            if (evType === "status") {
              statusLines.push(`⚙️ ${ev.data}`);
              updateBubble(statusLines.join("  \n"));
            } else if (evType === "tool_call") {
              statusLines.push(`🔍 ${ev.data}`);
              updateBubble(statusLines.join("  \n"));
            } else if (evType === "thinking") {
              statusLines.push(`💭 ${ev.data}`);
              updateBubble(statusLines.join("  \n"));
            } else if (evType === "paper_found") {
              paperCount++;
              statusLines.push(`📄 Found paper #${paperCount}`);
              updateBubble(statusLines.join("  \n"));
            } else if (evType === "digest_chunk") {
              digestText += ev.data;
              updateBubble(statusLines.join("  \n") + "\n\n---\n\n" + digestText);
            } else if (evType === "done") {
              try {
                const digest = ev.metadata;
                const findings = (digest.key_findings as string[])
                  .map((f) => `- ${f}`)
                  .join("\n");
                const topPapers = (digest.important_papers as Array<{ title: string; arxiv_url: string; authors: string[]; published: string }>)
                  .slice(0, 3)
                  .map((p) => `- [${p.title}](${p.arxiv_url}) — ${p.authors.slice(0, 2).join(", ")} (${String(p.published).slice(0, 4)})`)
                  .join("\n");
                const finalContent =
                  `## Research Summary: ${digest.topic}\n\n` +
                  `**Confidence:** ${Math.round(digest.confidence_score * 100)}% · ${digest.papers_analyzed} papers analyzed\n\n` +
                  `### Key Findings\n${findings}\n\n` +
                  `### Summary\n${digest.final_summary}` +
                  (topPapers ? `\n\n### Top Papers\n${topPapers}` : "");
                updateBubble(finalContent);
                messagesApi.save(threadId, [
                  { role: "user", content: question },
                  { role: "assistant", content: finalContent },
                ]).catch(() => {});
              } catch {
                if (digestText) updateBubble(digestText);
              }
              es.close();
              setIsLoading(false);
              queryClient.invalidateQueries({ queryKey: ["threads"] });
            } else if (evType === "error") {
              updateBubble(`> ⚠️ **Research error:** ${ev.data}`);
              es.close();
              setIsLoading(false);
            }
          } catch {
            // ignore malformed event
          }
        });
      });

      es.onerror = () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "> ⚠️ Connection lost. Please try the research query again.",
            };
          }
          return updated;
        });
        es.close();
        setIsLoading(false);
      };
    });
  }

  // ── Send message (plain chat only) ────────────────────────────────────
  async function handleSend(message: string) {
    const threadId = await ensureThread(message);

    // Append user bubble (capture attachments before clearing)
    const snapshotAttachments = pendingAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      previewUrl: a.previewUrl,
    }));
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
        timestamp: new Date(),
        attachments: snapshotAttachments.length > 0 ? snapshotAttachments : undefined,
      },
    ]);

    setIsLoading(true);

    // ── Chat streaming branch ────────────────────────────────────────────
    // Append empty assistant bubble
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    const attachmentIds = snapshotAttachments.map((a) => a.id);
    setPendingAttachments([]);

    try {
      await streamChat(threadId, message, (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + token,
            };
          }
          return updated;
        });
      }, attachmentIds);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      // Refresh sidebar to bump updated_at ordering
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isLoadingThreads={isLoadingThreads}
        user={user}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
        onLogout={handleLogout}
      />

      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {activeThreadId ? (
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {threads.find((t) => t.id === activeThreadId)?.title ?? "Chat"}
                </p>
              ) : (
                <p className="text-sm font-semibold text-slate-800">New Chat</p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span className="text-xs text-slate-400">
                  Gemini 2.5 Flash · Online
                </span>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setActiveThreadId(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => navigate('/nl2sql')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              title="Database Q&amp;A (NL2SQL)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              DB Q&amp;A
            </button>
            <button
              onClick={() => navigate('/sheets')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              title="Sheets Agent — query Google Sheets &amp; CSV files"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M3 6h18M3 14h18M3 18h18" />
              </svg>
              Sheets
            </button>
            <button
              onClick={() => navigate('/game')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              title="Tic Tac Toe — AI Agent"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              Game
            </button>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <WelcomeScreen onSend={handleSend} />
            ) : (
              <MessageList
                messages={messages}
                isLoading={isLoading}
                onModifyImage={() => inputBarRef.current?.setMode("image")}
                lastUserMsgRef={lastUserMsgRef}
              />
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input */}
        <div className="shrink-0 bg-white border-t border-slate-100">
          <div className="max-w-3xl mx-auto px-4 py-3">
            {/* Upload error banner */}
            {uploadError && (
              <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span className="flex-1">Error: {uploadError}</span>
                <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <InputBar
              ref={inputBarRef}
              isLoading={isLoading}
              onSend={handleSend}
              onAttach={handleAttach}
              onAttachError={(msg) => setUploadError(msg)}
              onGenerateImage={handleGenerateImage}
              onGenerateVideo={handleGenerateVideo}
              onRagQuery={handleRagQuery}
              onRagUpload={handleRagUpload}
              onDbQuery={handleDbQuery}
              onSheetsQuery={handleSheetsQuery}
              onResearchQuery={handleResearchQuery}
              attachments={pendingAttachments}
              onRemoveAttachment={handleRemoveAttachment}
            />
            <p className="text-center text-[10px] text-slate-300 mt-2">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "💡", title: "Explain a concept", prompt: "Explain quantum computing in simple terms" },
  { icon: "✍️", title: "Help me write", prompt: "Write a professional email declining a meeting" },
  { icon: "🐍", title: "Write code", prompt: "Write a Python function to flatten a nested list" },
  { icon: "📋", title: "Summarize text", prompt: "What are the key principles of clean code?" },
];

function WelcomeScreen({ onSend }: { onSend: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mb-5">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">How can I help you today?</h2>
      <p className="text-sm text-slate-400 max-w-md">
        Ask me anything — I'm powered by Google Gemini and ready to assist.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSend(s.prompt)}
            className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all text-left group"
          >
            <span className="text-xl leading-none mt-0.5">{s.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                {s.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.prompt}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

