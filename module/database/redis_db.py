from flask_redis import FlaskRedis
from config_dev import *
from flask import Flask

def init_redis(app: Flask) -> FlaskRedis:
    # redis数据库配置
    # 配置 Redis 连接 URL
    app.config['REDIS_URL'] = f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
    app.config['REDIS_SOCKET_TIMEOUT'] = 10  # 设置连接超时时间
    app.config['REDIS_CONNECTION_POOL'] = True  # 启用连接池
    # 初始化 Flask-Redis 扩展
    redis_client = FlaskRedis(app)
    return redis_client

