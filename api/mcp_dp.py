import asyncio
from flask import Blueprint, jsonify, current_app, request, Response
from module.data_access.mcp_dao import *
from loguru import logger

mcp_bp = Blueprint('mcp_bp', __name__)


@mcp_bp.route('', methods=['GET'])
def get_mcp_tools():
    """
    获取已加载的MCP工具信息
    """
    rt_d = {
        "code": 1
    }
    try:
        rt_d["data"] = get_mcp_tools_dao()
    except Exception:
        logger.exception(f'MCP工具获取失败')
        rt_d["msg"] = "MCP工具获取失败"
        rt_d["code"] = 0
    return jsonify(rt_d)

@mcp_bp.route('/config', methods=['GET'])
def get_mcp_config():
    """
    获取MCP配置信息
    """
    rt_d = {
        "code": 1
    }
    try:
        config = get_mcp_config_dao()
        # 获取已加载的工具信息
        loaded_tools = get_mcp_tools_dao()
        
        # 组合信息
        servers = []
        for server_id, server_config in config.items():
            servers.append({
                "server_id": server_id,
                "command": server_config.get("command"),
                "args": server_config.get("args"),
                "enabled": server_config.get("enabled", True),
                "is_loaded": server_id in loaded_tools
            })
        
        rt_d["data"] = servers
    except Exception:
        logger.exception(f'MCP配置获取失败')
        rt_d["msg"] = "MCP配置获取失败"
        rt_d["code"] = 0
    return jsonify(rt_d)

@mcp_bp.route('/toggle/<server_id>', methods=['POST'])
def toggle_mcp_server(server_id):
    """
    切换MCP服务器的启用状态
    """
    rt_d = {
        "code": 1
    }
    try:
        # 获取当前状态
        config = get_mcp_config_dao()
        if server_id not in config:
            rt_d["code"] = 0
            rt_d["msg"] = "服务器不存在"
            return jsonify(rt_d)
        
        current_status = config[server_id].get("enabled", True)
        new_status = not current_status
        
        # 更新状态
        if update_mcp_server_status_dao(server_id, new_status):
            rt_d["msg"] = f"服务器 {server_id} 已{'启用' if new_status else '禁用'}"
        else:
            rt_d["code"] = 0
            rt_d["msg"] = "更新失败"
    except Exception:
        logger.exception(f'切换MCP服务器状态失败')
        rt_d["msg"] = "切换失败"
        rt_d["code"] = 0
    return jsonify(rt_d)

@mcp_bp.route('/reload', methods=['POST'])
def reload_mcp_servers():
    """
    重新加载所有MCP服务器
    """
    rt_d = {
        "code": 1
    }
    try:
        mcp = current_app.client
        loop = current_app.loop
        
        # 在异步循环中重新连接
        future = asyncio.run_coroutine_threadsafe(mcp.connect_to_servers(), loop)
        future.result(timeout=60)  # 60秒超时
        
        rt_d["msg"] = "MCP服务器重新加载成功"
    except Exception as e:
        logger.exception(f'重新加载MCP服务器失败')
        rt_d["msg"] = f"重新加载失败: {str(e)}"
        rt_d["code"] = 0
    return jsonify(rt_d)

@mcp_bp.route('/add', methods=['POST'])
def add_mcp_server():
    """
    添加新的MCP服务器
    """
    rt_d = {
        "code": 1
    }
    try:
        data = request.get_json()
        if not data or 'server_data' not in data:
            rt_d["code"] = 0
            rt_d["msg"] = "缺少server_data参数"
            return jsonify(rt_d)
        
        success, message = add_mcp_server_dao(data['server_data'])
        
        if success:
            rt_d["msg"] = message
        else:
            rt_d["code"] = 0
            rt_d["msg"] = message
    except Exception as e:
        logger.exception(f'添加MCP服务器失败')
        rt_d["msg"] = f"添加失败: {str(e)}"
        rt_d["code"] = 0
    return jsonify(rt_d)

@mcp_bp.route('/delete/<server_id>', methods=['DELETE'])
def delete_mcp_server(server_id):
    """
    删除指定的MCP服务器
    """
    rt_d = {
        "code": 1
    }
    try:
        success, message = delete_mcp_server_dao(server_id)
        
        if success:
            rt_d["msg"] = message
        else:
            rt_d["code"] = 0
            rt_d["msg"] = message
    except Exception as e:
        logger.exception(f'删除MCP服务器失败')
        rt_d["msg"] = f"删除失败: {str(e)}"
        rt_d["code"] = 0
    return jsonify(rt_d)






