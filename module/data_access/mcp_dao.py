import json
import asyncio
from flask import current_app

def get_mcp_tools_dao() -> dict:
    """
    获取已加载的MCP工具信息
    """
    mcp = current_app.client
    
    return mcp.get_loaded_tools_info()

def get_mcp_config_dao() -> dict:
    """
    获取MCP配置信息
    """
    with open('./module/mcp_tools/mcp_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    return config.get("mcpServers", {})

def update_mcp_server_status_dao(server_id: str, enabled: bool) -> bool:
    """
    更新MCP服务器的启用状态
    """
    try:
        # 读取配置
        with open('./module/mcp_tools/mcp_config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 更新状态
        if server_id in config["mcpServers"]:
            config["mcpServers"][server_id]["enabled"] = enabled
            
            # 写入配置
            with open('./module/mcp_tools/mcp_config.json', 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            return True
        return False
    except Exception as e:
        print(f"更新配置失败: {e}")
        return False

def reload_mcp_servers_dao() -> bool:
    """
    重新加载所有MCP服务器（重启应用以生效）
    """
    # 由于MCP连接在应用启动时建立，需要重启应用才能重新加载
    # 这里只是更新了配置文件，提示用户重启
    return True

def add_mcp_server_dao(server_data: dict) -> tuple[bool, str]:
    """
    添加新的MCP服务器
    返回：(成功/失败, 消息)
    """
    try:
        # 读取配置
        with open('./module/mcp_tools/mcp_config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 验证输入的JSON格式
        if not isinstance(server_data, dict) or len(server_data) != 1:
            return False, "JSON格式错误：应该是一个包含单个服务器配置的对象"
        
        server_id = list(server_data.keys())[0]
        server_config = server_data[server_id]
        
        # 验证必要字段
        if "command" not in server_config or "args" not in server_config:
            return False, "缺少必要字段：command 和 args 是必需的"
        
        # 检查是否已存在
        if server_id in config["mcpServers"]:
            return False, f"服务器 {server_id} 已存在"
        
        # 添加enabled字段（默认为false）
        if "enabled" not in server_config:
            server_config["enabled"] = False
        
        # 添加到配置
        config["mcpServers"][server_id] = server_config
        
        # 写入配置
        with open('./module/mcp_tools/mcp_config.json', 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True, f"服务器 {server_id} 添加成功"
    except json.JSONDecodeError:
        return False, "JSON解析错误"
    except Exception as e:
        print(f"添加服务器失败: {e}")
        return False, f"添加失败: {str(e)}"

def delete_mcp_server_dao(server_id: str) -> tuple[bool, str]:
    """
    删除指定的MCP服务器
    返回：(成功/失败, 消息)
    """
    try:
        # 读取配置
        with open('./module/mcp_tools/mcp_config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 检查服务器是否存在
        if server_id not in config["mcpServers"]:
            return False, f"服务器 {server_id} 不存在"
        
        # 删除服务器
        del config["mcpServers"][server_id]
        
        # 写入配置
        with open('./module/mcp_tools/mcp_config.json', 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True, f"服务器 {server_id} 删除成功"
    except Exception as e:
        print(f"删除服务器失败: {e}")
        return False, f"删除失败: {str(e)}"
