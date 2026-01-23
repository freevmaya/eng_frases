#!/bin/bash
# setup.sh - установка окружения для SpeechGenerator

echo "Создание виртуальной среды..."
python3 -m venv venv

echo "Активация среды..."
source myenv\Scripts\Activate.ps1

echo "Обновление pip..."
pip install --upgrade pip

echo "Установка зависимостей..."
pip install -r requirements.txt

echo "Проверка установки..."
python -c "
try:
    import pyttsx3
    from gtts import gTTS
    print('✓ Все зависимости успешно установлены!')
except ImportError as e:
    print(f'✗ Ошибка: {e}')
"

echo "Готово! Активируйте среду командой: source venv/bin/activate"