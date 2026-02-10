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

    def generate_phrases_from_ai(native_lang, target_lang, theme, count=10):
        """Генерация фраз через ИИ"""
        import sys
        import traceback
        
        try:
            print(f"=== DEBUG generate_phrases_from_ai START ===", file=sys.stderr)
            print(f"DEBUG: Params - native_lang: {native_lang}, target_lang: {target_lang}, theme: {theme}, count: {count}", file=sys.stderr)
            
            # Загружаем промт для языка
            print(f"DEBUG: Loading prompt template for language: {native_lang}", file=sys.stderr)
            prompt_template = load_prompt_template(native_lang)
            print(f"DEBUG: Prompt template loaded. Length: {len(prompt_template)} chars", file=sys.stderr)
            print(f"DEBUG: First 200 chars of template:\n{prompt_template[:200]}", file=sys.stderr)
            
            # Заменяем плейсхолдеры в промте
            print(f"DEBUG: Formatting prompt with count={count}, theme={theme}", file=sys.stderr)
            prompt = prompt_template.format(count=count, theme=theme)
            print(f"DEBUG: Formatted prompt length: {len(prompt)} chars", file=sys.stderr)
            print(f"DEBUG: First 300 chars of prompt:\n{prompt[:300]}", file=sys.stderr)
            
            # Вызываем ИИ
            print(f"DEBUG: Calling generate_phrases()...", file=sys.stderr)
            response = generate_phrases(prompt)
            
            if not response:
                print(f"DEBUG: generate_phrases() returned None or empty", file=sys.stderr)
                print(f"=== DEBUG generate_phrases_from_ai END (no response) ===", file=sys.stderr)
                return None
            
            print(f"DEBUG: Response received. Type: {type(response)}, Length: {len(response)}", file=sys.stderr)
            print(f"DEBUG: First 500 chars of response:\n{response[:500]}", file=sys.stderr)
            
            # Парсим ответ
            print(f"DEBUG: Parsing AI response...", file=sys.stderr)
            phrases = parse_ai_response(response)
            
            print(f"DEBUG: parse_ai_response returned: {type(phrases)}", file=sys.stderr)
            if phrases is None:
                print(f"DEBUG: parse_ai_response returned None", file=sys.stderr)
            elif isinstance(phrases, list):
                print(f"DEBUG: Parsed phrases count: {len(phrases)}", file=sys.stderr)
                if phrases:
                    print(f"DEBUG: First parsed phrase: {phrases[0]}", file=sys.stderr)
            else:
                print(f"DEBUG: Unexpected return type from parse_ai_response: {type(phrases)}", file=sys.stderr)
            
            # Преобразуем в нужный формат
            if phrases:
                print(f"DEBUG: Starting to format {len(phrases)} phrases", file=sys.stderr)
                formatted_phrases = []
                skipped_count = 0
                
                for i, phrase in enumerate(phrases):
                    if isinstance(phrase, dict):
                        formatted_phrase = {}
                        
                        # Английская фраза
                        if 'en' in phrase:
                            formatted_phrase['en'] = phrase['en']
                        elif 'english' in phrase:
                            formatted_phrase['en'] = phrase['english']
                        else:
                            print(f"DEBUG: Skipping phrase {i} - no English key (keys: {list(phrase.keys())})", file=sys.stderr)
                            skipped_count += 1
                            continue
                        
                        # Перевод на родной язык
                        if native_lang in phrase:
                            formatted_phrase['native'] = phrase[native_lang]
                        elif 'russian' in phrase and native_lang == 'ru':
                            formatted_phrase['native'] = phrase['russian']
                        elif 'translation' in phrase:
                            formatted_phrase['native'] = phrase['translation']
                        else:
                            print(f"DEBUG: Skipping phrase {i} - no translation key for '{native_lang}' (keys: {list(phrase.keys())})", file=sys.stderr)
                            skipped_count += 1
                            continue
                        
                        formatted_phrases.append(formatted_phrase)
                        if len(formatted_phrases) <= 3:
                            print(f"DEBUG: Added phrase {i}: {formatted_phrase}", file=sys.stderr)
                    else:
                        print(f"DEBUG: Skipping non-dict item {i}: type={type(phrase)}, value={str(phrase)[:100]}", file=sys.stderr)
                        skipped_count += 1
                
                print(f"DEBUG: Formatting complete. Success: {len(formatted_phrases)}, Skipped: {skipped_count}", file=sys.stderr)
                result = formatted_phrases[:50]
                print(f"DEBUG: Returning {len(result)} phrases", file=sys.stderr)
                print(f"=== DEBUG generate_phrases_from_ai END (success) ===", file=sys.stderr)
                return result
            else:
                print(f"DEBUG: phrases is None or empty list", file=sys.stderr)
                print(f"=== DEBUG generate_phrases_from_ai END (no phrases) ===", file=sys.stderr)
                return None
                
        except Exception as e:
            print(f"=== DEBUG generate_phrases_from_ai ERROR ===", file=sys.stderr)
            print(f"DEBUG: Exception: {type(e).__name__}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"=== DEBUG generate_phrases_from_ai END (error) ===", file=sys.stderr)
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