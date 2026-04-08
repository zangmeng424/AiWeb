import os
import json
import subprocess
import re
import glob

class Skills:
    def __init__(self, skills_directory: str = None) -> None:
        """
        初始化技能管理器
        :param skills_directory: 包含技能文件的目录（默认：module/skills）
        """
        self.skills_directory = skills_directory or "module/skills"
        self.skills = []
        if os.path.exists(self.skills_directory):
            self.discover_skills(self.skills_directory)

    def parse_skill(self, path: str) -> dict:
        """
        解析技能文件并提取元数据和内容
        :param path: 技能文件的路径
        :return: 包含技能信息的字典，如果解析失败则返回None
        """
        with open(path, "r", encoding='utf-8') as f:
            content = f.read()
        match = re.match(r"^---\n(.*?)\n---\n(.*)$", content, re.DOTALL)
        if not match:
            return None
        frontmatter, body = match.group(1), match.group(2).strip()
        name = re.search(r"name:\s*(.+)", frontmatter)
        desc = re.search(r"description:\s*(.+)", frontmatter)
        if not name or not desc:
            return None
        return {"name": name.group(1).strip(), "description": desc.group(1).strip(), "body": body}

    def discover_skills(self, directory: str = None) -> list:
        """
        从指定目录发现并加载所有技能
        :param directory: 要搜索技能的目录（如果为None则使用实例目录）
        :return: 发现的技能列表
        """
        if not directory:
            directory = self.skills_directory
        if not os.path.exists(directory):
            return []
        skills = []
        for path in glob.glob(os.path.join(directory, "**", "SKILL.md"), recursive=True):
            skill = self.parse_skill(path)
            if skill:
                skills.append(skill)
        self.skills = skills
        return skills

    def build_activate_tool(self) -> dict|list[dict]:
        """
        为AI函数调用构建activate_skill工具定义
        :return: 工具定义字典
        """
        if not self.skills:
            return []
        return {
            "type": "function",
            "function": {
                "name": "activate_skill",
                "description": "Activate a specialized skill",
                "parameters": {
                    "type": "object",
                    "properties": {"name": {"type": "string", "enum": [s["name"] for s in self.skills]}},
                    "required": ["name"]
                }
            }
        }

    def activate_skill(self, name: str) -> str:
        """
        按名称激活特定技能
        :param name: 要激活的技能名称
        :return: 包含激活标签的技能内容或错误消息
        """
        skill = next((s for s in self.skills if s["name"] == name), None)
        if not skill:
            return f"Error: Skill '{name}' not found"
        return f"<activated_skill name=\"{name}\">\n{skill['body']}\n</activated_skill>"


    def get_skill_description(self) -> str:
        """
        获取特定技能的名称描述列表
        :return: 技能描述，如果未找到则返回None
        """
        return "\n".join([f"- {s['name']}: {s['description']}" for s in self.skills]) if self.skills else None




