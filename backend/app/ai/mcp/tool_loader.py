"""
MCP Tool Loader — Project 12.

Provides two helpers:

1. get_arxiv_langchain_tools(session) — converts the MCP session's tools
   into LangChain BaseTool objects so they can be passed directly to a
   LangChain agent or tool-calling chain.

2. call_mcp_tool(session, tool_name, arguments) — low-level helper that
   calls a named MCP tool and returns the raw JSON string from the first
   content item.  Used by the RunnableLambda pipeline steps in
   research_agent.py which need the raw dict/list data rather than a
   LangChain ToolMessage.
"""
import json

from mcp import ClientSession

from app.core.logging import logger


async def get_arxiv_langchain_tools(session: ClientSession) -> list:
    """Return MCP tools as LangChain BaseTool objects.

    Requires langchain-mcp-adapters to be installed.
    """
    from langchain_mcp_adapters.tools import load_mcp_tools  # deferred import

    return await load_mcp_tools(session)


async def call_mcp_tool(session: ClientSession, tool_name: str, arguments: dict):
    """Call an MCP tool by name and return the parsed JSON response.

    FastMCP may return a list result as *multiple* TextContent items (one per
    element) or as a single JSON-array string.  This function handles both:
      • single content item  → parse its text as JSON (may be a dict or list)
      • multiple content items → parse each as JSON and return them as a list

    Raises:
        ValueError: if the tool response content is missing or not valid JSON.
    """
    logger.debug("MCP tool call: %s(%s)", tool_name, arguments)
    result = await session.call_tool(tool_name, arguments)

    if not result.content:
        raise ValueError(f"MCP tool '{tool_name}' returned empty content")

    def _parse_one(text: str):
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.error("MCP tool '%s' non-JSON content: %s", tool_name, text[:200])
            raise ValueError(
                f"MCP tool '{tool_name}' returned invalid JSON: {text[:200]}"
            ) from exc

    if len(result.content) == 1:
        # Single item: may be a JSON object, array, or scalar
        return _parse_one(result.content[0].text)

    # Multiple items: FastMCP serialised a list as one TextContent per element
    return [_parse_one(item.text) for item in result.content]
