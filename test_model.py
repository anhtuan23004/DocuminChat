from langchain_community.llms import CTransformers

llm = CTransformers(
    model="models/llama-2-7b-chat.ggmlv3.q5_0.bin",  # Đường dẫn TƯƠNG ĐỐI hoặc TUYỆT ĐỐI
    model_type="llama",  # hoặc "llama2" nếu bạn dùng gguf
    config={
        "max_new_tokens": 256,
        "temperature": 0.7,
        "context_length": 2048
    }
)

print(llm.invoke("What is the capital of France?"))  # Thử nghiệm với câu hỏi đơn giản
