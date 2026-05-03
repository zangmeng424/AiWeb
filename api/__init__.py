from .skill_bp import skill_bp
from .chat_bp import chat_bp
from .task_bp import task_bp
from .setting_bp import setting_bp
from .knowledge_bp import knowledge_bp
from .terminal_bp import terminal_bp
from .mcp_dp import mcp_bp

def register_blueprints(app):
    """注册所有蓝图"""
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(task_bp, url_prefix='/api/task')
    app.register_blueprint(setting_bp, url_prefix='/api/setting')
    app.register_blueprint(knowledge_bp, url_prefix='/api/knowledge')
    app.register_blueprint(terminal_bp, url_prefix='/terminal')
    app.register_blueprint(mcp_bp, url_prefix='/api/mcp')
    app.register_blueprint(skill_bp, url_prefix='/api/skill')

