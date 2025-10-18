import time

from flask import Blueprint, jsonify, current_app, request, Response
from module.data_access.chat_dao import *
from loguru import logger

chat_bp = Blueprint('chat_bp', __name__)


@chat_bp.route('', methods=['POST'])
def chat_with_bot():

    def generate():
        time.sleep(0.5)
        yield "event: start\ndata: {}\n\n"
        time.sleep(0.1)

        text = "# 标题\n这是**加粗**文本\n```python\nprint('hello')\n```"

        for char in text:
            # 构建数据字典
            data = {
                "id": "8c169c73-b3d2-4f29-9291-89e59e4670c8",
                "choices": [{
                    "delta": {
                        "content": char,
                        "function_call": None,
                        "refusal": None,
                        "role": None,
                        "tool_calls": None
                    },
                    "finish_reason": "stop",
                    "index": 0,
                    "logprobs": None
                }],
                "created": 1759515813,
                "model": "deepseek-chat",
                "object": "chat.completion.chunk",
                "service_tier": None,
                "system_fingerprint": "fp_ffc7281d48_prod0820_fp8_kvcache",
                "usage": {"completion_tokens": 96, "prompt_tokens": 8, "total_tokens": 104}
            }

            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(0.1)

        time.sleep(0.1)
        yield "event: finish\ndata: {}\n\n"

    return Response(generate(), mimetype="text/event-stream")



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

