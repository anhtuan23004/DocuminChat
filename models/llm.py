from langchain_community.llms import CTransformers
from langchain.chains import ConversationalRetrievalChain
from transformers import AutoTokenizer
import os

def initialize_llm(model_path, model_type="llama"):
    llm = CTransformers(
        model=os.path.abspath(model_path),
        model_type=model_type,
        config={
            "max_new_tokens": 512,
            "temperature": 1
        }
    )
    tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    return llm, tokenizer

def create_conversational_chain(llm, docsearch):
    return ConversationalRetrievalChain.from_llm(llm, retriever=docsearch.as_retriever())

