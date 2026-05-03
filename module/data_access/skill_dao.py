import os
import shutil
from loguru import logger
from flask import current_app
from typing import List, Dict, Optional

def get_all_skills_dao() -> List[Dict]:
    """获取所有已加载的技能信息"""
    skills = current_app.skill.skills
    return [{"name": skill["name"], "description": skill["description"], "body": skill.get("body", "")} for skill in skills]


def get_skill_by_name_dao(skill_name: str) -> Optional[Dict]:
    """根据技能名称获取技能详情"""
    skills = current_app.skill.skills
    for skill in skills:
        if skill["name"] == skill_name:
            return skill
    return None


def reload_skills_dao() -> List[Dict]:
    """重新加载所有技能"""
    current_app.skill.discover_skills()
    return get_all_skills_dao()


def edit_skill_dao(skill_name: str, skill_description: str, skill_body: str) -> bool:
    """更新或创建 skill.md 文件"""
    try:
        target_dir = os.path.join("module/skills", skill_name.replace(" ", "-"))
        target_file = os.path.join(target_dir, "skill.md")
        # 确保目录存在
        os.makedirs(target_dir, exist_ok=True)
        # 写入内容
        content=f"---\nname: {skill_name}\ndescription: {skill_description}\n---\n\n{skill_body}"
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except:
        return False


def delete_skill_dao(skill_name: str) -> bool:
    """删除指定目录及其所有内容"""
    path = f"module/skills/{skill_name.replace(' ', '-')}"
    if not os.path.exists(path):
        return False
    try:
        shutil.rmtree(path)
        logger.success(f"skill删除成功:{skill_name}")
        return True
    except Exception as e:
        logger.warning(f"skill删除失败:{skill_name}")
        return False
