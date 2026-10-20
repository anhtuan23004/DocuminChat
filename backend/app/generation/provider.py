import json

import httpx


class ProviderError(Exception):
    pass


async def generate(settings, messages, transport=None, *, temperature=0.2, top_p=None):
    headers = {}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    client = httpx.AsyncClient(
        timeout=settings.llm_timeout_seconds, transport=transport, follow_redirects=False
    )
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "stream": True,
        "temperature": float(temperature),
        "max_tokens": 1024,
    }
    if top_p is not None:
        payload["top_p"] = float(top_p)
    async with (
        client,
        client.stream(
            "POST",
            settings.llm_base_url.rstrip("/") + "/chat/completions",
            headers=headers,
            json=payload,
        ) as response,
    ):
        if response.status_code != 200:
            raise ProviderError("Model chưa sẵn sàng hoặc cấu hình kết nối chưa đúng.")
        async for line in response.aiter_lines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                return
            try:
                event = json.loads(data)
                if "error" in event:
                    raise ProviderError("Model trả lỗi trong khi tạo câu trả lời.")
                choices = event.get("choices", [])
                if choices:
                    text = choices[0].get("delta", {}).get("content")
                    if text:
                        if not isinstance(text, str):
                            raise ProviderError("Model trả dữ liệu stream không hợp lệ.")
                        yield text
            except (ValueError, TypeError, AttributeError, IndexError) as error:
                raise ProviderError("Model trả dữ liệu stream không hợp lệ.") from error
        raise ProviderError("Kết nối model bị gián đoạn trước khi hoàn tất.")
