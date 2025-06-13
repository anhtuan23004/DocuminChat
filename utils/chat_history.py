def update_chat_history(chat_history, query, answer, limit=3):
    chat_history.append((query, answer))
    return chat_history[-limit:]