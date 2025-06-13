from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def is_relevant_query(query, docsearch, threshold=0.2):
    """
    Check if the query is relevant to the document content.
    :param query: User's question
    :param docsearch: FAISS vector store
    :param threshold: Similarity threshold (default 0.7)
    :return: True if relevant, False otherwise
    """
    # Embed the query
    embeddings = docsearch.embedding_function
    query_embedding = embeddings.embed_query(query)

    # Retrieve top-k similar documents
    docs_and_scores = docsearch.similarity_search_with_score(query, k=1)
    if not docs_and_scores:
        return False, 0.0, ""

    # Get the highest similarity score
    doc, similarity_score = docs_and_scores[0]
    similarity_score = 1 - similarity_score  # Convert distance to similarity

    # Check if similarity exceeds the threshold
    return similarity_score >= threshold, similarity_score, doc