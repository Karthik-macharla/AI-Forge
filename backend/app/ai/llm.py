"""
LiteLLM client singletons. Import from here — never instantiate elsewhere.

All AI calls route through the Amzur LiteLLM proxy (AD-01).
Usage tracking via user email is required on every call.
"""
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openai import OpenAI

from app.core.config import settings

# LangChain LLM — use in LCEL chains
llm = ChatOpenAI(
    model=settings.LLM_MODEL,
    base_url=f"{settings.LITELLM_PROXY_URL}/v1",
    api_key=settings.LITELLM_API_KEY,
    timeout=30,
    max_retries=2,
)

# OpenAI SDK client — use for direct calls (image gen, embeddings outside LangChain)
openai_client = OpenAI(
    api_key=settings.LITELLM_API_KEY,
    base_url=f"{settings.LITELLM_PROXY_URL}/v1",
)

# Embeddings — for ChromaDB / RAG
embeddings = OpenAIEmbeddings(
    model=settings.LITELLM_EMBEDDING_MODEL,
    base_url=f"{settings.LITELLM_PROXY_URL}/v1",
    api_key=settings.LITELLM_API_KEY,
)
