from flask import Blueprint, jsonify, current_app, request
from loguru import logger
from module.data_access.setting_dao import *

setting_bp = Blueprint('setting_bp', __name__)



@setting_bp.route('/system', methods=['POST'])
def change_system():
    data = request.get_json()  # 获取 JSON 数据
    logger.info(f"修改系统提示词：{data}")
    rt_d = {
        "code": 1,
    }
    if (data.get('system') and data.get('session_id')):
        try:
            change_system_dao(data.get('session_id'), data.get('system'))
        except Exception:
            logger.exception(f'修改系统提示词失败')
            rt_d["msg"] = "修改失败"
            rt_d["code"] = 0
    else:
        rt_d["code"] = 0
        rt_d["msg"] = "参数缺失"

    return jsonify(rt_d)


@setting_bp.route('/task', methods=['POST','GET'])
def task_setting():
    if request.method == 'GET':
        session_id = request.args.get('session_id')
        rt_d = {
            "code": 1,
        }
        try:
            get_task_setting_dao(session_id)
        except Exception:
            logger.exception(f'修改系统提示词失败')
            rt_d["msg"] = "修改失败"
            rt_d["code"] = 0

        return jsonify(rt_d)



