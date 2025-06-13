from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

def create_embeddings(text_chunks, model_name):
    embeddings = HuggingFaceEmbeddings(model_name=model_name)
    return FAISS.from_documents(text_chunks, embeddings)