import base64
import json
import time

from flask import current_app


def change_system_dao(sessid:str,system:str) -> bool:
    db = current_app.db
    redis = current_app.redis
    redis.delete(f'chat_menu:{sessid}')

    sql = "UPDATE chat_menu SET `system` = %s WHERE session_id = %s"
    db.execute(sql, (system,sessid,))

    return True




def get_task_setting_dao(sessid:str) -> json:
    db = current_app.db

    sql = "SELECT session_id,title,`system`,avatar,model,max_take,temperature,top_p FROM chat_menu WHERE session_id = %s"
    data=db.query(sql, (sessid,))

    return data[0] if data else {}



def change_task_setting_dao(data:dict) -> bool:
    db = current_app.db
    redis = current_app.redis
    redis.delete(f'chat_menu:{data["session_id"]}')

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
    sql = "UPDATE chat_menu SET max_take=%s, model=%s, `system`=%s, title=%s, temperature=%s, top_p=%s, avatar=%s WHERE session_id=%s"
    db.execute(sql, (max_take, model, system, task_name, temperature, top_p, avatar, session_id,))

    return True



def get_model_dao() -> list:
    db = current_app.db

    sql = "SELECT model_uuid,`system`,model_name,model,base_url,api_key,max_take,temperature,top_p FROM model_menu"
    data=db.query(sql)

    return data



def change_model_dao(data:dict) -> bool:
    db = current_app.db
    redis = current_app.redis
    for key in redis.scan_iter('chat_menu:*'):
        redis.delete(key)

    sql = """INSERT INTO model_menu
    (model_uuid, model_name, model, `system`, max_take, temperature, top_p, base_url, api_key,create_at)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON DUPLICATE KEY UPDATE
        model_name = VALUES(model_name),
        model = VALUES(model),
        `system` = VALUES(`system`),
        max_take = VALUES(max_take),
        temperature = VALUES(temperature),
        top_p = VALUES(top_p),
        base_url = VALUES(base_url),
        api_key = VALUES(api_key);
    """
    db.execute(sql, (
        data['model_uuid'],
        data['model_name'],
        data['model'],
        data['system'],
        data['max_take'],
        data['temperature'],
        data['top_p'],
        data['base_url'],
        data['api_key'],
        int(time.time())
    ))
    return True


def del_model_dao(model_uuid:str) -> bool:
    db = current_app.db

    sql = "DELETE FROM model_menu WHERE model_uuid=%s"
    db.execute(sql, (model_uuid,))

    return True











