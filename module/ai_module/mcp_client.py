import io
import json
import configparser
from contextlib import redirect_stdout
import asyncio
import json
import os
import sys
from typing import Optional
from contextlib import AsyncExitStack
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import aiofiles
from loguru import logger

class MCPClient:
    def __init__(self) -> None:
        self.sessions = []
        self.all_tools = []
        self.service_tools = {}
        self.tools_response = None
        self.exit_stack = AsyncExitStack()

    async def connect_to_servers(self):
        self.sessions = []
        self.service_tools = {}  # ✅ 初始化

        async with aiofiles.open('./module/mcp_tools/mcp_config.json', 'r', encoding='utf-8') as f:
            content = await f.read()
            mcp_config = json.loads(content)

        for name, value in mcp_config["mcpServers"].items():
            server_params = StdioServerParameters(command=value["command"], args=value["args"], env=None)
            stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
            stdio, write = stdio_transport
            session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))
            await session.initialize()
            response = await session.list_tools()
            tools = [tool.name for tool in response.tools]
            print(f"✅ Connected to {name} with tools: {tools}")

            self.service_tools[name] = {}
            for tool in response.tools:
                schema = tool.inputSchema or {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
                self.service_tools[name][tool.name] = {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": schema
                }

            self.sessions.append(session)

        self.all_tools = []
        self.tools_response = None
        for session in self.sessions:
            self.tools_response = await session.list_tools()
            for tool in self.tools_response.tools:
                self.all_tools.append({
                    "session": session,
                    "tool": tool
                })

    def get_loaded_tools_info(self) -> dict:
        # 返回当前加载的 MCP 工具信息（按 service 分类）
        if not self.service_tools:
            print("当前没有加载任何工具")
            return {}

        return self.service_tools

    async def get_tools(self) -> list[dict]:
        tools = []
        if not self.all_tools:
            print("当前没有加载任何工具")
            return tools

        # 遍历所有 service 的工具
        for item in self.all_tools:
            tool = item["tool"]
            tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": tool.inputSchema or {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            })

        return tools

    async def get_tool_return(self,tool_name: str,tool_args: dict) -> str:
        #获取工具返回
        matched = next((item for item in self.all_tools if item["tool"].name == tool_name), None)
        if matched is None:
            raise ValueError(f"Tool {tool_name} not found in any server")

        session = matched["session"]
        result = await session.call_tool(tool_name, tool_args)

        logger.info({"call": tool_name, "result": result})
        logger.info(f"Calling tool {tool_name} with args {tool_args} result {result.content[0].text}")

        return result.content[0].text

    async def cleanup(self) -> None:
        await self.exit_stack.aclose()
