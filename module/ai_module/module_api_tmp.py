from openai.types.chat import ChatCompletionChunk
from openai import OpenAI, Stream


def openai_tmp(messages: list[dict],model:str,base_url:str,api_key:str,temperature:float,top_p:float,tools:list[dict] = None,stream:bool = True) -> Stream[ChatCompletionChunk]:
    client = OpenAI(api_key=api_key, base_url=base_url)

    response = client.chat.completions.create(
        model=model,
        messages=messages if messages else [],
        temperature=temperature,
        top_p=top_p,
        stream=stream,
        tools=tools if tools else None
    )
    return response




