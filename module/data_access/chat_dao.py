import asyncio
import json
import time

from loguru import logger
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
    if messages[-1]["role"] == "user":
        user_msg = messages[-1]["content"]
        if on_knowledge:
            #拼接本地知识库
            messages[-1]["content"] = f"来源本地知识库查询：\n {kb.search(user_msg)}\n\n用户消息：\n{user_msg}"

            asyncio.run(ai_update_repository_dao(model=model, base_url=base_url, api_key=api_key, user_msg=user_msg,kb=kb))

    return openai_tmp(temperature=temperature,top_p=top_p,model=model,base_url=base_url,api_key=api_key,messages=messages,tools=tools)

async def ai_update_repository_dao(model: str, base_url: str, api_key: str, user_msg: str,kb):
    messages=[{
        "role": "system",
        "content":"你是一个知识库更新程序，请判断用户消息中是否包含可长期保存的知识记忆或偏好设定, 如果有, 请提取出来并以List[json]格式返回:[{'intent': 'add' | 'delete','key_info': '...'}] 。遵守以下规则作为前提 1.key_info数据不能超过80个字符 2.非用户明确修改需求的前提下，仅保存重要知识或记忆 3.若无重要信息请返回空列表"
    }, {
        "role": "user",
        "content": f"来源本地知识库查询：\n {kb.search(user_msg)}\n\n用户消息：\n{user_msg}"
    }]
    resp=openai_tmp(temperature=0, top_p=1, model=model, base_url=base_url, api_key=api_key, messages=messages,stream=False)
    try:
        repo_info=json.loads(resp.choices[0].message.content)
        logger.info(f"AI 知识库更新结果:\n{repo_info}")
        for repo_item in repo_info:
            if repo_item["intent"] == "add":
                kb.add(repo_item["key_info"])
            elif repo_item["intent"] == "delete":
                kb.delete(repo_item["key_info"])

    except Exception:
        logger.exception("知识库更新失败")

def get_history_dao(session_id:str) -> json:
    db = current_app.db

    # 拿取max_take和system
    sql = "SELECT max_take, `system` FROM chat_menu WHERE session_id = %s"
    take_info=db.query(sql, (session_id,))
    # 空对话判断
    if not take_info:
        return False
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
                if rt_data["data"].get(data_c["chat_uuid"]):
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

def rollback_dao(session_id: str, chat_uuid: str) -> bool:
    """
    回退消息：删除指定的消息记录，并更新父消息的children列表
    """
    db = current_app.db
    
    try:
        # 1. 获取要删除消息的信息
        sql = "SELECT role, children, metadata FROM chat_history WHERE chat_uuid = %s AND session_id = %s"
        msg_info = db.query(sql, (chat_uuid, session_id))
        
        if not msg_info:
            return False
        
        msg_info = msg_info[0]
        metadata = json.loads(msg_info["metadata"])
        parent_id = metadata.get("parent_id")
        
        # 2. 如果有父消息，从父消息的children中移除该消息
        if parent_id:
            sql = "SELECT children FROM chat_history WHERE chat_uuid = %s"
            parent_result = db.query(sql, (parent_id,))
            if parent_result:
                children = json.loads(parent_result[0]["children"])
                if chat_uuid in children:
                    children.remove(chat_uuid)
                    # 更新父消息的children
                    sql = "UPDATE chat_history SET children = %s WHERE chat_uuid = %s"
                    db.execute(sql, (json.dumps(children), parent_id))
        
        # 3. 删除该消息（包括可能的tool消息）
        # 先删除关联的tool消息
        sql = "DELETE FROM chat_history WHERE session_id = %s AND role = 'tool' AND chat_uuid = %s"
        db.execute(sql, (session_id, chat_uuid))
        
        # 再删除主消息
        sql = "DELETE FROM chat_history WHERE chat_uuid = %s AND session_id = %s"
        db.execute(sql, (chat_uuid, session_id))
        
        return True
    except Exception as e:
        print(f"回退消息失败: {e}")
        return False

