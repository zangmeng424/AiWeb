import asyncio
import json
import time
from openai.types.chat import ChatCompletionChunk
from openai import Stream
from flask import current_app

from module.ai_module.module_api_tmp import *


def chat_dao(session_id: str, messages: list[dict], db, client,kb, loop, redis,on_knowledge,on_tools) -> Stream[ChatCompletionChunk]:

    chat_info_str = redis.get(f'chat_menu:{session_id}')

    if chat_info_str:
        chat_info = json.loads(chat_info_str)
    else:
        sql = """SELECT 
                    a.temperature,
                    a.top_p,
                    b.model,
                    b.base_url,
                    b.api_key
                FROM chat_menu AS a
                JOIN model_menu AS b
                    ON a.model = b.model_uuid
                WHERE a.session_id = %s
                """
        chat_info = db.query(sql, (session_id,))
        chat_info = chat_info[0]
        redis.set(f'chat_menu:{session_id}',json.dumps(chat_info))

    temperature = chat_info["temperature"]
    top_p = chat_info["top_p"]
    model = chat_info["model"]
    base_url = chat_info["base_url"]
    api_key = chat_info["api_key"]


    tools = asyncio.run_coroutine_threadsafe(client.get_tools(),loop).result() if on_tools else None

    if on_knowledge:
        #拼接本地知识库
        messages[-1]["content"] = f"来源本地知识库：\n {kb.show_all()}\n\n"+messages[-1]["content"] if messages[-1]["role"] == "user" else messages[-1]["content"]

    return openai_tmp(temperature=temperature,top_p=top_p,model=model,base_url=base_url,api_key=api_key,messages=messages,tools=tools)


def get_history_dao(session_id:str) -> json:
    db = current_app.db

    #拿取max_take和system
    sql = "SELECT max_take, system FROM chat_menu WHERE session_id = %s"
    take_info=db.query(sql, (session_id,))
    ststem=take_info[0]["system"]
    max_take=take_info[0]["max_take"]

    #拿取最新消息uuid
    sql = "SELECT chat_uuid FROM chat_history WHERE session_id = %s AND role != 'tool' ORDER BY created_at DESC LIMIT 1 "
    last_msg_id = db.query(sql, (session_id,))

    rt_data = {
        "session_id":session_id,
        "max_take": max_take,
        "system": ststem,
        "last_msg_id":last_msg_id[0]["chat_uuid"] if last_msg_id else "",
        "data": {}
    }

    #查询主要数据
    sql = "SELECT chat_uuid,role,children,metadata FROM chat_history WHERE session_id = %s ORDER BY created_at ASC"
    history_data = db.query(sql, (session_id,))
    if history_data:
        for data_c in history_data:
            if data_c["role"] == "tool":
                rt_data["data"][data_c["chat_uuid"]]["tool_return"] = json.loads(data_c["metadata"])
            else:
                rt_data["data"][data_c["chat_uuid"]]={
                    **json.loads(data_c["metadata"]),
                    "role": data_c["role"],
                    "children": json.loads(data_c["children"] if data_c["children"] else [])
                }
    else:
        rt_data["data"]={}

    # 更新最后使用时间
    sql = "UPDATE chat_menu SET lastuse_at=%s WHERE session_id=%s"
    db.execute(sql, (int(time.time()),session_id,))


    return rt_data

def update_history_dao(msg_json:dict) -> json:
    db = current_app.db
    #更新最新消息
    sql = "INSERT INTO chat_history (session_id,chat_uuid,role,content,children,metadata,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)"
    db.execute(sql, (msg_json["session_id"],msg_json["chat_uuid"],msg_json["role"],msg_json["metadata"]["content"],json.dumps([]),json.dumps(msg_json["metadata"]),msg_json["created_at"],))

    metadata = msg_json["metadata"]
    if "parent_id" in metadata and metadata["parent_id"]:
        #拿取更新消息的父消息的children初始消息
        sql = "SELECT children FROM chat_history WHERE chat_uuid = %s"
        result=db.query(sql,(metadata["parent_id"],))
        children = result[0]["children"]
        children =json.loads(children) if json.loads(children) else []
        children.append(msg_json["chat_uuid"])
        # 更新更新消息的父消息的children
        sql = "UPDATE chat_history SET children = %s WHERE chat_uuid = %s and role != 'tool'"
        db.execute(sql, (json.dumps(children),metadata["parent_id"],))


    return True

async def tools_dao(tools_call_name:str,tools_call_params:dict) -> str:
    client = current_app.client

    tool_return = await client.get_tool_return(tools_call_name,tools_call_params)

    return tool_return

