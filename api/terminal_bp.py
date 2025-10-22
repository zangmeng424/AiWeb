import json
from flask import  jsonify, Response, stream_with_context, render_template, Blueprint, request
from module.data_access.terminal_dao import *

terminal_bp = Blueprint('terminal_bp', __name__)

@terminal_bp.route('', methods=['GET'])
def terminal():
    return render_template('terminal.html')

@terminal_bp.route('/run', methods=['POST'])
def run_cmd():
    j = request.get_json() or {}
    cmd = j.get("cmd","")
    if not cmd:
        return jsonify({"ok": False, "msg": "empty command"}), 400
    # 调用具体实现方法
    threading.Thread(target=run_command_background_dao,args=(cmd,),daemon=True).start()
    return jsonify({"ok": True})

@terminal_bp.route('/history')
def history_api():
    return jsonify(get_history_dao())

@terminal_bp.route('/poll')
def poll_api():
    since = request.args.get("since", type=int, default=0)
    return jsonify(poll_messages_dao(since))

@terminal_bp.route('/stream')
def stream_api():
    def event_stream():
        while True:
            try:
                msg = messages_queue.get(timeout=0.5)
                yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
            except queue.Empty:
                yield ": heartbeat\n\n"
            except GeneratorExit:
                break
            except Exception:
                break
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")