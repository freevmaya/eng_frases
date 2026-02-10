# app.py
import sys

project_path = '/home/vmaya/www/eng_frases/english-phrases-server'
if project_path not in sys.path:
    sys.path.append(project_path)

from flask import Flask, request, jsonify
from flask_cors import CORS  # Добавьте этот импорт
import hashlib
import json
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime
from OpenAI import generate_phrases
import re

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": ["https://eng-frases.com", "https://eng.vmaya.ru", "https://www.eng.vmaya.ru"]}})

# Конфигурация MySQL
MYSQL_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'port': os.environ.get('DB_PORT', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'eng_phrases')
}

# Поддерживаемые языки
SUPPORTED_LANGUAGES = {
    'ru': 'Russian',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh': 'Chinese'
}

def get_db_connection():
    """Создание подключения к MySQL"""
    try:
        connection = mysql.connector.connect(**MYSQL_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_database():
    """Инициализация базы данных при необходимости"""
    connection = get_db_connection()
    if connection:
        cursor = connection.cursor()
        
        # Создаем базу данных если не существует
        cursor.execute("CREATE DATABASE IF NOT EXISTS eng_phrases")
        cursor.execute("USE eng_phrases")
        
        # Создаем таблицу кеша
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS phrase_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cache_key VARCHAR(32) UNIQUE NOT NULL,
                native_lang VARCHAR(2) NOT NULL,
                target_lang VARCHAR(2) NOT NULL,
                theme TEXT NOT NULL,
                phrases_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cache_key (cache_key)
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()

def load_prompt_template(native_lang):
    """Загрузка промта для указанного языка"""
    prompt_file = f"prompts/{native_lang}_prompt.txt"
    
    if not os.path.exists(prompt_file):
        # Если нет промта для языка, используем английский по умолчанию
        default_prompt = """Generate 50 English phrases ({theme}) in Past Simple tense.
Strict JSON array format:
[
    {{"en": "English phrase here", "native": "Translation here"}},
    {{"en": "Another phrase", "native": "Another translation"}}
]
Phrases should be useful for learning English, varied and cover the topic: {theme}"""
        return default_prompt
    
    with open(prompt_file, 'r', encoding='utf-8') as f:
        return f.read()

def create_cache_key(native_lang, target_lang, theme):
    """Создание MD5 ключа для кеша"""
    query_string = f"{native_lang}_{target_lang}_{theme}".lower()
    return hashlib.md5(query_string.encode()).hexdigest()

def check_cache(cache_key):
    """Проверка наличия данных в кеше"""
    connection = get_db_connection()
    if not connection:
        return None
    
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        "SELECT phrases_json FROM phrase_cache WHERE cache_key = %s",
        (cache_key,)
    )
    
    result = cursor.fetchone()
    cursor.close()
    connection.close()
    
    return result['phrases_json'] if result else None

def save_to_cache(cache_key, native_lang, target_lang, theme, phrases_json):
    """Сохранение данных в кеш"""
    connection = get_db_connection()
    if not connection:
        return False
    
    cursor = connection.cursor()
    try:
        cursor.execute("""
            INSERT INTO phrase_cache (cache_key, native_lang, target_lang, theme, phrases_json)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE phrases_json = VALUES(phrases_json)
        """, (cache_key, native_lang, target_lang, theme, phrases_json))
        
        connection.commit()
        success = True
    except Error as e:
        print(f"Error saving to cache: {e}")
        success = False
    finally:
        cursor.close()
        connection.close()
    
    return success

def parse_ai_response(response_text):
    """Парсинг ответа от ИИ, извлечение JSON"""
    # Ищем JSON в ответе
    json_pattern = r'\[.*\]'
    match = re.search(json_pattern, response_text, re.DOTALL)
    
    if match:
        try:
            json_str = match.group(0)
            # Заменяем одинарные кавычки на двойные для валидного JSON
            json_str = json_str.replace("'", '"')
            phrases = json.loads(json_str)
            return phrases
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Raw response: {response_text}")
            return None
    else:
        print(f"No JSON found in response: {response_text[:500]}...")
        return None

def generate_phrases_from_ai(native_lang, target_lang, theme):
    """Генерация фраз через ИИ"""
    import traceback
    
    try:
        print(f"DEBUG generate_phrases_from_ai: Starting with theme='{theme}'", file=sys.stderr)
        
        # Загружаем промт для языка
        prompt_template = load_prompt_template(native_lang)
        print(f"DEBUG: Prompt template loaded, length: {len(prompt_template)}", file=sys.stderr)
        
        # Заменяем плейсхолдеры в промте
        prompt = prompt_template.format(theme=theme)
        print(f"DEBUG: Prompt (first 500 chars): {prompt[:500]}", file=sys.stderr)
        
        # Вызываем ИИ
        print("DEBUG: Calling generate_phrases()...", file=sys.stderr)
        response = generate_phrases(prompt)
        
        if not response:
            print("DEBUG: generate_phrases() returned None", file=sys.stderr)
            return None
        
        print(f"DEBUG: Raw response (first 500 chars): {response[:500]}", file=sys.stderr)
        
        # Парсим ответ
        phrases = parse_ai_response(response)
        print(f"DEBUG: Parsed phrases: {phrases}", file=sys.stderr)
        
        # Преобразуем в нужный формат
        if phrases:
            formatted_phrases = []
            for phrase in phrases:
                if isinstance(phrase, dict):
                    formatted_phrase = {}
                    
                    # Английская фраза
                    if 'en' in phrase:
                        formatted_phrase['en'] = phrase['en']
                    elif 'english' in phrase:
                        formatted_phrase['en'] = phrase['english']
                    else:
                        continue
                    
                    # Перевод на родной язык
                    if native_lang in phrase:
                        formatted_phrase['native'] = phrase[native_lang]
                    elif 'russian' in phrase and native_lang == 'ru':
                        formatted_phrase['native'] = phrase['russian']
                    elif 'translation' in phrase:
                        formatted_phrase['native'] = phrase['translation']
                    else:
                        continue
                    
                    formatted_phrases.append(formatted_phrase)
            
            print(f"DEBUG: Final formatted phrases count: {len(formatted_phrases)}", file=sys.stderr)
            return formatted_phrases[:50]
        
        print("DEBUG: phrases is None or empty", file=sys.stderr)
        return None
        
    except Exception as e:
        print(f"DEBUG ERROR in generate_phrases_from_ai: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

@app.route('/generate-phrases', methods=['POST'])
def generate_phrases_endpoint():
    """Эндпоинт генерации фраз"""
    # Получаем данные из запроса
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    native_lang = data.get('native_lang', 'ru').lower()
    target_lang = data.get('target_lang', 'en').lower()
    count = data.get('count', 10)
    theme = data.get('theme', 'daily activities').strip()
    
    # Валидация
    if native_lang not in SUPPORTED_LANGUAGES:
        return jsonify({
            'error': f'Unsupported native language. Supported: {", ".join(SUPPORTED_LANGUAGES.keys())}'
        }), 400
    
    if target_lang != 'en':
        return jsonify({'error': 'Only English target language is supported'}), 400
    
    if not theme or len(theme) < 2:
        return jsonify({'error': 'Theme is too short'}), 400
    
    # Создаем ключ кеша
    cache_key = create_cache_key(native_lang, target_lang, theme)
    
    # Проверяем кеш
    cached_data = check_cache(cache_key)
    
    if cached_data:
        return jsonify({
            'phrases': json.loads(cached_data),
            'cached': True,
            'count': len(json.loads(cached_data))
        })
    
    # Генерируем новые фразы
    phrases = generate_phrases_from_ai(native_lang, target_lang, theme, count)
    
    if not phrases:
        return jsonify({'error': 'Failed to generate phrases'}), 500
    
    # Сохраняем в кеш
    phrases_json = json.dumps(phrases, ensure_ascii=False)
    save_to_cache(cache_key, native_lang, target_lang, theme, phrases_json)
    
    return jsonify({
        'phrases': phrases,
        'cached': False,
        'count': len(phrases)
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Эндпоинт проверки здоровья сервера"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'supported_languages': list(SUPPORTED_LANGUAGES.keys())
    })

if __name__ == '__main__':

    print("""
    Example:
     curl -X POST http://localhost:port/generate-phrases   -H "Content-Type: application/json"   -d '{
        "native_lang": "ru",
        "target_lang": "en",
        "theme": "Term `Pasrt simple`"
      }'
    """)
    # Инициализируем БД при запуске
    init_database()
    
    # Запускаем сервер
    app.run(host='0.0.0.0', port=5002, debug=True)