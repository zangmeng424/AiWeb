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
    rt_d = {
        "code": 1,
    }
    if request.method == 'GET':
        session_id = request.args.get('session_id')
        try:
            rt_d["data"] = get_task_setting_dao(session_id)
        except Exception:
            logger.exception(f'获取对话设置失败')
            rt_d["msg"] = "获取对话设置失败"
            rt_d["code"] = 0

        return jsonify(rt_d)
    elif request.method == 'POST':
        data = request.get_json()
        try:
            change_task_setting_dao(data)
            rt_d["msg"] = "保存成功"
        except Exception:
            logger.exception(f'保存对话设置失败')
            rt_d["msg"] = "保存对话设置失败"
            rt_d["code"] = 0

        return jsonify(rt_d)

@setting_bp.route('/model', methods=['GET','POST'])
def model():
    rt_d = {
        "code": 1,
    }
    if request.method == 'GET':
        try:
            data=get_model_dao()
            rt_d["data"] = data
        except Exception:
            logger.exception(f'模型数据获取失败')
            rt_d["msg"] = "模型数据获取失败，请重新进入页面"
            rt_d["code"] = 0

        return jsonify(rt_d)
    elif request.method == 'POST':
        data = request.get_json()
        try:
            change_model_dao(data)
            rt_d["msg"] = "修改模型数据成功"
        except Exception:
            logger.exception(f'修改模型数据失败')
            rt_d["msg"] = "修改模型数据失败"
            rt_d["code"] = 0

        return jsonify(rt_d)


@setting_bp.route('/model/del', methods=['GET'])
def del_model():
    rt_d = {
        "code": 1,
    }
    try:
        model_uuid = request.args.get('model_uuid')
        del_model_dao(model_uuid)
        rt_d["msg"] = "模型删除成功"
    except Exception:
        logger.exception(f'模型删除失败')
        rt_d["msg"] = "模型删除失败"
        rt_d["code"] = 0

    return jsonify(rt_d)