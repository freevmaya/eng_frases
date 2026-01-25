from gtts import gTTS
import json
import hashlib
import os
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import requests

class SpeechGenerator:
    def __init__(self, base_output_dir: Optional[str] = None):
        """
        Инициализация генератора речи с использованием gTTS
        
        Args:
            base_output_dir: Базовая директория для сохранения аудиофайлов
        """
        self.phrases_data = None
        
        # Директория для сохранения аудиофайлов
        self.BASE_OUTPUT_DIR = base_output_dir or "../public/data/audio_files_gtts"
        Path(self.BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
        
        # Настройки для gTTS
        self.LANGUAGE_MAP = {
            'target': 'en',    # Английский
            'native': 'ru'     # Русский
        }
        
        # Задержка между запросами (чтобы не превысить лимиты)
        self.REQUEST_DELAY = 0.5
        
        # Проверяем интернет-соединение
        self._check_internet_connection()
    
    def _check_internet_connection(self) -> bool:
        """
        Проверка интернет-соединения
        
        Returns:
            bool: True если есть соединение
        """
        try:
            requests.get('https://www.google.com', timeout=5)
            print("✓ Интернет-соединение доступно")
            return True
        except requests.ConnectionError:
            print("✗ Нет интернет-соединения. gTTS требует интернет.")
            return False
    
    def _get_language_settings(self, phrase_type: str) -> Tuple[str, str, float]:
        """
        Получение настроек языка для gTTS
        
        Args:
            phrase_type: Тип фразы ('target' или 'native')
        
        Returns:
            tuple: (языковой код, tld акцент, скорость)
        """
        if phrase_type == 'target':
            return ('en', 'com', 1.0)  # Американский английский
        else:  # 'native'
            return ('ru', 'com', 0.9)  # Немного медленнее для русского
    
    def load_json_data(self, json_file_path: str) -> Dict:
        """
        Загрузка данных из JSON файла
        
        Args:
            json_file_path: Путь к JSON файлу
        
        Returns:
            dict: Загруженные данные
        """
        if not os.path.exists(json_file_path):
            raise FileNotFoundError(f"JSON файл не найден: {json_file_path}")
        
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                self.phrases_data = json.load(f)
            print(f"✓ Загружено {len(self.phrases_data)} категорий фраз")
            return self.phrases_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Ошибка чтения JSON файла: {e}")
    
    def _generate_filename(self, phrase: str, language: str = 'en') -> str:
         # Нормализуем фразу (удаляем лишние пробелы, приводим к нижнему регистру)
        normalized_phrase = ' '.join(phrase.strip().split()).lower()
        
        # Создаем MD5 хэш нормализованной фразы
        phrase_hash = hashlib.md5(normalized_phrase.encode('utf-8')).hexdigest()
        
        # Формат: language_hash.mp3
        return f"{language}_{phrase_hash}.mp3"
    
    def generate_audio(self, text: str, language: str = 'en', 
                      category: Optional[str] = None) -> Optional[Dict]:
        """
        Генерация аудиофайла для фразы с использованием gTTS
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            category: Категория (опционально)
        
        Returns:
            dict: Информация о сгенерированном файле или None при ошибке
        """
        if not text or not isinstance(text, str):
            print("✗ Пустая фраза")
            return None
        
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, language)
        
        # Создаем подпапку для языка
        save_dir = Path(self.BASE_OUTPUT_DIR) / language
        
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            print(f"✓ Файл уже существует: {filename}")
            return {
                'text': text,
                'language': language,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True
            }
        
        # Получаем настройки языка
        lang, tld, _ = self._get_language_settings('target' if language == 'en' else 'native')
        
        try:
            print(f"  Генерация аудио для: '{text[:50]}...'")
            
            # Создаем gTTS объект
            tts = gTTS(
                text=text,
                lang=lang,
                tld=tld,
                slow=False
            )
            
            # Сохраняем в файл
            tts.save(str(filepath))
            
            # Добавляем задержку между запросами
            time.sleep(self.REQUEST_DELAY)
            
            # Проверяем, что файл создан
            if filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                print(f"  ✓ Создан: {filename} ({file_size_kb:.1f} KB)")
                
                return {
                    'text': text,
                    'language': language,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False
                }
            else:
                print(f"✗ Ошибка: файл не создан или пустой: {filename}")
                return None
                
        except Exception as e:
            print(f"✗ Ошибка при генерации аудио для '{text[:30]}...': {str(e)}")
            return None
    
    def check_audio_exists(self, text: str, language: str = 'en', 
                          category: Optional[str] = None) -> Dict:
        """
        Проверка существования аудиофайла для фразы
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            category: Категория (опционально)
        
        Returns:
            dict: Информация о существовании файла
        """
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, language)
        
        # Путь к файлу в подпапке языка
        filepath = Path(self.BASE_OUTPUT_DIR) / language / filename
        
        exists = filepath.exists() and filepath.stat().st_size > 0
        
        return {
            'exists': exists,
            'text': clean_text,
            'language': language,
            'filename': filename,
            'filepath': str(filepath) if exists else None,
            'category': category
        }
    
    def find_audio_file(self, text: str, language: str = 'en', 
                       categories: Optional[List[str]] = None) -> Optional[Dict]:
        """
        Поиск аудиофайла в разных категориях
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            categories: Список категорий для поиска
        
        Returns:
            dict: Информация о найденном файле или None
        """
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        filename = self._generate_filename(clean_text, language)
        
        # Проверяем в подпапке языка
        lang_filepath = Path(self.BASE_OUTPUT_DIR) / language / filename
        if lang_filepath.exists() and lang_filepath.stat().st_size > 0:
            return {
                'exists': True,
                'text': clean_text,
                'language': language,
                'filename': filename,
                'filepath': str(lang_filepath),
                'category': None
            }
        
        # Для обратной совместимости проверяем в старых категориях
        if categories:
            for category in categories:
                filepath = Path(self.BASE_OUTPUT_DIR) / category / filename
                if filepath.exists() and filepath.stat().st_size > 0:
                    return {
                        'exists': True,
                        'text': clean_text,
                        'language': language,
                        'filename': filename,
                        'filepath': str(filepath),
                        'category': category
                    }
        
        # Также проверяем в корневой директории для обратной совместимости
        root_filepath = Path(self.BASE_OUTPUT_DIR) / filename
        if root_filepath.exists() and root_filepath.stat().st_size > 0:
            return {
                'exists': True,
                'text': clean_text,
                'language': language,
                'filename': filename,
                'filepath': str(root_filepath),
                'category': None
            }
        
        return None
    
    def _get_all_categories(self) -> List[str]:
        """
        Получение всех категорий из директории
        
        Returns:
            list: Список категорий
        """
        categories = []
        base_dir = Path(self.BASE_OUTPUT_DIR)
        
        if base_dir.exists():
            for item in base_dir.iterdir():
                if item.is_dir():
                    categories.append(item.name)
        
        return categories
    
    def cleanup(self):
        """Очистка (gTTS не требует специальной очистки)"""
        pass