# ============================================================
# FILE: .\test-server.py
# TYPE: .PY
# ============================================================

import sys
import os
from pathlib import Path

# Настройка путей для локального тестирования
TEST_BASE_DIR = os.path.abspath("../public/data/voices")

# Устанавливаем переменные окружения для server.py
os.environ['BASE_AUDIO_DIR'] = TEST_BASE_DIR

# Создаем тестовую директорию
Path(TEST_BASE_DIR).mkdir(parents=True, exist_ok=True)

print(f"Test Server Configuration:")
print(f"TEST_BASE_DIR: {TEST_BASE_DIR}")

# Патчим server.py для использования тестовых путей
import server

# Сохраняем оригинальные значения
original_base_audio_dir = getattr(server, 'BASE_AUDIO_DIR', None)
original_json_file_path = getattr(server, 'JSON_FILE_PATH', None)

# Заменяем на тестовые
server.BASE_AUDIO_DIR = TEST_BASE_DIR
server.BASE_OUTPUT_DIR = TEST_BASE_DIR

# Переинициализируем генератор речи
try:
    # Удаляем старый генератор, если существует
    if hasattr(server, 'speech_generator'):
        delattr(server, 'speech_generator')
    
    # Создаем новый с тестовыми путями
    server.speech_generator = server.SpeechGenerator(
        server.BASE_OUTPUT_DIR, 
        use_edge_tts=True
    )
    print("✓ SpeechGenerator инициализирован успешно с тестовыми путями")
except Exception as e:
    print(f"✗ Ошибка инициализации SpeechGenerator: {e}")
    import traceback
    traceback.print_exc()

# Получаем Flask app из server.py
app = server.app

if __name__ == '__main__':
    print("\n" + "="*60)
    print("TEST SERVER STARTED")
    print("="*60)
    print(f"Server running on: http://localhost:5001")
    print(f"Audio directory: {TEST_BASE_DIR}")
    print(f"Engine: Edge-TTS")
    print(f"\nAvailable endpoints:")
    print(f"  POST /api/generate-audio - Generate audio with gender/voice options")
    print(f"  POST /api/check-audio    - Check audio exists")
    print(f"  GET  /api/get-voices     - Get available voices")
    print(f"  GET  /api/health         - Health check")
    print(f"  GET  /api/get-audio/<filename> - Get audio file")
    print("\nExample CURL commands:")
    print(f"  curl -X POST http://localhost:5001/api/health")
    print(f"  curl -X POST http://localhost:5001/api/generate-audio \\")
    print(f"       -H \"Content-Type: application/json\" \\")
    print(f"       -d '\\{{\"text\":\"Hello world\",\"language\":\"en\",\"gender\":\"female\"\\}}'")
    print("="*60)
    
    # Запускаем сервер на порту 5001 для тестирования
    try:
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
    finally:
        # Восстанавливаем оригинальные значения
        if original_base_audio_dir:
            server.BASE_AUDIO_DIR = original_base_audio_dir
        if original_json_file_path:
            server.JSON_FILE_PATH = original_json_file_path
        print("✓ Original configuration restored")