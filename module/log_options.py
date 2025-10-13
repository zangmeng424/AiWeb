import os
from loguru import logger


def init_log() -> None:
    # 日志配置
    # 创建日志目录
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    # 当前日志路径：固定 app.log
    log_path = os.path.join(log_dir, "app.log")
    # 添加一个新 handler：每天轮转一次，保留30天，编码为utf-8
    logger.add(
        log_path,
        rotation="1 day",
        retention="30 days",
        encoding="utf-8",
        format="[<green>{time:YYYY-MM-DD HH:mm:ss}</green>] <level>{level}</level> : <level>{message}</level>",
        enqueue=True,
        backtrace=True,
        diagnose=True,
        # 自定义轮转动作
        filter=lambda record: record["level"].no >= 20,  # 不过滤任何日志
        compression=None,
    )


