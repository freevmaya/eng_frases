# ============================================================
# FILE: .\classes\TTSGenerator.py
# TYPE: .PY
# ============================================================

import asyncio
import json
import hashlib
import time
import unicodedata
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests

# Импортируем движки TTS
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    print("⚠️ Edge-TTS не установлен. Используйте: pip install edge-tts")

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False
    print("⚠️ pyttsx3 не установлен. Используйте: pip install pyttsx3")

class TTSGenerator:
    """Универсальный генератор речи с поддержкой Edge-TTS и pyttsx3"""
    
    # Константы для движков TTS
    ENGINE_EDGE_TTS = 'edge_tts'
    ENGINE_PYTTSX3 = 'pyttsx3'
    
    def __init__(self, base_output_dir: str = '../public/data/audio_files'):
        """
        Инициализация генератора TTS
        
        Args:
            base_output_dir: Базовая директория для сохранения аудиофайлов
        """
        self.BASE_OUTPUT_DIR = base_output_dir
        
        # Словари с доступными голосами
        self.EDGE_TTS_VOICES = {}
        self.PYTTSX3_VOICES = {}
        
        # Инициализация движков
        self.engine_pyttsx3 = None
        self._init_tts_engines()
        
        # Задержка между запросами (для Edge-TTS)
        self.REQUEST_DELAY = 0.3
        
        # Таблица для преобразования акцентных символов в две буквы
        self.ACCENT_REPLACEMENTS = {
            'а́': 'аа', 'е́': 'ее', 'и́': 'ии', 'о́': 'оо', 'у́': 'уу', 
            'ы́': 'ыы', 'э́': 'ээ', 'ю́': 'юю', 'я́': 'яя',
            'А́': 'Аа', 'Е́': 'Ее', 'И́': 'Ии', 'О́': 'Оо', 'У́': 'Уу',
            'Ы́': 'Ыы', 'Э́': 'Ээ', 'Ю́': 'Юю', 'Я́': 'Яя'
        }
        
        # Проверяем интернет-соединение
        self._check_internet_connection()
    
    def _init_tts_engines(self):
        """Инициализация доступных движков TTS"""
        # Инициализация Edge-TTS
        if EDGE_TTS_AVAILABLE:
            self.EDGE_TTS_VOICES = self._get_edge_tts_voices()
        
        # Инициализация pyttsx3
        if PYTTSX3_AVAILABLE:
            try:
                self.engine_pyttsx3 = pyttsx3.init()
                self.PYTTSX3_VOICES = self._get_pyttsx3_voices()
                print(f"✓ Pyttsx3 инициализирован, загружено {len(self.PYTTSX3_VOICES)} голосов")
            except Exception as e:
                print(f"✗ Ошибка инициализации pyttsx3: {e}")
                self.engine_pyttsx3 = None
        
        print(f"✓ Доступные движки: {'Edge-TTS' if EDGE_TTS_AVAILABLE else ''} {'Pyttsx3' if PYTTSX3_AVAILABLE else ''}".strip())
    
    def _get_edge_tts_voices(self) -> Dict:
        """
        Получение списка доступных голосов Edge-TTS
        
        Returns:
            Словарь с голосами, сгруппированными по языкам и гендерам
        """
        if not EDGE_TTS_AVAILABLE:
            return {}
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            voices = loop.run_until_complete(self._load_edge_tts_voices_async())
            loop.close()
            
            print(f"✓ Загружено голосов Edge-TTS для {len(voices)} языков")
            return voices
        except Exception as e:
            print(f"⚠️ Ошибка загрузки голосов Edge-TTS: {e}")
            return {
                'en': {
                    'male': ['en-US-ChristopherNeural', 'en-US-EricNeural', 'en-GB-RyanNeural'],
                    'female': ['en-US-AriaNeural', 'en-US-JennyNeural', 'en-GB-SoniaNeural']
                },
                'ru': {
                    'male': ['ru-RU-DmitryNeural', 'ru-RU-SergeyNeural'],
                    'female': ['ru-RU-SvetlanaNeural', 'ru-RU-DariyaNeural']
                }
            }
    
    async def _load_edge_tts_voices_async(self):
        """Асинхронная загрузка всех доступных голосов Edge-TTS"""
        voices = await edge_tts.list_voices()
        organized_voices = {}
        
        for voice in voices:
            locale = voice['Locale']
            short_name = voice['ShortName']
            gender = voice['Gender'].lower()
            
            # Извлекаем код языка (первые 2 символа)
            lang_code = locale[:2].lower() if len(locale) >= 2 else 'en'
            
            if lang_code not in organized_voices:
                organized_voices[lang_code] = {'male': [], 'female': []}
            
            organized_voices[lang_code][gender].append(short_name)
        
        return organized_voices
    
    def _get_pyttsx3_voices(self) -> Dict:
        """
        Получение списка доступных голосов pyttsx3
        
        Returns:
            Словарь с голосами, сгруппированными по языкам и гендерам
        """
        if not PYTTSX3_AVAILABLE or not self.engine_pyttsx3:
            return {}
        
        voices_dict = {}
        
        try:
            voices = self.engine_pyttsx3.getProperty('voices')
            
            for voice in voices:
                voice_id = voice.id
                voice_name = voice.name
                voice_languages = voice.languages if hasattr(voice, 'languages') else []
                
                # Определяем язык голоса
                lang_code = 'en'  # По умолчанию английский
                if voice_languages:
                    # Берем первый язык из списка
                    lang = voice_languages[0] if voice_languages else ''
                    lang_code = lang[:2].lower() if len(lang) >= 2 else 'en'
                
                # Определяем гендер
                gender = 'female'  # По умолчанию женский
                if 'male' in voice_name.lower() or 'муж' in voice_name.lower():
                    gender = 'male'
                elif 'female' in voice_name.lower() or 'жен' in voice_name.lower():
                    gender = 'female'
                else:
                    # Пробуем определить по ID
                    if any(male_id in voice_id.lower() for male_id in ['male', 'david', 'mark', 'zira']):
                        gender = 'male' if 'david' in voice_id.lower() or 'mark' in voice_id.lower() else 'female'
                
                if lang_code not in voices_dict:
                    voices_dict[lang_code] = {'male': [], 'female': []}
                
                voices_dict[lang_code][gender].append({
                    'id': voice_id,
                    'name': voice_name
                })
            
            return voices_dict
        except Exception as e:
            print(f"⚠️ Ошибка получения голосов pyttsx3: {e}")
            return {}
    
    def _normalize_accented_chars(self, text: str) -> str:
        """
        Замена акцентных символов на две соответствующие буквы
        Пример: "сбега́ть" -> "сбегаать"
        
        Args:
            text: Исходный текст
            
        Returns:
            Текст с замененными акцентными символами
        """
        if not text:
            return text
            
        result = text
        
        # Заменяем акцентные символы согласно таблице
        for accented_char, replacement in self.ACCENT_REPLACEMENTS.items():
            result = result.replace(accented_char, replacement)
        
        # Дополнительная обработка: разложение комбинированных символов
        normalized_text = unicodedata.normalize('NFD', result)
        
        # Заменяем комбинированные диакритические знаки на дополнительные буквы
        output_chars = []
        i = 0
        while i < len(normalized_text):
            char = normalized_text[i]
            
            # Проверяем, является ли следующий символ комбинированным диакритическим знаком
            if i + 1 < len(normalized_text) and unicodedata.category(normalized_text[i + 1]) == 'Mn':
                # Это акцентная буква: добавляем саму букву дважды
                output_chars.append(char)
                output_chars.append(char)
                i += 2  # Пропускаем и букву и диакритический знак
            else:
                output_chars.append(char)
                i += 1
        
        result = ''.join(output_chars)
        
        # Для отладки (можно закомментировать)
        if result != text:
            print(f"  Преобразовано: '{text[:50]}...' -> '{result[:50]}...'")
        
        return result
    
    def _check_internet_connection(self) -> bool:
        """Проверка интернет-соединения"""
        try:
            requests.get('https://www.google.com', timeout=5)
            print("✓ Интернет-соединение доступно")
            return True
        except requests.ConnectionError:
            print("⚠️ Нет интернет-соединения. Edge-TTS требует интернет.")
            return False
    
    def _get_voice_for_engine(self, engine: str, language: str, gender: str = 'female', voice_name: Optional[str] = None) -> str:
        """
        Получение голоса для заданного движка, языка и гендера
        
        Args:
            engine: Движок TTS ('edge_tts' или 'pyttsx3')
            language: Язык ('en' или 'ru')
            gender: Гендер голоса ('male' или 'female')
            voice_name: Конкретное имя голоса
            
        Returns:
            Имя/ID голоса
        """
        lang_code = language.lower()
        gender_norm = gender.lower()
        
        if gender_norm not in ['male', 'female']:
            print(f"⚠️ Неизвестный гендер '{gender}', использую 'female'")
            gender_norm = 'female'
        
        if engine == self.ENGINE_EDGE_TTS:
            # Для Edge-TTS
            voices_list = self.EDGE_TTS_VOICES.get(lang_code, {}).get(gender_norm, [])
            
            if not voices_list:
                print(f"⚠️ Edge-TTS: нет голосов для языка '{lang_code}' и гендера '{gender_norm}', использую английский")
                lang_code = 'en'
                voices_list = self.EDGE_TTS_VOICES.get('en', {}).get(gender_norm, [])
            
            if voice_name:
                if voice_name in voices_list:
                    return voice_name
                else:
                    print(f"⚠️ Edge-TTS: голос '{voice_name}' не найден")
            
            return voices_list[0] if voices_list else 'en-US-JennyNeural'
        
        elif engine == self.ENGINE_PYTTSX3:
            # Для pyttsx3
            voices_list = self.PYTTSX3_VOICES.get(lang_code, {}).get(gender_norm, [])
            
            if not voices_list:
                print(f"⚠️ Pyttsx3: нет голосов для языка '{lang_code}' и гендера '{gender_norm}'")
                # Пробуем найти любой доступный голос
                for lang in self.PYTTSX3_VOICES:
                    if gender_norm in self.PYTTSX3_VOICES[lang] and self.PYTTSX3_VOICES[lang][gender_norm]:
                        voice = self.PYTTSX3_VOICES[lang][gender_norm][0]
                        return voice['id']
            
            if voice_name:
                # Ищем голос по имени или ID
                for voice_info in voices_list:
                    if voice_name.lower() in voice_info['name'].lower() or voice_name == voice_info['id']:
                        return voice_info['id']
                print(f"⚠️ Pyttsx3: голос '{voice_name}' не найден")
            
            return voices_list[0]['id'] if voices_list else None
        
        return None
    
    @staticmethod
    def _generate_filename(phrase: str, language: str = 'en', engine: str = 'edge_tts') -> str:
        """
        Генерация имени файла на основе фразы, языка и движка
        
        Args:
            phrase: Текст фразы
            language: Язык
            engine: Движок TTS
        
        Returns:
            str: Имя файла
        """
        normalized_phrase = ' '.join(phrase.strip().split()).lower()
        phrase_hash = hashlib.md5(f"{normalized_phrase}_{engine}".encode('utf-8')).hexdigest()
        
        return f"{language}_{phrase_hash}.mp3"
    
    async def _generate_audio_edge_tts_async(self, text: str, voice: str, output_file: str) -> bool:
        """
        Асинхронная генерация аудиофайла с помощью Edge-TTS
        
        Args:
            text: Текст для преобразования
            voice: Имя голоса Edge-TTS
            output_file: Путь к выходному файлу
        
        Returns:
            True если успешно
        """
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_file)
            return True
        except Exception as e:
            print(f"✗ Ошибка Edge-TTS: {e}")
            return False
    
    def _generate_audio_pyttsx3(self, text: str, voice_id: str, output_file: str) -> bool:
        """
        Генерация аудиофайла с помощью pyttsx3
        
        Args:
            text: Текст для преобразования
            voice_id: ID голоса pyttsx3
            output_file: Путь к выходному файлу
        
        Returns:
            True если успешно
        """
        if not PYTTSX3_AVAILABLE or not self.engine_pyttsx3:
            print("✗ Pyttsx3 не доступен")
            return False
        
        try:
            # Сохраняем текущие настройки
            original_voice = self.engine_pyttsx3.getProperty('voice')
            original_rate = self.engine_pyttsx3.getProperty('rate')
            original_volume = self.engine_pyttsx3.getProperty('volume')
            
            # Устанавливаем голос
            self.engine_pyttsx3.setProperty('voice', voice_id)
            
            # Настраиваем параметры
            self.engine_pyttsx3.setProperty('rate', 150)  # Скорость речи
            self.engine_pyttsx3.setProperty('volume', 0.9)  # Громкость
            
            # Сохраняем в файл
            self.engine_pyttsx3.save_to_file(text, output_file)
            self.engine_pyttsx3.runAndWait()
            
            # Восстанавливаем настройки
            self.engine_pyttsx3.setProperty('voice', original_voice)
            self.engine_pyttsx3.setProperty('rate', original_rate)
            self.engine_pyttsx3.setProperty('volume', original_volume)
            
            return True
        except Exception as e:
            print(f"✗ Ошибка pyttsx3: {e}")
            return False
    
    def generate_audio(self, text: str, language: str = 'en', 
                      gender: str = 'female', voice_name: Optional[str] = None,
                      engine: str = ENGINE_EDGE_TTS) -> Optional[Dict]:
        """
        Генерация аудиофайла для фразы
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            gender: Гендер голоса ('male' или 'female')
            voice_name: Конкретное имя голоса
            engine: Движок TTS ('edge_tts' или 'pyttsx3')
        
        Returns:
            dict: Информация о сгенерированном файле или None при ошибке
        """
        if not text or not isinstance(text, str):
            print("✗ Пустая фраза")
            return None
        
        # Проверяем доступность движка
        if engine == self.ENGINE_EDGE_TTS and not EDGE_TTS_AVAILABLE:
            print("⚠️ Edge-TTS не доступен, использую pyttsx3")
            engine = self.ENGINE_PYTTSX3
        
        if engine == self.ENGINE_PYTTSX3 and not PYTTSX3_AVAILABLE:
            print("✗ Ни один движок TTS не доступен")
            return None
        
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        # Для генерации звука используем текст с замененными акцентными символами
        text_for_tts = self._normalize_accented_chars(clean_text)
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, language, engine)
        
        # Получаем голос
        voice = self._get_voice_for_engine(engine, language, gender, voice_name)
        if not voice:
            print(f"✗ Не удалось получить голос для движка {engine}")
            return None
        
        # Создаем подпапки
        save_dir = Path(self.BASE_OUTPUT_DIR) / engine / gender / language
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            print(f"✓ Файл уже существует: {filename} ({engine})")
            return {
                'text': text,
                'text_for_tts': text_for_tts,
                'language': language,
                'gender': gender,
                'voice': voice,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'engine': engine,
                'already_exists': True
            }
        
        try:
            print(f"  Генерация аудио ({engine}): '{clean_text[:50]}...'")
            print(f"  Текст для TTS: '{text_for_tts[:50]}...'")
            print(f"  Голос: {voice}")
            
            success = False
            
            if engine == self.ENGINE_EDGE_TTS:
                # Генерация с помощью Edge-TTS
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                success = loop.run_until_complete(
                    self._generate_audio_edge_tts_async(text_for_tts, voice, str(filepath))
                )
                loop.close()
                
                # Задержка между запросами
                time.sleep(self.REQUEST_DELAY)
            
            elif engine == self.ENGINE_PYTTSX3:
                # Генерация с помощью pyttsx3
                success = self._generate_audio_pyttsx3(text_for_tts, voice, str(filepath))
            
            if success and filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                print(f"  ✓ Создан: {filename} ({file_size_kb:.1f} KB, {engine})")
                
                return {
                    'text': text,
                    'text_for_tts': text_for_tts,
                    'language': language,
                    'gender': gender,
                    'voice': voice,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'engine': engine,
                    'already_exists': False
                }
            else:
                print(f"✗ Ошибка: файл не создан или пустой: {filename} ({engine})")
                return None
                
        except Exception as e:
            print(f"✗ Ошибка при генерации аудио для '{clean_text[:30]}...' ({engine}): {str(e)}")
            return None
    
    def get_available_voices(self, engine: str = ENGINE_EDGE_TTS, language: str = 'en', gender: Optional[str] = None) -> List[str]:
        """
        Получение списка доступных голосов
        
        Args:
            engine: Движок TTS
            language: Язык
            gender: Гендер ('male', 'female' или None для всех)
        
        Returns:
            Список доступных голосов
        """
        lang_code = language.lower()
        
        if engine == self.ENGINE_EDGE_TTS:
            if lang_code not in self.EDGE_TTS_VOICES:
                return []
            
            if gender:
                gender_norm = gender.lower()
                return self.EDGE_TTS_VOICES[lang_code].get(gender_norm, [])
            else:
                return self.EDGE_TTS_VOICES[lang_code].get('male', []) + self.EDGE_TTS_VOICES[lang_code].get('female', [])
        
        elif engine == self.ENGINE_PYTTSX3:
            if lang_code not in self.PYTTSX3_VOICES:
                return []
            
            voices = []
            if gender:
                gender_norm = gender.lower()
                for voice_info in self.PYTTSX3_VOICES[lang_code].get(gender_norm, []):
                    voices.append(f"{voice_info['name']} ({voice_info['id']})")
            else:
                for gender_type in ['male', 'female']:
                    for voice_info in self.PYTTSX3_VOICES[lang_code].get(gender_type, []):
                        voices.append(f"{voice_info['name']} ({voice_info['id']}) - {gender_type}")
            
            return voices
        
        return []
    
    def list_all_voices(self, engine: str = None):
        """
        Вывод всех доступных голосов
        
        Args:
            engine: Движок TTS (None для всех)
        """
        if engine is None or engine == self.ENGINE_EDGE_TTS:
            print(f"\n{'='*60}")
            print("ДОСТУПНЫЕ ГОЛОСА EDGE-TTS")
            print(f"{'='*60}")
            
            for lang_code, voices_by_gender in self.EDGE_TTS_VOICES.items():
                print(f"\n{lang_code.upper()}:")
                for gender, voices in voices_by_gender.items():
                    if voices:
                        print(f"  {gender.capitalize()}:")
                        for voice in voices[:10]:
                            print(f"    • {voice}")
                        if len(voices) > 10:
                            print(f"    ... и еще {len(voices) - 10} голосов")
        
        if engine is None or engine == self.ENGINE_PYTTSX3:
            print(f"\n{'='*60}")
            print("ДОСТУПНЫЕ ГОЛОСА PYTTSX3")
            print(f"{'='*60}")
            
            for lang_code, voices_by_gender in self.PYTTSX3_VOICES.items():
                print(f"\n{lang_code.upper()}:")
                for gender, voices in voices_by_gender.items():
                    if voices:
                        print(f"  {gender.capitalize()}:")
                        for voice_info in voices[:10]:
                            print(f"    • {voice_info['name']} ({voice_info['id'][:30]}...)")
                        if len(voices) > 10:
                            print(f"    ... и еще {len(voices) - 10} голосов")
    
    def get_available_engines(self) -> List[str]:
        """
        Получение списка доступных движков TTS
        
        Returns:
            Список доступных движков
        """
        engines = []
        if EDGE_TTS_AVAILABLE:
            engines.append(self.ENGINE_EDGE_TTS)
        if PYTTSX3_AVAILABLE and self.engine_pyttsx3:
            engines.append(self.ENGINE_PYTTSX3)
        return engines