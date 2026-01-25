from flask import Flask, request, jsonify
from classes.SpeechGenerator import SpeechGenerator
import os
from pathlib import Path

app = Flask(__name__)

# Конфигурация
BASE_OUTPUT_DIR = "../public/data/audio_files_male"
JSON_FILE_PATH = "../public/data/en-ru.json"

# Инициализация генератора речи
speech_generator = SpeechGenerator(BASE_OUTPUT_DIR)

# CORS Middleware - ТОЛЬКО ЭТОТ КОД
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
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

@app.route('/api/generate-audio', methods=['POST'])
def generate_audio():
    """
    Обработка запроса на генерацию аудио
    """
    try:
        # Получение данных из запроса
        data = request.json
        
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
        
        # Проверка обязательных полей
        text = data.get('text', '').strip()
        language = data.get('language', 'en').strip().lower()
        category = data.get('type', '').strip()
        
        if not text:
            return jsonify({
                "status": "error",
                "message": "Text field is required"
            }), 400
        
        if language not in ['en', 'ru']:
            return jsonify({
                "status": "error",
                "message": "Language must be 'en' or 'ru'"
            }), 400
        
        # Проверка существования файла
        check_result = speech_generator.check_audio_exists(text, language, category)
        
        if check_result['exists']:
            return jsonify({
                "status": "ok",
                "message": "Audio file already exists",
                "data": {
                    "filename": check_result['filename'],
                    "category": category or "root"
                }
            }), 200
        
        # Если файл не найден, пробуем найти в других категориях
        if category:
            found_file = speech_generator.find_audio_file(text, language)
            if found_file:
                return jsonify({
                    "status": "ok",
                    "message": "Audio file found in another category",
                    "data": {
                        "filename": found_file['filename'],
                        "category": found_file['category'] or "root"
                    }
                }), 200
        
        # Генерация нового аудиофайла
        print(f"\nГенерация аудио для: '{text[:50]}...'")
        print(f"Язык: {language}, Категория: {category or 'root'}")
        
        generation_result = speech_generator.generate_audio(text, language, category)
        
        if generation_result:
            if generation_result.get('already_exists'):
                return jsonify({
                    "status": "ok",
                    "message": "Audio file already exists (generated during check)",
                    "data": {
                        "filename": generation_result['filename'],
                        "category": category or "root"
                    }
                }), 200
            else:
                return jsonify({
                    "status": "success",
                    "message": "Audio file generated successfully",
                    "data": {
                        "filename": generation_result['filename'],
                        "file_size_kb": round(generation_result['file_size'] / 1024, 2),
                        "category": category or "root"
                    }
                }), 201
        else:
            return jsonify({
                "status": "error",
                "message": "Failed to generate audio file"
            }), 500
            
    except Exception as e:
        print(f"Ошибка при обработке запроса: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/check-audio', methods=['POST'])
def check_audio():
    """
    Проверка существования аудиофайла
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
        
        text = data.get('text', '').strip()
        language = data.get('language', 'en').strip().lower()
        category = data.get('type', '').strip()
        
        if not text:
            return jsonify({
                "status": "error",
                "message": "Text field is required"
            }), 400
        
        # Поиск файла
        found_file = speech_generator.find_audio_file(text, language)
        
        if found_file:
            return jsonify({
                "status": "found",
                "message": "Audio file found",
                "data": found_file
            }), 200
        else:
            return jsonify({
                "status": "not_found",
                "message": "Audio file not found",
                "data": {
                    "text": text,
                    "language": language,
                    "category": category
                }
            }), 200
            
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Проверка работоспособности сервера
    """
    try:
        # Проверка директорий
        base_dir = Path(BASE_OUTPUT_DIR)
        json_file = Path(JSON_FILE_PATH)
        
        checks = {
            "server": "running",
            "audio_directory": base_dir.exists(),
            "json_file": json_file.exists(),
            "internet_connection": speech_generator._check_internet_connection()
        }
        
        all_ok = all(checks.values())
        
        return jsonify({
            "status": "healthy" if all_ok else "degraded",
            "checks": checks
        }), 200 if all_ok else 503
        
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/api/get-audio/<path:filename>', methods=['GET'])
def get_audio(filename):
    """
    Получение аудиофайла
    """
    try:
        # Безопасная обработка пути
        safe_filename = os.path.basename(filename)
        
        # Поиск файла в разных категориях
        categories = speech_generator._get_all_categories()
        
        for category in categories + [None]:
            if category:
                filepath = Path(BASE_OUTPUT_DIR) / category / safe_filename
            else:
                filepath = Path(BASE_OUTPUT_DIR) / safe_filename
            
            if filepath.exists():
                from flask import send_file
                return send_file(str(filepath), mimetype='audio/mpeg')
        
        return jsonify({
            "status": "error",
            "message": "Audio file not found"
        }), 404
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Создание необходимых директорий
    Path(BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    print("="*60)
    print("Сервер генерации аудиофайлов запущен")
    print("="*60)
    print(f"Базовая директория: {os.path.abspath(BASE_OUTPUT_DIR)}")
    print(f"JSON файл: {os.path.abspath(JSON_FILE_PATH)}")
    print(f"CORS настроен для всех доменов")
    print(f"\nДоступные эндпоинты:")
    print(f"  POST /api/generate-audio - генерация одного аудиофайла")
    print(f"  POST /api/check-audio    - проверка существования файла")
    print(f"  GET  /api/health         - проверка работоспособности")
    print(f"  GET  /api/get-audio/<filename> - получение аудиофайла")
    print("="*60)
    
    # Запуск сервера
    app.run(host='0.0.0.0', port=5000, debug=True)