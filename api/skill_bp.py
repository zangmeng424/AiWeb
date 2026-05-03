from flask import Blueprint, jsonify, request
from module.data_access.skill_dao import *
from loguru import logger

skill_bp = Blueprint('skill_bp', __name__)

@skill_bp.route('/', methods=['GET'])
def get_all_skills():
    """获取所有已加载的技能信息"""
    try:
        skills = get_all_skills_dao()
        return jsonify({
            "code": 1,
            "msg": "Skills 读取成功",
            "data": skills
        })
    except Exception as e:
        logger.error(f"Skills 读取失败: {str(e)}")
        return jsonify({
            "code": 0,
            "msg": f"Skills 读取失败: {str(e)}",
            "data": None
        })

@skill_bp.route('/get/<skill_name>', methods=['GET'])
def get_skill(skill_name):
    """获取指定技能的详细信息"""
    try:
        skill = get_skill_by_name_dao(skill_name)
        if skill:
            return jsonify({
                "code": 1,
                "msg": f"Skill '{skill_name}' retrieved successfully",
                "data": skill
            })
        else:
            return jsonify({
                "code": 0,
                "msg": f"Skill '{skill_name}' not found",
                "data": None
            })
    except Exception as e:
        logger.error(f"Error getting skill {skill_name}: {str(e)}")
        return jsonify({
            "code": 0,
            "msg": f"Failed to get skill: {str(e)}",
            "data": None
        })

@skill_bp.route('/reload', methods=['GET'])
def reload_skills():
    """重新加载所有技能"""
    try:
        skills = reload_skills_dao()
        return jsonify({
            "code": 1,
            "msg": "Skills 重新加载成功",
            "data": skills
        })
    except Exception as e:
        logger.error(f"Skills 重新加载失败: {str(e)}")
        return jsonify({
            "code": 0,
            "msg": f"Skills 重新加载失败: {str(e)}",
            "data": None
        })


@skill_bp.route('/edit', methods=['POST'])
def edit_skill():
    """创建/修改skill"""
    try:
        data = request.get_json()

        if edit_skill_dao(data["skill_name"],data["skill_description"],data["skill_body"]):
            return jsonify({
                "code": 1,
                "msg": "Skills 更改成功",
            })
        else:
            return jsonify({
                "code": 0,
                "msg": f"Skills 更改失败",
            })
    except Exception as e:
        logger.error(f"Skills 更改失败: {str(e)}")
        return jsonify({
            "code": 0,
            "msg": f"Skills 更改失败: {str(e)}",
        })

@skill_bp.route('/delete/<skill_name>', methods=['DELETE'])
def delete_skill(skill_name):
    """创建/修改skill"""
    try:
        if delete_skill_dao(skill_name):
            return jsonify({
                "code": 1,
                "msg": "Skills 删除成功",
            })
        else:
            return jsonify({
                "code": 0,
                "msg": f"Skills 删除失败",
            })
    except Exception as e:
        logger.error(f"Skills 删除失败: {str(e)}")
        return jsonify({
            "code": 0,
            "msg": f"Skills 删除失败: {str(e)}",
        })

