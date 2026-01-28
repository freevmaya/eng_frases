# ============================================================
# FILE: .\classes\SpeechGenerator.py (модифицированный)
# TYPE: .PY
# ============================================================

from gtts import gTTS
import json
import hashlib
import os
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import requests
from .EdgeTTSGenerator import EdgeTTSGenerator

class SpeechGenerator:
    def __init__(self, base_output_dir: Optional[str] = None, use_edge_tts: bool = True):
        """
        Инициализация генератора речи с возможностью выбора движка
        
        Args:
            base_output_dir: Базовая директория для сохранения аудиофайлов
            use_edge_tts: Использовать Edge-TTS (True) или gTTS (False)
        """
        self.phrases_data = None
        
        # Выбираем движок
        self.use_edge_tts = use_edge_tts
        
        if use_edge_tts:
            # Используем Edge-TTS
            self.engine_type = 'edge_tts'
            self.edge_tts_generator = EdgeTTSGenerator(base_output_dir)
            self.BASE_OUTPUT_DIR = base_output_dir or "../public/data/voices"
        else:
            # Используем gTTS
            self.engine_type = 'gtts'
            self.BASE_OUTPUT_DIR = base_output_dir or "../public/data/voices"
        
        Path(self.BASE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
        
        # Настройки для gTTS
        self.LANGUAGE_MAP = {
            'target': 'en',    # Английский
            'native': 'ru'     # Русский
        }
        
        # Задержка между запросами
        self.REQUEST_DELAY = 0.5
        
        # Проверяем интернет-соединение
        self._check_internet_connection()
    
    def _check_internet_connection(self) -> bool:
        """Проверка интернет-соединения"""
        try:
            requests.get('https://www.google.com', timeout=5)
            print("✓ Интернет-соединение доступно")
            return True
        except requests.ConnectionError:
            print("✗ Нет интернет-соединения. Требуется интернет.")
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
        """Загрузка данных из JSON файла"""
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
                      gender: Optional[str] = None,
                      voice_name: Optional[str] = None) -> Optional[Dict]:
        """
        Генерация аудиофайла для фразы
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            gender: Гендер голоса ('male' или 'female') - только для Edge-TTS
            voice_name: Конкретное имя голоса - только для Edge-TTS
        
        Returns:
            dict: Информация о сгенерированном файле или None при ошибке
        """
        if not text or not isinstance(text, str):
            print("✗ Пустая фраза")
            return None
        
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        if self.use_edge_tts:
            # Используем Edge-TTS с гендером
            if gender is None:
                gender = 'female'  # Значение по умолчанию
                
            return self.edge_tts_generator.generate_audio(
                text=clean_text,
                language=language,
                gender=gender,
                voice_name=voice_name
            )
        else:
            # Используем gTTS (без поддержки гендера)
            return self._generate_with_gtts(clean_text, language)
    
    def _generate_with_gtts(self, text: str, language: str = 'en') -> Optional[Dict]:
        """Генерация с использованием gTTS"""
        # Генерация имени файла
        filename = self._generate_filename(text, language)
        
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
            print(f"  Генерация аудио для: '{text[:50]}...' (gTTS)")
            
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
                          gender: Optional[str] = None) -> Dict:
        """
        Проверка существования аудиофайла для фразы
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            gender: Гендер голоса (опционально, для Edge-TTS)
        
        Returns:
            dict: Информация о существовании файла
        """
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, language)
        
        if self.use_edge_tts and gender:
            # Для Edge-TTS проверяем в подпапке гендера
            filepath = Path(self.BASE_OUTPUT_DIR) / gender / language / filename
        else:
            # Для gTTS или без гендера проверяем в подпапке языка
            filepath = Path(self.BASE_OUTPUT_DIR) / language / filename
        
        exists = filepath.exists() and filepath.stat().st_size > 0
        
        return {
            'exists': exists,
            'text': clean_text,
            'language': language,
            'gender': gender,
            'filename': filename,
            'filepath': str(filepath) if exists else None,
            'engine': self.engine_type
        }
    
    def find_audio_file(self, text: str, language: str = 'en', 
                       gender: Optional[str] = None) -> Optional[Dict]:
        """
        Поиск аудиофайла в разных категориях
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            gender: Гендер голоса (опционально, для Edge-TTS)
        
        Returns:
            dict: Информация о найденном файле или None
        """
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        filename = self._generate_filename(clean_text, language)
        
        if self.use_edge_tts:
            # Для Edge-TTS ищем в структуре гендер/язык
            if gender:
                # Ищем в конкретном гендере
                gender_dir = Path(self.BASE_OUTPUT_DIR) / gender
                if gender_dir.exists():
                    filepath = gender_dir / language / filename
                    if filepath.exists() and filepath.stat().st_size > 0:
                        return {
                            'exists': True,
                            'text': clean_text,
                            'language': language,
                            'gender': gender,
                            'filename': filename,
                            'filepath': str(filepath),
                            'engine': self.engine_type
                        }
            
            # Ищем во всех гендерах
            base_dir = Path(self.BASE_OUTPUT_DIR)
            if base_dir.exists():
                for gender_dir in base_dir.iterdir():
                    if gender_dir.is_dir():
                        filepath = gender_dir / language / filename
                        if filepath.exists() and filepath.stat().st_size > 0:
                            return {
                                'exists': True,
                                'text': clean_text,
                                'language': language,
                                'gender': gender_dir.name,
                                'filename': filename,
                                'filepath': str(filepath),
                                'engine': self.engine_type
                            }
        else:
            # Для gTTS ищем в структуре язык
            lang_filepath = Path(self.BASE_OUTPUT_DIR) / language / filename
            if lang_filepath.exists() and lang_filepath.stat().st_size > 0:
                return {
                    'exists': True,
                    'text': clean_text,
                    'language': language,
                    'filename': filename,
                    'filepath': str(lang_filepath),
                    'engine': self.engine_type
                }
        
        return None
    
    def get_available_voices(self, language: str = 'en', gender: Optional[str] = None) -> List[str]:
        """
        Получение списка доступных голосов (только для Edge-TTS)
        
        Args:
            language: Язык ('en' или 'ru')
            gender: Гендер ('male', 'female' или None для всех)
        
        Returns:
            Список доступных голосов
        """
        if self.use_edge_tts:
            return self.edge_tts_generator.get_available_voices(language, gender)
        else:
            print("⚠️ Список голосов доступен только для Edge-TTS")
            return []
    
    def list_all_voices(self):
        """Вывод всех доступных голосов (только для Edge-TTS)"""
        if self.use_edge_tts:
            self.edge_tts_generator.list_all_voices()
        else:
            print("⚠️ Список голосов доступен только для Edge-TTS")
    
    def cleanup(self):
        """Очистка ресурсов"""
        pass