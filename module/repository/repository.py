# pip install faiss-cpu numpy sentence-transformers
import os
from openai import OpenAI
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import pickle


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
        self.docs = []
        self.index = None
        self.index_path = "./module/repository/dictionary.index"
        self.pkl_path = "./module/repository/dictionary.pkl"
        self._load_existing()

    def _load_existing(self):
        """初始化时读取本地文件（若存在）"""
        if os.path.exists(self.pkl_path) and os.path.exists(self.index_path):
            with open(self.pkl_path, "rb") as f:
                self.docs = pickle.load(f)
            self.index = faiss.read_index(self.index_path)

    def _save(self):
        """保存索引和文档"""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        if self.index and self.docs:
            faiss.write_index(self.index, self.index_path)
            with open(self.pkl_path, "wb") as f:
                pickle.dump(self.docs, f)

    def _rebuild_index(self):
        """根据 self.docs 重建向量索引"""
        if not self.docs:
            self.index = None
            return
        vecs = [get_embedding(doc) for doc in self.docs]
        dim = vecs[0].shape[0]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(np.array(vecs, dtype="float32"))

    # ===== 基础操作 =====
    def build(self, documents: list[str]):
        """仅支持外部传入文档构建"""
        self.docs = documents
        self._rebuild_index()
        self._save()

    def add(self, text: str):
        """添加一条知识并更新索引"""
        self.docs.append(text)
        self._rebuild_index()
        self._save()

    def delete(self, keyword: str):
        """根据关键字删除匹配的文档"""
        self.docs = [doc for doc in self.docs if keyword not in doc]
        print(self.docs)
        self._rebuild_index()
        self._save()

    def show_all(self):
        """返回所有知识内容"""
        return self.docs

    def search(self, query: str, top_k=3):
        """检索最相关的文档，并去重"""
        if not self.index:
            return []

        # 防止 top_k 超过文档数量
        top_k = min(top_k, len(self.docs))

        # 获取查询向量
        q_vec = get_embedding(query).reshape(1, -1)
        distances, indices = self.index.search(q_vec, top_k)

        # 去重返回结果
        result = []
        for i in indices[0]:
            text = self.docs[i]
            if text not in result:
                result.append(text)
        return result
