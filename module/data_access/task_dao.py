import json
import time

from flask import current_app


def list_dao() -> dict:
    db = current_app.db
    sql = "SELECT id, session_id, title FROM chat_menu WHERE status = '1' ORDER BY create_at DESC"
    result = db.query(sql)
    return result


def del_task_dao(session_id:str) -> bool:
    db = current_app.db
    sql = "UPDATE chat_menu SET status = %s WHERE session_id = %s"
    db.execute(sql,(0,session_id,))
    return True

def add_dao(session_id:str) -> bool:
    db = current_app.db

    sql = "SELECT model_uuid,`system`,max_take,temperature,top_p FROM model_menu WHERE is_default = 1"
    result = db.query(sql)

    sql = "INSERT INTO chat_menu (session_id,model,`system`,max_take,temperature,top_p,create_at,lastuse_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)"
    db.execute(sql, (session_id,result[0]["model_uuid"],result[0]["system"],result[0]["max_take"],result[0]["temperature"],result[0]["top_p"],int(time.time()),int(time.time())))

    return True
