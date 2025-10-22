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
    db = current_app.db
    loop = current_app.loop
    kb = current_app.kb
    redis = current_app.redis

    def generate(data):
        try:
            response = chat_dao(session_id=data["session_id"], messages=data["data"], db=db, client=client, loop=loop,kb=kb,redis=redis,on_tools=data["on_tools"],on_knowledge=data["on_knowledge"])
            time.sleep(0.5)
            if response:
                yield "event: start\ndata: {}\n\n"
                for chunk in response:
                    # 直接转成 JSON 字符串输出，保持和原始格式一致
                    yield f"data: {chunk.model_dump_json()}\n\n"

                time.sleep(0.1)
                yield "event: finish\ndata: {}\n\n"
            else:
                yield "event: error\ndata: {}\n\n"
        except Exception:
            logger.exception(f'AI对话失败')
            time.sleep(1)
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
                rt_d = get_history_dao(session_id)
                rt_d["code"] = 1
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
        logger.info(f"保存对话记录：{data}")
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





