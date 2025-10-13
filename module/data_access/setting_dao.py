import json
from flask import current_app


def change_system_dao(sessid,system):
    db = current_app.db

    sql = "UPDATE chat_menu SET system = %s WHERE session_id = %s"
    db.execute(sql, (system,sessid,))

    return True




def get_task_setting_dao(sessid):
    db = current_app.db

    sql = "UPDATE chat_menu SET system = %s WHERE session_id = %s"
    db.execute(sql, (system,sessid,))

    return True

