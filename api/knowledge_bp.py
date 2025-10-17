from flask import Blueprint, jsonify, current_app, request
from loguru import logger
from module.data_access.knowledge_dao import *

knowledge_bp = Blueprint('knowledge_bp', __name__)


@knowledge_bp.route('', methods=['GET'])
def get_knowledge():
    rt_d = {
        "code": 1
    }
    try:
        rt_d["data"] = get_knowledge_dao()
    except Exception:
        logger.exception(f'知识库获取失败')
        rt_d["msg"] = "知识库获取失败"
        rt_d["code"] = 0
    return rt_d

@knowledge_bp.route('/add', methods=['GET'])
def add_knowledge():
    rt_d = {
        "code": 1
    }
    try:
        text = request.args.get('text')
        add_knowledge_dao(text)
        rt_d["msg"] = "知识库内容添加成功"
    except Exception:
        logger.exception(f'知识库内容添加失败')
        rt_d["msg"] = "知识库内容添加失败"
        rt_d["code"] = 0
    return rt_d

@knowledge_bp.route('/del', methods=['GET'])
def del_knowledge():
    rt_d = {
        "code": 1
    }
    try:
        text = request.args.get('text')
        del_knowledge_dao(text)
        rt_d["msg"] = "知识库内容删除成功"
    except Exception:
        logger.exception(f'知识库内容删除失败')
        rt_d["msg"] = "知识库内容删除失败"
        rt_d["code"] = 0
    return rt_d
