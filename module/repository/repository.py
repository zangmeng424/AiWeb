# 简单本地知识库问答 Demo
# 依赖安装：
# pip install faiss-cpu numpy sentence-transformers
from openai import OpenAI
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# ====== 初始化本地 embedding 模型 ======
embed_model = SentenceTransformer(r"./bge-small-zh-v1.5")

def get_embedding(text: str) -> np.ndarray:
    """
    输入文本 -> 输出向量 (ndarray)
    使用本地 BAAI/bge-small-zh-v1.5
    """
    vec = embed_model.encode([text])[0]  # (768,)
    return np.array(vec, dtype="float32")

# ====== 知识库构建 ======
class LocalKnowledgeBase:
    def __init__(self):
        self.docs = []   # 文本片段
        self.index = None  # FAISS 索引

    def build(self, documents: list[str]):
        """构建知识库索引"""
        self.docs = documents
        vectors = [get_embedding(doc) for doc in documents]
        dim = vectors[0].shape[0]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(np.array(vectors))

    def search(self, query: str, top_k=3):
        """检索最相关的文档"""
        q_vec = get_embedding(query).reshape(1, -1)
        distances, indices = self.index.search(q_vec, top_k)
        return [self.docs[i] for i in indices[0]]
