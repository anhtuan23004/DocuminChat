import streamlit as st
from config import EMBEDDINGS_MODELS, LLM_MODELS, SUPPORTED_FILE_TYPES, ROWS_PER_PAGE
from utils.file_loader import load_file
from utils.text_processor import split_pdf_text_into_chunks, split_structured_data_into_chunks
from models.embeddings import create_embeddings
from models.llm import initialize_llm, create_conversational_chain
from utils.chat_history import update_chat_history
from utils.relevance_checker import is_relevant_query
from utils.token_utils import count_tokens, truncate_text_by_tokens

import warnings
warnings.filterwarnings("ignore", message="CropBox missing from /Page, defaulting to MediaBox")

def main():
    st.title("Data Query System")
    st.write("This app allows you to query data extracted from various file formats.")

    # Select file type
    file_type = st.selectbox("Select file type", SUPPORTED_FILE_TYPES)
    uploaded_file = st.file_uploader(f"Upload a {file_type.upper()} file", type=[file_type])

    if uploaded_file is not None:
        if file_type in ["csv", "json", "xlsx"]:
            # Load structured data
            data = load_file(uploaded_file, file_type)
            st.write(f"Data loaded from {uploaded_file.name}, containing {len(data)} rows.")
            
            # Pagination setup for tabular data
            total_pages = len(data) // ROWS_PER_PAGE + (1 if len(data) % ROWS_PER_PAGE != 0 else 0)
            page = st.number_input("Page", min_value=1, max_value=total_pages, value=1, step=1)
            start_row = (page - 1) * ROWS_PER_PAGE
            end_row = start_row + ROWS_PER_PAGE
            st.dataframe(data.iloc[start_row:end_row])

            # Process structured data
            text_chunks = split_structured_data_into_chunks(data)

        elif file_type == "pdf":
            # Load raw text from PDF
            raw_text = load_file(uploaded_file, file_type)
            st.write(f"Data loaded from {uploaded_file.name}.")
            st.text_area("Extracted Text", value=raw_text, height=300)

            # Process raw text from PDF
            text_chunks = split_pdf_text_into_chunks(raw_text)

        st.write(f"Data split into {len(text_chunks)} chunks.")

        # Select embedding model
        embedding_model = st.selectbox("Select embedding model", list(EMBEDDINGS_MODELS.keys()))
        print(embedding_model, EMBEDDINGS_MODELS[embedding_model])
        docsearch = create_embeddings(text_chunks, EMBEDDINGS_MODELS[embedding_model])

        # Select LLM model
        print("Available LLM models:", LLM_MODELS)
        llm_model = st.selectbox("Select LLM model", list(LLM_MODELS.keys()))
        print(llm_model, LLM_MODELS[llm_model])
        llm, tokenizer = initialize_llm(LLM_MODELS[llm_model])
        print("LLM initialized:", llm)
        qa = create_conversational_chain(llm, docsearch)

        # Chat interaction
        chat_history = []
        query = st.text_input("Ask a question based on the data:", "")
        if st.button("Submit") and query:
            answer, chat_history = run_conversation(qa, llm, chat_history, query, docsearch, tokenizer=tokenizer)
            st.write("Answer:", answer)

def run_conversation(qa, llm, chat_history, query, docsearch, tokenizer, max_tokens=512):
    # Check if the query exceeds the maximum token limit
    query_token_count = count_tokens(query, tokenizer)
    if query_token_count > max_tokens:
        st.warning(f"Query is too long ({query_token_count} tokens). Truncating to {max_tokens} tokens.")
        query = truncate_text_by_tokens(query, tokenizer, max_tokens)

    # Check if the query is relevant to the document
    flag, score, doc = is_relevant_query(query, docsearch)
    if not flag:
        # If not relevant, directly use LLM to generate a response
        print("Score: ", score)
        print("Document: ", doc)
        result = llm(query)
        answer = result.strip()
        chat_history = update_chat_history(chat_history, query, answer)
        return answer, chat_history
    
    # If relevant, proceed with the conversational retrieval chain
    enhanced_query = (
        f"You are a data analyst. Based on the provided data, answer the following question: {query}. "
        "Please ensure your answer is accurate and directly derived from the data. "
        "If the data does not provide enough information, please state that explicitly."
    )
    result = qa({"question": enhanced_query, "chat_history": chat_history})
    chat_history = update_chat_history(chat_history, query, result['answer'])
    return result['answer'], chat_history

if __name__ == "__main__":
    main()