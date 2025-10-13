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
        yield """data: {"id":"8c169c73-b3d2-4f29-9291-89e59e4670c8","choices":[{"delta":{"content":"你","function_call":null,"refusal":null,"role":null,"tool_calls":null},"finish_reason":"stop","index":0,"logprobs":null}],"created":1759515813,"model":"deepseek-chat","object":"chat.completion.chunk","service_tier":null,"system_fingerprint":"fp_ffc7281d48_prod0820_fp8_kvcache","usage":{"completion_tokens":96,"prompt_tokens":8,"total_tokens":104,"completion_tokens_details":null,"prompt_tokens_details":{"audio_tokens":null,"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":8}}\n\n"""
        time.sleep(1)
        yield """data: {"id":"8c169c73-b3d2-4f29-9291-89e59e4670c8","choices":[{"delta":{"content":"好","function_call":null,"refusal":null,"role":null,"tool_calls":null},"finish_reason":"stop","index":0,"logprobs":null}],"created":1759515813,"model":"deepseek-chat","object":"chat.completion.chunk","service_tier":null,"system_fingerprint":"fp_ffc7281d48_prod0820_fp8_kvcache","usage":{"completion_tokens":96,"prompt_tokens":8,"total_tokens":104,"completion_tokens_details":null,"prompt_tokens_details":{"audio_tokens":null,"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":8}}\n\n"""
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

