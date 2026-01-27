# ============================================================
# FILE: .\classes\EdgeTTSGenerator.py
# TYPE: .PY
# ============================================================

import asyncio
import json
import hashlib
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests
import edge_tts

class EdgeTTSGenerator:
    """Генератор речи с использованием Edge-TTS"""
    
    def __init__(self, base_output_dir: str = '../public/data/audio_files_edge_tts'):
        """
        Инициализация генератора Edge-TTS
        
        Args:
            base_output_dir: Базовая директория для сохранения аудиофайлов
        """
        self.BASE_OUTPUT_DIR = base_output_dir
        
        # Словарь с доступными голосами Edge-TTS по языкам и гендерам
        self.VOICES = self._get_available_voices()
        
        # Задержка между запросами
        self.REQUEST_DELAY = 0.3
        
        # Проверяем интернет-соединение
        self._check_internet_connection()
    
    async def _load_voices_async(self):
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
    
    def _get_available_voices(self) -> Dict:
        """
        Получение списка доступных голосов Edge-TTS
        
        Returns:
            Словарь с голосами, сгруппированными по языкам и гендерам
        """
        try:
            # Запускаем асинхронную загрузку
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            voices = loop.run_until_complete(self._load_voices_async())
            loop.close()
            
            print(f"✓ Загружено голосов Edge-TTS для {len(voices)} языков")
            return voices
        except Exception as e:
            print(f"⚠️ Ошибка загрузки голосов Edge-TTS: {e}")
            # Возвращаем стандартные голоса по умолчанию
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
    
    def _check_internet_connection(self) -> bool:
        """Проверка интернет-соединения"""
        try:
            requests.get('https://www.google.com', timeout=5)
            print("✓ Интернет-соединение доступно")
            return True
        except requests.ConnectionError:
            print("✗ Нет интернет-соединения. Edge-TTS требует интернет.")
            return False
    
    def _get_voice_for_language(self, language: str, gender: str = 'female', voice_name: Optional[str] = None) -> str:
        """
        Получение голоса для заданного языка и гендера
        
        Args:
            language: Язык ('en' или 'ru')
            gender: Гендер голоса ('male' или 'female')
            voice_name: Конкретное имя голоса (если None, берется первый доступный)
        
        Returns:
            Имя голоса для Edge-TTS
        """
        # Нормализуем входные параметры
        lang_code = language.lower()
        gender_norm = gender.lower()
        
        if gender_norm not in ['male', 'female']:
            print(f"⚠️ Неизвестный гендер '{gender}', использую 'female'")
            gender_norm = 'female'
        
        # Получаем список доступных голосов для языка и гендера
        voices_list = self.VOICES.get(lang_code, {}).get(gender_norm, [])
        
        if not voices_list:
            # Если нет голосов для запрошенного языка/гендера, используем английский как запасной вариант
            print(f"⚠️ Нет голосов для языка '{lang_code}' и гендера '{gender_norm}', использую английский")
            lang_code = 'en'
            voices_list = self.VOICES.get('en', {}).get(gender_norm, [])
        
        if not voices_list:
            # Если все еще нет голосов, берем любой доступный
            print("⚠️ Не найдено подходящих голосов, использую первый доступный")
            for lang in self.VOICES:
                for gen in ['female', 'male']:
                    if self.VOICES[lang].get(gen):
                        return self.VOICES[lang][gen][0]
        
        # Если указано конкретное имя голоса, проверяем его доступность
        if voice_name:
            if voice_name in voices_list:
                return voice_name
            else:
                print(f"⚠️ Голос '{voice_name}' не найден для языка '{lang_code}' и гендера '{gender_norm}'")
                print(f"   Доступные голоса: {', '.join(voices_list[:5])}")
        
        # Возвращаем первый доступный голос
        return voices_list[0]
    
    @staticmethod
    def _generate_filename(phrase: str, language: str = 'en') -> str:
        """
        Генерация имени файла на основе фразы
        
        Args:
            phrase: Текст фразы
            language: Язык ('en' или 'ru')
        
        Returns:
            str: Имя файла
        """
        # Нормализуем фразу
        normalized_phrase = ' '.join(phrase.strip().split()).lower()
        
        phrase_hash = hashlib.md5(normalized_phrase.encode('utf-8')).hexdigest()
        return f"{language}_{phrase_hash}.mp3"
    
    async def _generate_audio_async(self, text: str, voice: str, output_file: str) -> bool:
        """
        Асинхронная генерация аудиофайла
        
        Args:
            text: Текст для преобразования
            voice: Имя голоса Edge-TTS
            output_file: Путь к выходному файлу
        
        Returns:
            True если успешно
        """
        try:
            communicate = edge_tts.Communicate(text, voice)
            
            # Сохраняем в файл
            await communicate.save(output_file)
            return True
            
        except Exception as e:
            print(f"✗ Ошибка Edge-TTS: {e}")
            return False
    
    def generate_audio(self, text: str, language: str = 'en', 
                      gender: str = 'female', voice_name: Optional[str] = None,
                      category: Optional[str] = None) -> Optional[Dict]:
        """
        Генерация аудиофайла для фразы
        
        Args:
            text: Текст фразы
            language: Язык ('en' или 'ru')
            gender: Гендер голоса ('male' или 'female')
            voice_name: Конкретное имя голоса (если None, берется первый доступный для гендера)
            category: Категория (опционально)
        
        Returns:
            dict: Информация о сгенерированном файле или None при ошибке
        """
        if not text or not isinstance(text, str):
            print("✗ Пустая фраза")
            return None
        
        # Нормализуем текст
        clean_text = ' '.join(text.strip().split())
        
        # Получаем голос
        voice = self._get_voice_for_language(language, gender, voice_name)
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, language)
        
        # Создаем подпапки: BASE_OUTPUT_DIR/gender/language
        save_dir = Path(self.BASE_OUTPUT_DIR) / gender / language
        
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            print(f"✓ Файл уже существует: {filename}")
            return {
                'text': text,
                'language': language,
                'gender': gender,
                'voice': voice,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True
            }
        
        try:
            print(f"  Генерация аудио для: '{text[:50]}...'")
            print(f"  Голос: {voice} (гендер: {gender})")
            
            # Запускаем асинхронную генерацию
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            success = loop.run_until_complete(
                self._generate_audio_async(clean_text, voice, str(filepath))
            )
            
            loop.close()
            
            # Задержка между запросами
            time.sleep(self.REQUEST_DELAY)
            
            if success and filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                print(f"  ✓ Создан: {filename} ({file_size_kb:.1f} KB)")
                
                return {
                    'text': text,
                    'language': language,
                    'gender': gender,
                    'voice': voice,
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
    
    def get_available_voices(self, language: str = 'en', gender: Optional[str] = None) -> List[str]:
        """
        Получение списка доступных голосов
        
        Args:
            language: Язык ('en' или 'ru')
            gender: Гендер ('male', 'female' или None для всех)
        
        Returns:
            Список доступных голосов
        """
        lang_code = language.lower()
        
        if lang_code not in self.VOICES:
            return []
        
        if gender:
            gender_norm = gender.lower()
            return self.VOICES[lang_code].get(gender_norm, [])
        else:
            # Возвращаем все голоса для языка
            return self.VOICES[lang_code].get('male', []) + self.VOICES[lang_code].get('female', [])
    
    def list_all_voices(self):
        """Вывод всех доступных голосов"""
        print(f"\n{'='*60}")
        print("ДОСТУПНЫЕ ГОЛОСА EDGE-TTS")
        print(f"{'='*60}")
        
        for lang_code, voices_by_gender in self.VOICES.items():
            print(f"\n{lang_code.upper()}:")
            for gender, voices in voices_by_gender.items():
                if voices:
                    print(f"  {gender.capitalize()}:")
                    for voice in voices[:10]:  # Показываем первые 10
                        print(f"    • {voice}")
                    if len(voices) > 10:
                        print(f"    ... и еще {len(voices) - 10} голосов")