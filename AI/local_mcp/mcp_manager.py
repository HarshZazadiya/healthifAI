import socket
from langchain_mcp_adapters.client import MultiServerMCPClient

def get_mcp_host():
    try:
        # Check if the docker container hostname 'mcp' resolves
        socket.gethostbyname("mcp")
        return "mcp"
    except socket.gaierror:
        # Fall back to localhost if running on host machine
        return "localhost"

mcp_host = get_mcp_host()

client = MultiServerMCPClient(
    {
        "file_handling": {
            "transport": "sse",
            "url": f"http://{mcp_host}:8001/sse"
        }
    }
)

mcp_tools_cache = None

async def get_mcp_tools():
    global mcp_tools_cache
    if mcp_tools_cache is None:
        print(f"🔌 Connecting to MCP server at http://{mcp_host}:8001/sse and loading tools...")
        mcp_tools_cache = await client.get_tools()
        print(f"✅ Connected! Tools: {[t.name for t in mcp_tools_cache]}")
        print(f"total tools: {len(mcp_tools_cache)}")
    return mcp_tools_cache
