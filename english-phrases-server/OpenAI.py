# OpenAI.py
from huggingface_hub import InferenceClient
import os
import json

def generate_phrases(prompt_text):
    """
    Генерация фраз через Hugging Face API
    """
    api_key = os.environ.get("HF_TOKEN")
    
    if not api_key:
        raise ValueError("HF_TOKEN environment variable is not set")
    
    client = InferenceClient(
        model="moonshotai/Kimi-K2-Instruct-0905",
        token=api_key
    )
    
    try:
        response = client.chat_completion(
            messages=[
                {"role": "user", "content": prompt_text}
            ],
            max_tokens=1000
        )
        
        # Извлекаем ответ из структуры Hugging Face
        if hasattr(response, 'choices') and len(response.choices) > 0:
            content = response.choices[0].message.content
        elif hasattr(response, 'generated_text'):
            content = response.generated_text
        else:
            # Пробуем получить текст напрямую
            content = str(response)
            
        return content
        
    except Exception as e:
        print(f"Error in HF API call: {e}")
        return None
'''
if __name__ == '__main__':
    generate_phrases("""
Сгенерируй 50 фраз на английском языке (Написание программ на языке Python) в Past Simple времени с переводом на русский.
Формат должен быть строго JSON массив объектов:
[
    {{"en": "English phrase here", "ru": "Russian translation here"}},
    {{"en": "Another phrase", "ru": "Еще перевод"}}
]
Фразы должны быть полезными для изучения английского, разнообразными и охватывать тему: Написание программ на языке Python
""");
'''