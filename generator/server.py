# ============================================================
# FILE: .\server.py (исправленный - расширенные CORS)
# TYPE: .PY
# ============================================================

import sys
import os
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from datetime import datetime

app = Flask(__name__)

# Получаем путь к директории с аудиофайлами из переменной окружения
# или используем значение по умолчанию
BASE_AUDIO_DIR = os.environ.get('BASE_AUDIO_DIR', 
    os.path.abspath("/home/vmaya/www/eng_frases/public/data/voices"))

# Инициализация генератора речи с Edge-TTS
# Используем ту же директорию для Edge-TTS
BASE_OUTPUT_DIR = BASE_AUDIO_DIR

# Убедимся, что директория существует
Path(BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

print(f"Инициализация SpeechGenerator...")
print(f"BASE_OUTPUT_DIR: {BASE_OUTPUT_DIR}")

try:
    # Добавляем путь к модулям
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from classes.SpeechGenerator import SpeechGenerator
    
    # Инициализация генератора речи с Edge-TTS
    speech_generator = SpeechGenerator(BASE_OUTPUT_DIR, use_edge_tts=True)
    print("✓ SpeechGenerator инициализирован успешно")
    
except Exception as e:
    print(f"✗ Ошибка инициализации SpeechGenerator: {e}")
    import traceback
    traceback.print_exc()
    # Создаем заглушку для тестирования
    class DummySpeechGenerator:
        def __init__(self):
            self.base_dir = BASE_OUTPUT_DIR
        
        def check_audio_exists(self, text, language='en', gender=None):
            return {'exists': False}
        
        def find_audio_file(self, text, language='en', gender=None):
            # Тестовая реализация для отладки
            filename = f"{language}_{hashlib.md5(text.encode('utf-8')).hexdigest()}.mp3"
            filepath = Path(self.base_dir) / "female" / language / filename
            
            if filepath.exists():
                return {
                    'exists': True,
                    'text': text,
                    'language': language,
                    'gender': 'female',
                    'filename': filename,
                    'filepath': str(filepath),
                    'engine': 'edge_tts'
                }
            return None
        
        def generate_audio(self, text, language='en', gender=None, voice_name=None):
            return None
        
        def get_available_voices(self, language='en', gender=None):
            return []
        
        def _check_internet_connection(self):
            return True
        
        def _get_all_categories(self):
            # Простая реализация для тестирования
            base_dir = Path(self.base_dir)
            categories = []
            if base_dir.exists():
                for item in base_dir.iterdir():
                    if item.is_dir():
                        categories.append(item.name)
            return categories
    
    speech_generator = DummySpeechGenerator()
    print("⚠️ Используется заглушка SpeechGenerator")

@app.before_request
def handle_options():
    """
    Обработка предварительных запросов OPTIONS
    """
    if request.method == 'OPTIONS':
        response = jsonify({
            'status': 'preflight',
            'message': 'CORS preflight request handled',
            'timestamp': str(datetime.now())
        })
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Max-Age'] = '86400'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

@app.route('/api/generate-audio', methods=['POST'])
def generate_audio():
    """
    Обработка запроса на генерацию аудио с поддержкой Edge-TTS
    """
    try:
        # Логируем входящий запрос
        print(f"\n[{datetime.now()}] POST /api/generate-audio")
        #print(f"Headers: {dict(request.headers)}")
        #print(f"Remote IP: {request.remote_addr}")
        
        # Получение данных из запроса
        data = request.json
        
        if not data:
            print("Ошибка: нет JSON данных")
            return jsonify({
                "status": "error",
                "message": "No JSON data provided",
                "timestamp": str(datetime.now())
            }), 400
        
        print(f"Data received: {data}")
        
        # Проверка обязательных полей
        text = data.get('text', '').strip()
        language = data.get('language', 'en').strip().lower()
        
        # Новые параметры для Edge-TTS
        gender = data.get('gender', 'male').strip().lower()
        voice_name = data.get('voice_name', '').strip()
        
        if not text:
            print("Ошибка: пустой текст")
            return jsonify({
                "status": "error",
                "message": "Text field is required",
                "timestamp": str(datetime.now())
            }), 400
        
        if language not in ['en', 'ru']:
            print(f"Ошибка: неправильный язык {language}")
            return jsonify({
                "status": "error",
                "message": "Language must be 'en' or 'ru'",
                "timestamp": str(datetime.now())
            }), 400
        
        if gender not in ['male', 'female']:
            print(f"Ошибка: неправильный гендер {gender}")
            return jsonify({
                "status": "error",
                "message": "Gender must be 'male' or 'female'",
                "timestamp": str(datetime.now())
            }), 400
        
        print(f"Processing: text='{text[:50]}...', language={language}, gender={gender}")
        
        # Проверка существования файла (с учетом гендера)
        check_result = speech_generator.check_audio_exists(text, language, gender=gender)
        
        if check_result['exists']:
            print(f"Файл уже существует: {check_result.get('filename', 'unknown')}")
            return jsonify({
                "status": "ok",
                "message": "Audio file already exists",
                "data": {
                    "filename": check_result['filename'],
                    "gender": gender
                },
                "timestamp": str(datetime.now())
            }), 200
        
        # Генерация нового аудиофайла
        print(f"Генерация нового аудиофайла...")
        print(f"Язык: {language}, Гендер: {gender}")
        if voice_name:
            print(f"Голос: {voice_name}")
        
        generation_result = speech_generator.generate_audio(
            text, language, gender=gender, voice_name=voice_name if voice_name else None
        )
        
        if generation_result:
            if generation_result.get('already_exists'):
                print(f"Файл создан в процессе проверки: {generation_result.get('filename', 'unknown')}")
                return jsonify({
                    "status": "ok",
                    "message": "Audio file already exists (generated during check)",
                    "data": {
                        "filename": generation_result['filename'],
                        "gender": gender,
                        "voice": generation_result.get('voice', 'default')
                    },
                    "timestamp": str(datetime.now())
                }), 200
            else:
                print(f"Новый файл создан: {generation_result.get('filename', 'unknown')}")
                return jsonify({
                    "status": "success",
                    "message": "Audio file generated successfully",
                    "data": {
                        "filename": generation_result['filename'],
                        "gender": gender,
                        "voice": generation_result.get('voice', 'default'),
                        "file_size_kb": round(generation_result['file_size'] / 1024, 2)
                    },
                    "timestamp": str(datetime.now())
                }), 201
        else:
            print("Ошибка: не удалось сгенерировать аудиофайл")
            return jsonify({
                "status": "error",
                "message": "Failed to generate audio file",
                "timestamp": str(datetime.now())
            }), 500
            
    except Exception as e:
        print(f"Критическая ошибка при обработке запроса: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}",
            "timestamp": str(datetime.now())
        }), 500

# Добавляем новый эндпоинт для получения списка голосов
@app.route('/api/get-voices', methods=['GET'])
def get_voices():
    """
    Получение списка доступных голосов Edge-TTS
    """
    try:
        print(f"\n[{datetime.now()}] GET /api/get-voices")
        print(f"Query params: {request.args}")
        
        language = request.args.get('language', 'en').strip().lower()
        gender = request.args.get('gender', '').strip().lower()
        
        if language not in ['en', 'ru']:
            return jsonify({
                "status": "error",
                "message": "Language must be 'en' or 'ru'",
                "timestamp": str(datetime.now())
            }), 400
        
        if gender and gender not in ['male', 'female']:
            return jsonify({
                "status": "error",
                "message": "Gender must be 'male', 'female' or empty for all",
                "timestamp": str(datetime.now())
            }), 400
        
        voices = speech_generator.get_available_voices(language, gender if gender else None)
        
        print(f"Returning {len(voices)} voices for language={language}, gender={gender}")
        
        return jsonify({
            "status": "success",
            "data": {
                "language": language,
                "gender": gender if gender else "all",
                "voices": voices,
                "count": len(voices)
            },
            "timestamp": str(datetime.now())
        }), 200
        
    except Exception as e:
        print(f"Ошибка в /api/get-voices: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}",
            "timestamp": str(datetime.now())
        }), 500

@app.route('/api/check-audio', methods=['POST'])
def check_audio():
    """
    Проверка существования аудиофайла
    """
    try:
        # Логируем входящий запрос
        print(f"\n[{datetime.now()}] POST /api/check-audio")
        #print(f"Headers: {dict(request.headers)}")
        #print(f"Remote IP: {request.remote_addr}")
        
        data = request.json
        
        if not data:
            print("Ошибка: нет JSON данных")
            return jsonify({
                "status": "error",
                "message": "No JSON data provided",
                "timestamp": str(datetime.now())
            }), 400
        
        print(f"Data received: {data}")
        
        text = data.get('text', '').strip()
        language = data.get('language', 'en').strip().lower()
        gender = data.get('gender', 'male').strip().lower()
        
        if not text:
            print("Ошибка: пустой текст")
            return jsonify({
                "status": "error",
                "message": "Text field is required",
                "timestamp": str(datetime.now())
            }), 400
        
        print(f"Searching for: text='{text[:50]}...', language={language}, gender={gender}")
        
        # Поиск файла
        found_file = speech_generator.find_audio_file(text, language, gender=gender)
        
        if found_file:
            print(f"Файл найден: {found_file.get('filename', 'unknown')}")
            return jsonify({
                "status": "found",
                "message": "Audio file found",
                "data": found_file,
                "gender": gender,
                "timestamp": str(datetime.now())
            }), 200
        else:
            print("Файл не найден")
            return jsonify({
                "status": "not_found",
                "message": "Audio file not found",
                "data": {
                    "text": text,
                    "language": language
                },
                "gender": gender,
                "timestamp": str(datetime.now())
            }), 200
            
    except Exception as e:
        print(f"Ошибка в /api/check-audio: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}",
            "timestamp": str(datetime.now())
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Проверка работоспособности сервера
    """
    try:
        print(f"\n[{datetime.now()}] GET /api/health")
        
        # Проверка директорий
        base_dir = Path(BASE_OUTPUT_DIR)
        
        checks = {
            "server": "running",
            "audio_directory": base_dir.exists(),
            "base_output_dir": BASE_OUTPUT_DIR,
            "json_file": json_file.exists(),
            "internet_connection": speech_generator._check_internet_connection() if hasattr(speech_generator, '_check_internet_connection') else True,
            "timestamp": str(datetime.now())
        }
        
        all_ok = all([checks.get('audio_directory'), checks.get('json_file'), checks.get('internet_connection')])
        
        status = "healthy" if all_ok else "degraded"
        print(f"Health check: {status}")
        
        return jsonify({
            "status": status,
            "checks": checks
        }), 200 if all_ok else 503
        
    except Exception as e:
        print(f"Ошибка в health check: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": str(datetime.now())
        }), 500

@app.route('/api/get-audio/<path:filename>', methods=['GET'])
def get_audio(filename):
    """
    Получение аудиофайла
    """
    try:
        print(f"\n[{datetime.now()}] GET /api/get-audio/{filename}")
        
        # Безопасная обработка пути
        safe_filename = os.path.basename(filename)
        print(f"Looking for file: {safe_filename}")
        
        # Ищем во всех возможных местах
        search_paths = []
        
        # Сначала в структуре gender/language
        for gender in ['male', 'female']:
            for lang in ['en', 'ru']:
                search_paths.append(Path(BASE_OUTPUT_DIR) / gender / lang / safe_filename)
        
        # Затем в структуре language
        for lang in ['en', 'ru']:
            search_paths.append(Path(BASE_OUTPUT_DIR) / lang / safe_filename)
        
        # Ищем в категориях если доступно
        if hasattr(speech_generator, '_get_all_categories'):
            categories = speech_generator._get_all_categories()
            for category in categories:
                search_paths.append(Path(BASE_OUTPUT_DIR) / category / safe_filename)
        
        # И в корне
        search_paths.append(Path(BASE_OUTPUT_DIR) / safe_filename)
        
        # Ищем файл
        for filepath in search_paths:
            if filepath.exists() and filepath.is_file():
                print(f"Found file at: {filepath}")
                return send_file(str(filepath), mimetype='audio/mpeg')
        
        print(f"File not found in {len(search_paths)} locations")
        return jsonify({
            "status": "error",
            "message": "Audio file not found",
            "searched_paths": [str(p) for p in search_paths],
            "timestamp": str(datetime.now())
        }), 404
        
    except Exception as e:
        print(f"Ошибка в /api/get-audio: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}",
            "timestamp": str(datetime.now())
        }), 500

# Простой тестовый эндпоинт для проверки
@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """
    Тестовый эндпоинт для проверки подключения
    """
    return jsonify({
        "status": "success",
        "message": "Server is working!",
        "timestamp": str(datetime.now()),
        "endpoints": {
            "generate_audio": "POST /api/generate-audio",
            "check_audio": "POST /api/check-audio",
            "get_voices": "GET /api/get-voices",
            "health": "GET /api/health",
            "get_audio": "GET /api/get-audio/<filename>"
        }
    }), 200

# Эндпоинт для получения информации о сервере
@app.route('/api/info', methods=['GET'])
def server_info():
    """
    Информация о сервере
    """
    return jsonify({
        "status": "success",
        "server": "Audio Generator API",
        "version": "1.0.0",
        "engine": "Edge-TTS",
        "base_directory": BASE_OUTPUT_DIR,
        "timestamp": str(datetime.now())
    }), 200

if __name__ == '__main__':

    # CORS Middleware
    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        if response.content_type.startswith('application/json') or response.is_json:
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response

    @app.before_request
    def handle_options():
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'preflight'})
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept'
            response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
            response.headers['Access-Control-Max-Age'] = '86400'
            return response 

            
    # Создание необходимых директорий
    Path(BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    print("="*60)
    print("Сервер генерации аудиофайлов с Edge-TTS запущен")
    print("="*60)
    print(f"Базовая директория: {os.path.abspath(BASE_OUTPUT_DIR)}")
    print(f"Используется движок: Edge-TTS")
    print(f"\nДоступные эндпоинты:")
    print(f"  GET  /api/test         - тестовый эндпоинт")
    print(f"  GET  /api/info         - информация о сервере")
    print(f"  POST /api/generate-audio - генерация аудио")
    print(f"  POST /api/check-audio    - проверка существования файла")
    print(f"  GET  /api/get-voices     - получение списка голосов")
    print(f"  GET  /api/health         - проверка работоспособности")
    print(f"  GET  /api/get-audio/<filename> - получение аудиофайла")
    print("="*60)
    print(f"\nСервер запущен: {datetime.now()}")
    print("Ожидание запросов...")
    
    # Запуск сервера
    app.run(host='0.0.0.0', port=5000, debug=True)