import asyncio
import threading

from flask import Flask, render_template, redirect, url_for, current_app
from loguru import logger
from sqlalchemy.util import await_only

from module.ai_module.mcp_client import MCPClient
from module.database.mysql_db import init_mysql
from module.database.redis_db import init_redis
from api import register_blueprints
from module.log_options import init_log
from module.repository.repository import LocalKnowledgeBase


def create_app():
    app = Flask(__name__)
    # 初始化连接（Flask 启动时创建一次）
    app.db = init_mysql()
    app.redis = init_redis(app)
    app.kb = LocalKnowledgeBase()
    app.client = MCPClient()

    # ✅ 创建一个持久异步循环，不关闭
    app.loop = asyncio.new_event_loop()
    threading.Thread(target=lambda: app.loop.run_forever(), daemon=True).start()

    # ✅ 通过线程安全方式启动 MCP 连接，不再关闭 loop
    asyncio.run_coroutine_threadsafe(app.client.connect_to_servers(), app.loop)

    register_blueprints(app)
    init_log()
    return app

app = create_app()




@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/chat/<sessid>', methods=['GET'])
def index_son(sessid):
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True)