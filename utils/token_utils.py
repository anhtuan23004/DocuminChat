def count_tokens(text, tokenizer):
    """
    Count the number of tokens in a text using a tokenizer.
    :param text: Input text
    :param tokenizer: Tokenizer from the LLM model
    :return: Number of tokens
    """
    return len(tokenizer.encode(text))

def truncate_text_by_tokens(text, tokenizer, max_tokens):
    """
    Truncate a text to ensure it does not exceed the maximum token limit.
    :param text: Input text
    :param tokenizer: Tokenizer from the LLM model
    :param max_tokens: Maximum allowed tokens
    :return: Truncated text
    """
    tokens = tokenizer.encode(text)
    if len(tokens) > max_tokens:
        tokens = tokens[:max_tokens]
    return tokenizer.decode(tokens)