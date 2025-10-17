from .chat_bp import chat_bp
from .task_bp import task_bp
from .setting_bp import setting_bp
from .knowledge_bp import knowledge_bp
def register_blueprints(app):
    """注册所有蓝图"""
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(task_bp, url_prefix='/api/task')
    app.register_blueprint(setting_bp, url_prefix='/api/setting')
    app.register_blueprint(knowledge_bp, url_prefix='/api/knowledge')

