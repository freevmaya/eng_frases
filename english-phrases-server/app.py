# app.py
import sys

project_path = '/home/vmaya/www/eng_frases/english-phrases-server'
if project_path not in sys.path:
    sys.path.append(project_path)

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS  # Добавьте этот импорт
import hashlib
import json
import socket
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime
from OpenAI import generate_phrases
import re
from dotenv import load_dotenv

app = Flask(__name__)

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        #logging.FileHandler('/var/log/english-phrases/app.log')
    ]
)
logger = logging.getLogger(__name__)

'''
CORS(app, resources={r"/*": {"origins": [
    "https://eng-frases.com", 
    "https://eng.vmaya.ru", 
    "https://www.eng.vmaya.ru"
]}})

# Разрешаем все домены
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    "expose_headers": ["Content-Type", "Authorization"],
    "supports_credentials": False,
    "max_age": 86400
}})
'''

# Добавьте обработчик OPTIONS
@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return '', 200

load_dotenv()

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
    # Загружаем промт для языка
    prompt_template = load_prompt_template(native_lang)
    
    # Заменяем плейсхолдеры в промте
    prompt = prompt_template.format(count=count, theme=theme)
    
    # Вызываем ИИ
    response = generate_phrases(prompt)
    
    if not response:
        print(f"No response to request: {prompt}");
        return None
    
    # Парсим ответ
    phrases = parse_ai_response(response)
    
    # Преобразуем в нужный формат
    if phrases:
        formatted_phrases = []
        for phrase in phrases:
            if isinstance(phrase, dict):
                # Стандартизируем ключи
                formatted_phrase = {}
                
                # Английская фраза
                if 'en' in phrase:
                    formatted_phrase['en'] = phrase['en']
                elif 'english' in phrase:
                    formatted_phrase['en'] = phrase['english']
                else:
                    continue  # Пропускаем если нет английского
                
                # Перевод на родной язык
                if native_lang in phrase:
                    formatted_phrase['native'] = phrase[native_lang]
                elif 'russian' in phrase and native_lang == 'ru':
                    formatted_phrase['native'] = phrase['russian']
                elif 'translation' in phrase:
                    formatted_phrase['native'] = phrase['translation']
                else:
                    continue  # Пропускаем если нет перевода
                
                formatted_phrases.append(formatted_phrase)
        
        return formatted_phrases  # Ограничиваем 50 фразами
    
    print(f"No phrases for the query: {prompt}");
    return None

@app.route('/phrases/generate-phrases', methods=['POST'])
def generate_phrases_endpoint():
    """Эндпоинт генерации фраз"""
    # Получаем данные из запроса
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    logger.debug("Отладочное сообщение")
    
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
        return jsonify({'error': 'Unknown reasone failed to generate phrases'}), 500
    
    # Сохраняем в кеш
    phrases_json = json.dumps(phrases, ensure_ascii=False)
    save_to_cache(cache_key, native_lang, target_lang, theme, phrases_json)
    
    return jsonify({
        'phrases': phrases,
        'cached': False,
        'count': len(phrases)
    })

@app.route('/phrases/health', methods=['GET'])
def health_check():
    """Эндпоинт проверки здоровья сервера"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'supported_languages': list(SUPPORTED_LANGUAGES.keys())
    })

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    # ... ваш код инициализации ...
    
    # Проверяем, есть ли переменная окружения от systemd socket активации
    listen_fds = os.environ.get('LISTEN_FDS', 'False').lower() == 'true'
    
    if listen_fds:
        # Используем сокет от systemd
        fd = 3  # Первый файловый дескриптор после stdin, stdout, stderr
        sock = socket.fromfd(fd, socket.AF_INET, socket.SOCK_STREAM)
        run_simple('localhost', 0, app, threaded=True, ssl_context=None, fd=sock.fileno())
    else:
        debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
        # Запуск вручную (для отладки)
        app.run(host='0.0.0.0', port=os.environ.get('PORT', 5002), debug=debug_mode)