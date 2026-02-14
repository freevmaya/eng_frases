from gtts import gTTS
import json
import hashlib
import os
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import requests
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import re

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedSpeechGenerator:
    def __init__(self, json_file_path: Optional[str] = None, 
                 use_edge_tts: bool = True,
                 voice_name: Optional[str] = None,
                 output_dir: str = "../public/data/voises",
                 style: str = 'neutral'):
        """
        Улучшенный генератор речи
        
        Args:
            json_file_path: Путь к JSON файлу с фразами
            use_edge_tts: Использовать Edge-TTS (True) или gTTS (False)
            voice_name: Имя конкретного голоса
            output_dir: Базовая директория для сохранения
        """
        self.json_file_path = json_file_path
        self.phrases_data = None
        self.style = style
        
        # Проверяем доступность Edge-TTS
        self.use_edge_tts = use_edge_tts
        if use_edge_tts:
            try:
                import edge_tts
                self.edge_tts_available = True
                logger.info("✓ Edge-TTS доступен")
            except ImportError:
                self.edge_tts_available = False
                logger.warning("✗ Edge-TTS не установлен. Используем gTTS.")
                self.use_edge_tts = False
        else:
            self.edge_tts_available = False
        
        self.voice_name = voice_name

        # Типы голосов для генерации
        self.voice_types = ['male', 'female']
        
        # Базовая директория для сохранения аудиофайлов
        self.base_output_dir = output_dir
        Path(self.base_output_dir).mkdir(exist_ok=True)
        
        # Маппинг direction кодам языков
        self.direction_language_map = {
            'en-ru': {'source': 'en', 'target': 'ru'},
            'ru-en': {'source': 'ru', 'target': 'en'},
            'en-hi': {'source': 'en', 'target': 'hi'},  # Английский -> Хинди
            'hi-en': {'source': 'hi', 'target': 'en'},  # Хинди -> Английский
            'ru-hi': {'source': 'ru', 'target': 'hi'},  # Русский -> Хинди
            'hi-ru': {'source': 'hi', 'target': 'ru'},  # Хинди -> Русский
        }
        
        # Коды языков для gTTS
        self.language_codes = {
            'en': 'en',  # Английский
            'ru': 'ru',  # Русский
            'hi': 'hi'   # Хинди
        }
        
        # TLD для gTTS (разные домены для разных языков)
        self.gtts_tld_map = {
            'en': 'com',
            'ru': 'ru',
            'hi': 'co.in'
        }
        
        # Задержка между запросами
        self.request_delay = 0.3
        
        # Пул потоков для параллельной генерации
        self.max_workers = 3
        
        # Настройки голосов для Edge-TTS
        self.edge_tts_voices = {
            'en': {
                'male': [
                    'en-US-ChristopherNeural',    # Американский, нейтральный
                    'en-US-EricNeural',           # Американский, спокойный
                    'en-US-BrandonNeural',        # Американский, молодой
                    'en-US-GuyNeural',            # Американский, уверенный
                    'en-GB-RyanNeural',           # Британский
                    'en-GB-AlfieNeural',          # Британский
                    'en-AU-WilliamNeural',        # Австралийский
                    'en-CA-LiamNeural'            # Канадский
                ],
                'female': [
                    'en-US-AriaNeural',           # Американский, популярный
                    'en-US-JennyNeural',          # Американский, дружелюбный
                    'en-US-EmmaNeural',           # Американский, профессиональный
                    'en-US-NancyNeural',          # Американский, теплый
                    'en-US-AmberNeural',          # Американский, энергичный
                    'en-US-AnaNeural',            # Американский, детский
                    'en-GB-SoniaNeural',          # Британский
                    'en-GB-LibbyNeural',          # Британский
                    'en-GB-MollyNeural',          # Британский
                    'en-AU-NatashaNeural',        # Австралийский
                    'en-AU-AnnetteNeural',        # Австралийский
                    'en-CA-ClaraNeural'           # Канадский
                ]
            },
            'ru': {
                'male': [
                    'ru-RU-DmitryNeural',         # Русский, нейтральный
                    'ru-RU-SergeyNeural'          # Русский, глубокий
                ],
                'female': [
                    'ru-RU-SvetlanaNeural',       # Русский, нейтральный
                    'ru-RU-DariyaNeural'          # Русский, мягкий
                ]
            },
            'hi': {
                'male': [
                    'hi-IN-MadhurNeural',         # Хинди, нейтральный
                    'hi-IN-PrabhatNeural'         # Хинди, глубокий
                ],
                'female': [
                    'hi-IN-SwaraNeural',          # Хинди, нейтральный
                    'hi-IN-AarohiNeural'          # Хинди, молодой
                ]
            }
        }

    def list_all_voices(self):
        """Вывести список всех доступных голосов Edge-TTS"""
        if not self.edge_tts_available:
            print("Edge-TTS не доступен. Установите: pip install edge-tts")
            return
        
        import edge_tts
        import asyncio
        
        async def list_voices():
            voices = await edge_tts.list_voices()
            print(f"\n{'='*60}")
            print(f"ДОСТУПНЫЕ ГОЛОСА EDGE-TTS ({len(voices)} голосов)")
            print(f"{'='*60}")
            
            # Группируем по языкам
            voices_by_lang = {}
            for voice in voices:
                lang = voice['Locale'].split('-')[0]
                if lang not in voices_by_lang:
                    voices_by_lang[lang] = []
                voices_by_lang[lang].append(voice)
            
            # Выводим по языкам
            for lang_code in sorted(voices_by_lang.keys()):
                lang_voices = voices_by_lang[lang_code]
                print(f"\n{lang_code.upper()} ({len(lang_voices)} голосов):")
                print("-" * 40)
                
                for voice in sorted(lang_voices, key=lambda x: x['ShortName']):
                    gender = voice['Gender']
                    name = voice['ShortName']
                    locale = voice['Locale']
                    
                    print(f"  {name} ({gender}) - {locale}")
        
        asyncio.run(list_voices())

    def get_voice_by_preference(self, lang: str, 
                               gender: str = 'female', 
                               style: str = 'neutral',
                               country: Optional[str] = None) -> str:
        """
        Выбор голоса по предпочтениям
        
        Args:
            lang: Язык (en, ru, hi)
            gender: Пол (male/female)
            style: Стиль (neutral, friendly, professional, energetic, young, etc.)
            country: Страна (US, GB, AU, CA, IN и т.д.)
        
        Returns:
            str: Имя голоса
        """
        if lang not in self.edge_tts_voices:
            # По умолчанию возвращаем английский голос
            return 'en-US-AriaNeural'
        
        voices = self.edge_tts_voices[lang].get(gender, [])
        
        if not voices:
            return 'en-US-AriaNeural'
        
        # Простые правила выбора по стилю
        style_map = {
            'en': {
                'neutral': ['en-US-AriaNeural', 'en-US-JennyNeural'],
                'friendly': ['en-US-JennyNeural', 'en-US-NancyNeural'],
                'professional': ['en-US-EmmaNeural', 'en-US-ChristopherNeural'],
                'energetic': ['en-US-AmberNeural', 'en-US-BrandonNeural'],
                'young': ['en-US-AmberNeural', 'en-US-BrandonNeural'],
                'child': ['en-US-AnaNeural']
            },
            'ru': {
                'neutral': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
                'friendly': ['ru-RU-DariyaNeural'],
                'professional': ['ru-RU-SvetlanaNeural'],
                'deep': ['ru-RU-SergeyNeural']
            },
            'hi': {
                'neutral': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
                'friendly': ['hi-IN-AarohiNeural', 'hi-IN-SwaraNeural'],
                'professional': ['hi-IN-PrabhatNeural', 'hi-IN-MadhurNeural'],
                'young': ['hi-IN-AarohiNeural']
            }
        }
        
        # Если указана страна, фильтруем по стране
        if country:
            filtered_voices = [v for v in voices if f'-{country}-' in v]
            if filtered_voices:
                voices = filtered_voices
        
        # Выбор по стилю
        if lang in style_map and style in style_map[lang]:
            preferred = style_map[lang][style]
            for voice in preferred:
                if voice in voices:
                    return voice
        
        # Возвращаем первый доступный голос
        return voices[0]
    
    def _check_internet_connection(self) -> bool:
        """Проверка интернет-соединения"""
        try:
            response = requests.get('https://www.google.com', timeout=5)
            return response.status_code == 200
        except requests.ConnectionError:
            logger.warning("Нет интернет-соединения")
            return False
    
    def load_json_data(self) -> Dict:
        """
        Загрузка данных из JSON файла
        
        Returns:
            dict: Загруженные данные
        """
        
        if not self.json_file_path or not os.path.exists(self.json_file_path):
            raise FileNotFoundError(f"JSON файл не найден: {self.json_file_path}")
        
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                self.phrases_data = json.load(f)
            logger.info(f"✓ Загружено {len(self.phrases_data)} категорий фраз")
            return self.phrases_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Ошибка чтения JSON файла: {e}")
    
    def _generate_filename(self, phrase: str, lang_code: str, voice_type: str) -> str:
        """
        Генерация имени файла на основе текста, языка и типа голоса
        
        Args:
            phrase: Текст фразы
            lang_code: Код языка (en, ru, hi)
            voice_type: Тип голоса (male, female)
        
        Returns:
            str: Имя файла
        """
        # Нормализуем фразу
        normalized_phrase = ' '.join(phrase.strip().split()).lower()
        
        # Создаем MD5 хэш
        phrase_hash = hashlib.md5(normalized_phrase.encode('utf-8')).hexdigest()
        
        # Формат: voice_type_lang_hash.mp3
        return f"{voice_type}_{lang_code}_{phrase_hash}.mp3"
    
    def _generate_with_gtts(self, text: str, lang: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью gTTS"""
        try:
            tld = settings.get('tld', self.gtts_tld_map.get(lang, 'com'))
            
            tts = gTTS(
                text=text,
                lang=lang,
                tld=tld,
                slow=settings.get('slow', False)
            )
            
            # Сохраняем во временный файл
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                temp_file = tmp.name
                tts.save(temp_file)
                
                # Читаем и возвращаем данные
                with open(temp_file, 'rb') as f:
                    audio_data = f.read()
                
                # Удаляем временный файл
                os.unlink(temp_file)
                
                return audio_data
                
        except Exception as e:
            logger.error(f"Ошибка gTTS: {e}")
            return None
    
    def _generate_with_edge_tts(self, text: str, lang: str, voice_type: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью Edge-TTS (высокое качество)"""
        try:
            import edge_tts
            import asyncio
            
            # Выбираем голос на основе типа
            voice = settings.get('voice_name')
            
            if not voice:
                voice = self.get_voice_by_preference(lang, voice_type, style=self.style)

            rate = settings.get('rate', '+0%')
            
            async def generate():
                tts = edge_tts.Communicate(text=text, voice=voice, rate=rate)
                audio_chunks = []
                
                async for chunk in tts.stream():
                    if chunk["type"] == "audio":
                        audio_chunks.append(chunk["data"])
                
                return b''.join(audio_chunks)
            
            # Запускаем асинхронную генерацию
            audio_data = asyncio.run(generate())
            return audio_data
            
        except Exception as e:
            logger.error(f"Ошибка Edge-TTS: {e}")
            return None
    
    def generate_audio(self, text: str, lang_code: str, voice_type: str) -> Optional[Dict]:
        """
        Генерация аудиофайла для указанного текста, языка и типа голоса
        
        Args:
            text: Текст фразы
            lang_code: Код языка (en, ru, hi)
            voice_type: Тип голоса (male, female)
        
        Returns:
            dict: Информация о сгенерированном файле
        """
        
        if not text or not isinstance(text, str):
            logger.warning("Пустой текст")
            return None
        
        # Нормализуем текст
        clean_text = re.sub(r'\([^()]*\)|\[[^\[\]]*\]', '', ' '.join(text.strip().split())).strip()
        
        # Генерация имени файла
        filename = self._generate_filename(clean_text, lang_code, voice_type)
        
        # Настройки
        settings = {
            'rate': '+0%'
        }
        
        # Определение директории для сохранения
        save_dir = Path(self.base_output_dir) / voice_type / lang_code
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            logger.info(f"Файл уже существует: {filename}")
            return {
                'text': clean_text,
                'lang_code': lang_code,
                'voice_type': voice_type,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True,
                'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
            }
        
        logger.info(f"Генерация [{voice_type}/{lang_code}]: '{clean_text[:60]}...' ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")
        
        # Выбираем метод генерации
        audio_data = None
        
        if self.use_edge_tts and self.edge_tts_available:
            audio_data = self._generate_with_edge_tts(clean_text, lang_code, voice_type, settings)
        else:
            # Настройки для gTTS
            gtts_settings = {
                'tld': self.gtts_tld_map.get(lang_code, 'com'),
                'slow': False
            }
            audio_data = self._generate_with_gtts(clean_text, lang_code, gtts_settings)
        
        if audio_data:
            # Сохраняем в файл
            with open(filepath, 'wb') as f:
                f.write(audio_data)
            
            # Задержка между запросами
            time.sleep(self.request_delay)
            
            # Проверяем файл
            if filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                logger.info(f"✓ Создан: {filename} ({file_size_kb:.1f} KB)")
                
                return {
                    'text': clean_text,
                    'lang_code': lang_code,
                    'voice_type': voice_type,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False,
                    'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
                }
        
        logger.error(f"Ошибка генерации для [{voice_type}/{lang_code}]: '{clean_text[:30]}...'")
        return None
    
    def generate_all_from_json(self) -> Dict:
        """Генерация всех аудиофайлов из JSON для всех типов голосов"""
        
        data = self.load_json_data()
        
        if not data:
            return {"error": "Нет данных для обработки"}
        
        # Проверяем интернет для онлайн-движков
        if not self._check_internet_connection():
            return {"error": "Требуется интернет-соединение"}
        
        results = {
            'engine': 'edge_tts' if self.use_edge_tts else 'gtts',
            'total_categories': 0,
            'total_phrases': 0,
            'total_operations': 0,
            'generated_files': 0,
            'existing_files': 0,
            'errors': 0,
            'voice_types': {
                'male': {
                    'languages': {
                        'en': {'files': 0, 'existing': 0, 'errors': 0},
                        'ru': {'files': 0, 'existing': 0, 'errors': 0},
                        'hi': {'files': 0, 'existing': 0, 'errors': 0}
                    },
                    'directions': {}
                },
                'female': {
                    'languages': {
                        'en': {'files': 0, 'existing': 0, 'errors': 0},
                        'ru': {'files': 0, 'existing': 0, 'errors': 0},
                        'hi': {'files': 0, 'existing': 0, 'errors': 0}
                    },
                    'directions': {}
                }
            }
        }
        
        logger.info(f"\n{'='*60}")
        logger.info(f"ГЕНЕРАЦИЯ АУДИОФАЙЛОВ ДЛЯ ВСЕХ ТИПОВ ГОЛОСОВ ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")
        logger.info(f"Стиль голоса: {self.style}")
        logger.info(f"{'='*60}")
        
        # Обрабатываем каждую категорию
        for category, phrases_list in data.items():
            logger.info(f"\nКатегория: {category}")
            logger.info(f"Фраз: {len(phrases_list)}")
            logger.info(f"{'-'*40}")
            
            results['total_categories'] += 1
            
            # Обрабатываем каждую фразу в категории
            for i, phrase_item in enumerate(phrases_list, 1):
                direction = phrase_item.get('direction', 'en-ru')
                target_text = phrase_item.get('target', '').strip()
                native_text = phrase_item.get('native', '').strip()
                
                if not direction or direction not in self.direction_language_map:
                    logger.warning(f"  Фраза #{i}: неизвестное направление '{direction}', пропускаем")
                    continue
                
                # Получаем языки для source и target из direction
                lang_mapping = self.direction_language_map[direction]
                source_lang = lang_mapping['source']
                target_lang = lang_mapping['target']
                
                logger.info(f"  Фраза #{i} [{direction}]:")
                
                # Для каждого типа голоса
                for voice_type in self.voice_types:
                    # Инициализируем статистику для направления если нужно
                    if direction not in results['voice_types'][voice_type]['directions']:
                        results['voice_types'][voice_type]['directions'][direction] = {
                            'files': 0,
                            'existing': 0,
                            'errors': 0
                        }
                    
                    logger.info(f"    Тип голоса: {voice_type}")
                    
                    # Генерируем аудио для target (язык source)
                    if target_text:
                        logger.info(f"      Target ({source_lang}): '{target_text[:50]}...'")
                        target_result = self.generate_audio(target_text, source_lang, voice_type)
                        
                        if target_result:
                            if target_result.get('already_exists'):
                                results['voice_types'][voice_type]['languages'][source_lang]['existing'] += 1
                                results['voice_types'][voice_type]['directions'][direction]['existing'] += 1
                                results['existing_files'] += 1
                            else:
                                results['voice_types'][voice_type]['languages'][source_lang]['files'] += 1
                                results['voice_types'][voice_type]['directions'][direction]['files'] += 1
                                results['generated_files'] += 1
                                logger.info(f"        ✓ Файл создан")
                            results['total_operations'] += 1
                        else:
                            results['voice_types'][voice_type]['languages'][source_lang]['errors'] += 1
                            results['voice_types'][voice_type]['directions'][direction]['errors'] += 1
                            results['errors'] += 1
                            results['total_operations'] += 1
                            logger.info(f"        ✗ Ошибка создания файла")
                    
                    # Генерируем аудио для native (язык target)
                    if native_text:
                        logger.info(f"      Native ({target_lang}): '{native_text[:50]}...'")
                        native_result = self.generate_audio(native_text, target_lang, voice_type)
                        
                        if native_result:
                            if native_result.get('already_exists'):
                                results['voice_types'][voice_type]['languages'][target_lang]['existing'] += 1
                                results['voice_types'][voice_type]['directions'][direction]['existing'] += 1
                                results['existing_files'] += 1
                            else:
                                results['voice_types'][voice_type]['languages'][target_lang]['files'] += 1
                                results['voice_types'][voice_type]['directions'][direction]['files'] += 1
                                results['generated_files'] += 1
                                logger.info(f"        ✓ Файл создан")
                            results['total_operations'] += 1
                        else:
                            results['voice_types'][voice_type]['languages'][target_lang]['errors'] += 1
                            results['voice_types'][voice_type]['directions'][direction]['errors'] += 1
                            results['errors'] += 1
                            results['total_operations'] += 1
                            logger.info(f"        ✗ Ошибка создания файла")
                    
                    results['total_phrases'] += 1
        
        # Итоги
        logger.info(f"\n{'='*60}")
        logger.info("ИТОГИ:")
        logger.info(f"{'='*60}")
        logger.info(f"Движок: {results['engine']}")
        logger.info(f"Стиль голоса: {self.style}")
        logger.info(f"Категорий: {results['total_categories']}")
        logger.info(f"Фраз: {results['total_phrases']}")
        logger.info(f"Всего операций генерации: {results['total_operations']}")
        logger.info(f"Новых файлов: {results['generated_files']}")
        logger.info(f"Существовало: {results['existing_files']}")
        logger.info(f"Ошибок: {results['errors']}")
        logger.info(f"Файлы сохранены в: {self.base_output_dir}/")
        
        # Показываем статистику по типам голосов и языкам
        logger.info(f"\nСтатистика по типам голосов и языкам:")
        for voice_type in self.voice_types:
            logger.info(f"\n  {voice_type.upper()}:")
            for lang_code in ['en', 'ru', 'hi']:
                stats = results['voice_types'][voice_type]['languages'][lang_code]
                logger.info(f"    {lang_code}: создано {stats['files']}, существовало {stats['existing']}, ошибок {stats['errors']}")
        
        # Показываем статистику по направлениям для каждого типа голоса
        logger.info(f"\nСтатистика по направлениям:")
        for voice_type in self.voice_types:
            logger.info(f"\n  {voice_type.upper()}:")
            for direction, stats in results['voice_types'][voice_type]['directions'].items():
                logger.info(f"    {direction}: создано {stats['files']}, существовало {stats['existing']}, ошибок {stats['errors']}")
        
        # Показываем структуру директорий
        logger.info(f"\nСтруктура директорий:")
        for voice_type in self.voice_types:
            for lang_code in ['en', 'ru', 'hi']:
                lang_dir = Path(self.base_output_dir) / voice_type / lang_code
                if lang_dir.exists():
                    mp3_files = list(lang_dir.glob("*.mp3"))
                    logger.info(f"  {voice_type}/{lang_code}/ - {len(mp3_files)} файлов")
        
        return results

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Генератор речи для всех типов голосов (male и female)')
    parser.add_argument('json_file', help='Путь к JSON файлу с фразами')
    parser.add_argument('--output-dir', default='../public/data/voises',
                       help='Директория для сохранения аудиофайлов')
    parser.add_argument('--use-gtts', action='store_true',
                       help='Использовать gTTS вместо Edge-TTS')
    parser.add_argument('--voice', help='Имя конкретного голоса для Edge-TTS')
    parser.add_argument('--style', choices=['neutral', 'friendly', 'professional', 'energetic', 'young', 'child'], default='neutral',
                       help='Стиль голоса (neutral/friendly/professional/energetic/young/child)')
    
    args = parser.parse_args()
    
    # Создаем генератор
    generator = EnhancedSpeechGenerator(
        json_file_path=args.json_file,
        use_edge_tts=not args.use_gtts,
        voice_name=args.voice,
        output_dir=args.output_dir,
        style=args.style
    )
    
    # Запускаем генерацию
    start_time = time.time()
    results = generator.generate_all_from_json()
    end_time = time.time()
    
    # Добавляем время выполнения
    results['total_time'] = f"{end_time - start_time:.2f} сек"
    
    print(f"\n{'='*60}")
    print("ЗАВЕРШЕНО!")
    print(f"{'='*60}")
    print(f"Общее время: {results['total_time']}")
    print(f"Аудиофайлы сохранены в: {generator.base_output_dir}/")
    print(f"Структура: {generator.base_output_dir}/[male|female]/[en|ru|hi]/")

if __name__ == "__main__":
    main()