import base64
import json
from flask import current_app


def change_system_dao(sessid:str,system:str) -> bool:
    db = current_app.db

    sql = "UPDATE chat_menu SET system = %s WHERE session_id = %s"
    db.execute(sql, (system,sessid,))

    return True




def get_task_setting_dao(sessid:str) -> json:
    db = current_app.db

    sql = "SELECT session_id,title,system,avatar,model,max_take,temperature,top_p FROM chat_menu WHERE session_id = %s"
    data=db.query(sql, (sessid,))

    return data[0] if data else {}



def change_task_setting_dao(data:json) -> bool:
    db = current_app.db

    max_take = int(data["max_take"])
    model= data["model"]
    session_id= data["session_id"]
    system= data["system"]
    task_name= data["task_name"]
    temperature= float(data["temperature"])
    top_p= float(data["top_p"])
    avatar= f"static/avatar/{session_id}.png"
    if data["avatar"].startswith("data:image/"):
        img_data = base64.b64decode(data["avatar"].split(",")[1])
        with open(avatar, "wb") as f:
            f.write(img_data)
        avatar = "/" + avatar
    sql = "UPDATE chat_menu SET max_take=%s, model=%s, system=%s, title=%s, temperature=%s, top_p=%s, avatar=%s WHERE session_id=%s"
    db.execute(sql, (max_take, model, system, task_name, temperature, top_p, avatar, session_id,))

    return True



def model_dao() -> list:
    db = current_app.db

    sql = "SELECT model_uuid,system,model_name,base_url,api_key,max_take,temperature,top_p FROM model_menu"
    data=db.query(sql)

    return data