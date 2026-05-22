"""
MCP Client Factory — Project 12.

Provides an async context manager that spins up the arXiv MCP server
as a subprocess (stdio transport) and yields a ready ClientSession.

Usage:
    async with arxiv_mcp_session() as session:
        result = await session.call_tool("search_arxiv", {"query": "...", "max_results": 10})
"""
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.core.config import settings
from app.core.logging import logger


@asynccontextmanager
async def arxiv_mcp_session() -> AsyncIterator[ClientSession]:
    """Async context manager that yields an initialised MCP ClientSession.

    The arXiv MCP server is started as a subprocess via stdio transport.
    The session is fully initialised (tools list fetched) before yielding.
    """
    server_params = StdioServerParameters(
        command=sys.executable,          # same Python interpreter as the main process
        args=[settings.MCP_ARXIV_SERVER_SCRIPT],
        env=None,                        # inherit parent environment
    )

    logger.debug("Starting MCP arxiv-server subprocess: %s", settings.MCP_ARXIV_SERVER_SCRIPT)

    try:
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                logger.debug("MCP arxiv-server initialised successfully")
                yield session
    except Exception as exc:
        logger.error("MCP arxiv-server failed to start: %s", exc, exc_info=True)
        raise RuntimeError("MCP arxiv server failed to initialize") from exc
