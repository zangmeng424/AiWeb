import asyncio
import json
import time

from flask import Blueprint, jsonify, current_app, request, Response
from module.data_access.chat_dao import *
from loguru import logger

chat_bp = Blueprint('chat_bp', __name__)


@chat_bp.route('', methods=['POST'])
def chat_with_bot():
    data = request.get_json()
    client = current_app.client
    skill = current_app.skill
    db = current_app.db
    loop = current_app.loop
    kb = current_app.kb
    redis = current_app.redis

    def generate(data):
        try:
            # 先发送start事件，确保SSE连接已建立
            yield "event: start\ndata: {}\n\n"
            time.sleep(0.5)
            
            response = chat_dao(session_id=data["session_id"], messages=data["data"], db=db, client=client,skill=skill,loop=loop,kb=kb,redis=redis,on_tools=data["on_tools"],on_knowledge=data["on_knowledge"],on_skill=data["on_skill"])
            
            if response:
                for chunk in response:
                    # 直接转成 JSON 字符串输出，保持和原始格式一致
                    yield f"data: {chunk.model_dump_json()}\n\n"

                time.sleep(0.1)
                yield "event: finish\ndata: {}\n\n"
            else:
                yield "event: error\ndata: {}\n\n"
        except Exception:
            logger.exception(f'AI对话失败')
            time.sleep(0.1)
            yield "event: error\ndata: {}\n\n"


    return Response(generate(data), mimetype="text/event-stream")



@chat_bp.route('/history', methods=['GET', 'POST'])
def history():
    if request.method == 'GET':
        rt_d = {
            "code": 1
        }
        session_id = request.args.get('session_id')
        if session_id:
            try:
                history_d = get_history_dao(session_id)
                if history_d:
                    rt_d = history_d
                    rt_d["code"] = 1
                else:
                    raise Exception("尝试查询空对话")
            except Exception:
                logger.exception(f'AI对话历史记载失败')
                rt_d["msg"] = "AI对话历史记载失败"
                rt_d["code"] = 0
        else:
            rt_d["msg"] = "session_id获取失败"
            rt_d["code"] = 0

        return jsonify(rt_d)

    elif request.method == 'POST':
        data = request.get_json()  # 获取 JSON 数据
        logger.info("保存对话记录： session_id:[{}] msg:[{}]...]".format(
            data['session_id'],
            data['metadata']['content'][:8].replace('\n', '')
        ))
        rt_d = {
            "code": 1,
        }
        try:
            update_history_dao(data)
        except Exception :
            logger.exception(f'AI对话历史保存失败')
            rt_d["msg"] = "保存失败"
            rt_d["code"] = 0

        return jsonify(rt_d)

@chat_bp.route('/tools', methods=['POST'])
def tools():
    rt_d = {"code": 1}
    try:
        data = request.get_json()
        # 提交异步任务
        future = asyncio.run_coroutine_threadsafe(
            tools_dao(data["tools_call_name"], data["tools_call_params"]),
            current_app.loop
        )
        tool_return = future.result()  # 阻塞等待返回结果
        rt_d["data"] = tool_return
    except Exception:
        logger.exception('工具调用失败')
        rt_d["code"] = 0
        rt_d["msg"] = "AI调用工具失败"

    return rt_d


@chat_bp.route('/rollback', methods=['POST'])
def rollback():
    """消息回退接口：删除指定的消息记录"""
    rt_d = {"code": 1, "msg": "消息回退成功"}
    try:
        data = request.get_json()
        session_id = data.get("session_id")
        chat_uuid = data.get("chat_uuid")
        
        if not session_id or not chat_uuid:
            rt_d["code"] = 0
            rt_d["msg"] = "参数不完整"
            return jsonify(rt_d)
        
        # 调用DAO层删除消息
        from module.data_access.chat_dao import rollback_dao
        result = rollback_dao(session_id, chat_uuid)
        
        if not result:
            rt_d["code"] = 0
            rt_d["msg"] = "消息回退失败"
    except Exception:
        logger.exception('消息回退失败')
        rt_d["code"] = 0
        rt_d["msg"] = "消息回退失败"
    
    return jsonify(rt_d)





