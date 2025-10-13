from flask import Flask, render_template, redirect, url_for
from loguru import logger
from module.database.mysql_db import init_mysql
from module.database.redis_db import init_redis
from api import register_blueprints
from module.log_options import init_log


def create_app():
    app = Flask(__name__)
    # 初始化数据库连接（Flask 启动时创建一次）
    app.db = init_mysql()
    app.redis = init_redis(app)
    # 注册蓝图
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