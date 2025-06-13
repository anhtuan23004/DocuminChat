# Constants
EMBEDDINGS_MODELS = {
    "MiniLM": "sentence-transformers/all-MiniLM-L6-v2",
    "DistilBERT": "sentence-transformers/distilbert-base-nli-mean-tokens",
}

LLM_MODELS = {
    "Llama-2-7B": "models/llama-2-7b-chat.ggmlv3.q5_0.bin",
    "Llama-2-13B": "models/firefly-llama2-13b-chat.Q4_0.gguf",
}

SUPPORTED_FILE_TYPES = ["csv", "json", "xlsx", "pdf"]
ROWS_PER_PAGE = 10
CHAT_HISTORY_LIMIT = 5

# print(LLM_MODELS.keys())
# print(EMBEDDINGS_MODELS.keys())
# print(LLM_MODELS["Llama-2-7B"])