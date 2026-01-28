# ============================================================
# FILE: .\dev-server.py (модифицированный)
# TYPE: .PY
# ============================================================

from flask import Flask, request, jsonify
from classes.SpeechGenerator import SpeechGenerator
import os
from pathlib import Path

app = Flask(__name__)

# Конфигурация
BASE_OUTPUT_DIR = "../public/data/voices"
JSON_FILE_PATH = "../public/data/en-ru.json"

# Инициализация генератора речи с Edge-TTS
speech_generator = SpeechGenerator(BASE_OUTPUT_DIR, use_edge_tts=True)

# CORS Middleware - ТОЛЬКО ЭТОТ КОД
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
        
        # Новые параметры для Edge-TTS
        gender = data.get('gender', 'male').strip().lower()
        voice_name = data.get('voice_name', '').strip()
        
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
        
        if gender not in ['male', 'female']:
            return jsonify({
                "status": "error",
                "message": "Gender must be 'male' or 'female'"
            }), 400
        
        # Проверка существования файла (с учетом гендера)
        check_result = speech_generator.check_audio_exists(text, language, gender=gender)
        
        if check_result['exists']:
            return jsonify({
                "status": "ok",
                "message": "Audio file already exists",
                "data": {
                    "filename": check_result['filename'],
                    "gender": gender,
                    "category": category or "root"
                }
            }), 200
        
        # Если файл не найден, пробуем найти в других категориях
        if category:
            found_file = speech_generator.find_audio_file(text, language, gender=gender)
            if found_file:
                return jsonify({
                    "status": "ok",
                    "message": "Audio file found in another category",
                    "data": {
                        "filename": found_file['filename'],
                        "gender": found_file.get('gender', gender),
                        "category": found_file['category'] or "root"
                    }
                }), 200
        
        # Генерация нового аудиофайла
        print(f"\nГенерация аудио для: '{text[:50]}...'")
        print(f"Язык: {language}, Гендер: {gender}, Категория: {category or 'root'}")
        if voice_name:
            print(f"Голос: {voice_name}")
        
        generation_result = speech_generator.generate_audio(
            text, language, category, gender, voice_name if voice_name else None
        )
        
        if generation_result:
            if generation_result.get('already_exists'):
                return jsonify({
                    "status": "ok",
                    "message": "Audio file already exists (generated during check)",
                    "data": {
                        "filename": generation_result['filename'],
                        "gender": gender,
                        "voice": generation_result.get('voice', 'default'),
                        "category": category or "root"
                    }
                }), 200
            else:
                return jsonify({
                    "status": "success",
                    "message": "Audio file generated successfully",
                    "data": {
                        "filename": generation_result['filename'],
                        "gender": gender,
                        "voice": generation_result.get('voice', 'default'),
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
        gender = data.get('gender', 'male').strip().lower()
        
        if not text:
            return jsonify({
                "status": "error",
                "message": "Text field is required"
            }), 400
        
        # Поиск файла
        found_file = speech_generator.find_audio_file(text, language, gender=gender)
        
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
                    "gender": gender,
                    "category": category
                }
            }), 200
            
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500

@app.route('/api/get-voices', methods=['GET'])
def get_voices():
    """
    Получение списка доступных голосов
    """
    try:
        language = request.args.get('language', 'en').strip().lower()
        gender = request.args.get('gender', '').strip().lower()
        
        if language not in ['en', 'ru']:
            return jsonify({
                "status": "error",
                "message": "Language must be 'en' or 'ru'"
            }), 400
        
        if gender and gender not in ['male', 'female']:
            return jsonify({
                "status": "error",
                "message": "Gender must be 'male', 'female' or empty for all"
            }), 400
        
        voices = speech_generator.get_available_voices(language, gender if gender else None)
        
        return jsonify({
            "status": "success",
            "data": {
                "language": language,
                "gender": gender if gender else "all",
                "voices": voices,
                "count": len(voices)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}"
        }), 500

# Остальные эндпоинты остаются без изменений...
# health_check, get_audio и т.д.

if __name__ == '__main__':
    # Создание необходимых директорий
    Path(BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    print("="*60)
    print("Сервер генерации аудиофайлов с Edge-TTS запущен")
    print("="*60)
    print(f"Базовая директория: {os.path.abspath(BASE_OUTPUT_DIR)}")
    print(f"JSON файл: {os.path.abspath(JSON_FILE_PATH)}")
    print(f"Используется движок: Edge-TTS")
    print(f"\nДоступные эндпоинты:")
    print(f"  POST /api/generate-audio - генерация аудио (с параметрами gender и voice_name)")
    print(f"  POST /api/check-audio    - проверка существования файла")
    print(f"  GET  /api/get-voices     - получение списка голосов")
    print(f"  GET  /api/health         - проверка работоспособности")
    print(f"  GET  /api/get-audio/<filename> - получение аудиофайла")
    print("="*60)
    
    # Показываем доступные голоса
    #print("\nПроверка доступных голосов Edge-TTS:")
    #speech_generator.list_all_voices()
    
    # Запуск сервера
    app.run(host='0.0.0.0', port=5000, debug=True)