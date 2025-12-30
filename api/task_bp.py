from flask import Blueprint, jsonify, current_app, request
from loguru import logger
from module.data_access.task_dao import *

task_bp = Blueprint('task_bp', __name__)

@task_bp.route('/list', methods=['GET'])
def list():
    """获取AI对话列表"""
    rt_d = {
        "code": 1
    }
    task_id = int(request.args.get('last_task_id'))
    try:
        data = list_dao(task_id)
        rt_d["data"] = data
    except Exception:
        logger.exception(f'AI对话列表获取失败')
        rt_d["msg"] = "AI对话列表获取失败"
        rt_d["code"] = 0

    return jsonify(rt_d)


@task_bp.route('/del', methods=['GET'])
def del_task():
    """删除AI对话列表"""
    rt_d = {
        "code": 1
    }
    session_id = request.args.get('session_id')
    try:
        del_task_dao(session_id)
    except Exception:
        logger.exception(f'AI对话删除失败')
        rt_d["msg"] = "AI对话删除失败"
        rt_d["code"] = 0

    return jsonify(rt_d)


@task_bp.route('/add', methods=['GET'])
def add():
    rt_d = {"code": 1}
    session_id = request.args.get('session_id')
    try:
        add_dao(session_id)
    except Exception:
        logger.exception(f'AI对话添加失败')
        rt_d["msg"] = "AI对话添加失败"
        rt_d["code"] = 0
    return rt_d

