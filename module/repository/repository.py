# pip install faiss-cpu numpy sentence-transformers
import os
from openai import OpenAI
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import pickle
from config_dev import embedding

# ====== 初始化本地 embedding 模型 ======
embed_model = SentenceTransformer(embedding)

def get_embedding(text: str) -> np.ndarray:
    """
    输入文本 -> 输出向量 (ndarray)
    """
    vec = embed_model.encode([text])[0]  # (768,)
    return np.array(vec, dtype="float32")

# ====== 知识库构建 ======
class LocalKnowledgeBase:
    def __init__(self):
        self.docs = []
        self.index = None
        self.vecs = None
        self.index_path = "./module/repository/dictionary.index"
        self.pkl_path = "./module/repository/dictionary.pkl"
        self._load_existing()

    def _load_existing(self):
        if os.path.exists(self.pkl_path) and os.path.exists(self.index_path):
            with open(self.pkl_path, "rb") as f:
                self.docs = pickle.load(f)
            self.index = faiss.read_index(self.index_path)
            self.vecs = self.index.reconstruct_n(0, len(self.docs))

    def _save(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        if not self.docs:
            if os.path.exists(self.index_path):
                os.remove(self.index_path)
            if os.path.exists(self.pkl_path):
                os.remove(self.pkl_path)
        else:
            faiss.write_index(self.index, self.index_path)
            with open(self.pkl_path, "wb") as f:
                pickle.dump(self.docs, f)

    def _rebuild_index(self):
        if not self.docs:
            self.index = None
            self.vecs = None
            return
        vecs = [get_embedding(doc) for doc in self.docs]
        dim = vecs[0].shape[0]
        self.index = faiss.IndexFlatL2(dim)
        self.vecs = np.array(vecs, dtype="float32")
        self.index.add(self.vecs)

    def build(self, documents: list[str]):
        self.docs = documents
        self._rebuild_index()
        self._save()

    def add(self, text: str):
        self.docs.append(text)
        self._rebuild_index()
        self._save()

    def delete(self, keyword: str):
        self.docs = [doc for doc in self.docs if keyword not in doc]
        self._rebuild_index()
        self._save()

    def show_all(self):
        return self.docs

    def search(self, query: str, top_k=3):
        if not self.index:
            return []

        top_k = min(top_k, len(self.docs))
        q_vec = get_embedding(query).reshape(1, -1)
        empty_vec = np.zeros_like(q_vec)
        temp_vecs = np.vstack([self.vecs, empty_vec])

        import faiss
        temp_index = faiss.IndexFlatL2(temp_vecs.shape[1])
        temp_index.add(temp_vecs)

        distances, indices = temp_index.search(q_vec, top_k + 1)

        result = []
        seen = set()
        for i in indices[0]:
            if i == len(self.docs):
                result.append('')
            else:
                text = self.docs[i]
                if text not in seen:
                    seen.add(text)
                    result.append(text)

        if '' in result:
            #result = result[:result.index('')]
            result = [text for text in result if text != '']

        return result
