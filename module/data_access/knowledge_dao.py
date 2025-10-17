from flask import current_app

def get_knowledge_dao() -> list[str]:
    kb = current_app.kb

    return kb.show_all()

def add_knowledge_dao(text:str) -> bool:
    kb = current_app.kb

    kb.add(text)
    return True

def del_knowledge_dao(text:str) -> bool:
    kb = current_app.kb

    kb.delete(text)
    return True

