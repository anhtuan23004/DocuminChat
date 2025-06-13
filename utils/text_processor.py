from langchain.text_splitter import RecursiveCharacterTextSplitter, CharacterTextSplitter
from langchain.schema import Document

def split_pdf_text_into_chunks(text, chunk_size=500, chunk_overlap=50):
    # Use RecursiveCharacterTextSplitter for more granular control
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", ".", " ", ""],  # Split by paragraphs, sentences, etc.
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    documents = text_splitter.split_text(text)
    return [Document(page_content=doc) for doc in documents]

def split_structured_data_into_chunks(data, max_context_length=512):
    documents = []

    # Convert each row to a string of key:value pairs
    for _, row in data.iterrows():
        key_value_pairs = [f"{col}:{str(value)}" for col, value in zip(data.columns, row)]
        full_text = ", ".join(key_value_pairs)

        # Check if the document exceeds the maximum context length
        if len(full_text.split()) > max_context_length:
            # Keep only the first column's key:value pair
            truncated_text = f"{data.columns[0]}:{row[0]}"
            document = Document(page_content=truncated_text)
        else:
            document = Document(page_content=full_text)

        documents.append(document)

    # Use RecursiveCharacterTextSplitter to ensure chunks do not exceed max_context_length
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n", " ", ""],  # Split by newlines, spaces, etc.
        chunk_size=max_context_length,
        chunk_overlap=0
    )
    text_chunks = text_splitter.split_documents(documents)

    return text_chunks