import json
from flask import current_app


def list_dao() -> json:
    db = current_app.db
    sql = "SELECT id, session_id, title FROM chat_menu WHERE status = '1'"
    result = db.query(sql)
    return result


def del_task_dao(session_id:str) -> bool:
    db = current_app.db
    sql = "UPDATE chat_menu SET status = %s WHERE session_id = %s"
    db.execute(sql,(0,session_id,))
    return True


