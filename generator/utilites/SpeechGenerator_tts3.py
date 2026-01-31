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
                 voice_type: Optional[str] = None,
                 output_dir: str = "../public/data/voises"):
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
        self.voice_type = voice_type if voice_type else 'male'

        logger.info(f"voice_type: {self.voice_type}")
        
        # Базовая директория для сохранения аудиофайлов
        self.base_output_dir = output_dir
        Path(self.base_output_dir).mkdir(exist_ok=True)
        
        # Настройки языков
        self.language_map = {
            'target': 'en',    # Английский
            'native': 'ru'     # Русский
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
            'de': {
                'male': ['de-DE-ConradNeural'],
                'female': ['de-DE-KatjaNeural', 'de-DE-AmalaNeural']
            },
            'fr': {
                'male': ['fr-FR-HenriNeural'],
                'female': ['fr-FR-DeniseNeural', 'fr-FR-EloiseNeural']
            },
            'es': {
                'male': ['es-ES-AlvaroNeural', 'es-MX-JorgeNeural'],
                'female': ['es-ES-ElviraNeural', 'es-MX-DaliaNeural']
            },
            'zh': {
                'male': ['zh-CN-YunxiNeural'],
                'female': ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaohanNeural']
            },
            'ja': {
                'male': ['ja-JP-KeitaNeural'],
                'female': ['ja-JP-NanamiNeural']
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

    # Метод для выбора голоса по предпочтениям
    def get_voice_by_preference(self, lang: str, 
                               gender: str = 'female', 
                               style: str = 'neutral',
                               country: Optional[str] = None) -> str:
        """
        Выбор голоса по предпочтениям
        
        Args:
            lang: Язык (en, ru, de и т.д.)
            gender: Пол (male/female)
            style: Стиль (neutral, friendly, professional, energetic, young, etc.)
            country: Страна (US, GB, AU, CA и т.д.)
        
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
        
        Args:
            json_file_path: Путь к JSON файлу
        
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
    
    def _generate_filename(self, phrase: str, phrase_type: str = 'target') -> str:
        # Нормализуем фразу
        normalized_phrase = ' '.join(phrase.strip().split()).lower()
        
        # Создаем MD5 хэш
        phrase_hash = hashlib.md5(normalized_phrase.encode('utf-8')).hexdigest()
        
        # Получаем код языка
        lang_code = self.language_map.get(phrase_type, 'unknown')
        
        # Формат: lang_hash.mp3
        return f"{lang_code}_{phrase_hash}.mp3"
    
    def _generate_with_gtts(self, text: str, lang: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью gTTS"""
        try:
            tts = gTTS(
                text=text,
                lang=lang,
                tld=settings.get('tld', 'com'),
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
    
    def _generate_with_edge_tts(self, text: str, lang: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью Edge-TTS (высокое качество)"""
        try:
            import edge_tts
            import asyncio
            
            # Выбираем голос
            voice = settings.get('voice_name')
            
            if not voice:
                # Если голос не указан, берем первый доступный
                voices = {
                    'en': 'en-US-AriaNeural',
                    'ru': 'ru-RU-SvetlanaNeural'
                }
                voice = self.get_voice_by_preference(lang, self.voice_type) # voices.get(lang, 'en-US-AriaNeural')


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
    
    def generate_audio(self, phrase: str, phrase_type: str = 'target') -> Optional[Dict]:
        """
        Генерация аудиофайла
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы ('target' или 'native')
        
        Returns:
            dict: Информация о сгенерированном файле
        """
        
        if not phrase or not isinstance(phrase, str):
            logger.warning("Пустая фраза")
            return None
        
        # Нормализуем фразу
        clean_phrase = re.sub(r'\([^()]*\)|\[[^\[\]]*\]', '', ' '.join(phrase.strip().split())).strip()
        
        # Генерация имени файла
        filename = self._generate_filename(clean_phrase, phrase_type)
        
        # Получаем код языка
        lang_code = self.language_map.get(phrase_type, 'en')
        
        # Настройки
        settings = {
            'rate': '+0%'
        }
        
        # Определение директории для сохранения
        # Создаем подпапку с именем языка
        save_dir = Path(self.base_output_dir) / self.voice_type / lang_code
        
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            logger.info(f"Файл уже существует: {filename}")
            return {
                'phrase': clean_phrase,
                'phrase_type': phrase_type,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True,
                'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
            }
        
        # Получаем язык
        lang = self.language_map.get(phrase_type, 'en')
        
        logger.info(f"Генерация: '{clean_phrase[:60]}...' ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")
        
        # Выбираем метод генерации
        audio_data = None
        
        if self.use_edge_tts and self.edge_tts_available:
            audio_data = self._generate_with_edge_tts(clean_phrase, lang, settings)
        else:
            # Настройки для gTTS
            gtts_settings = {
                'tld': 'com' if lang == 'en' else 'ru',
                'slow': False
            }
            audio_data = self._generate_with_gtts(clean_phrase, lang, gtts_settings)
        
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
                    'phrase': clean_phrase,
                    'phrase_type': phrase_type,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False,
                    'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
                }
        
        logger.error(f"Ошибка генерации для: '{clean_phrase[:30]}...'")
        return None
    
    def generate_all_from_json(self) -> Dict:
        """Генерация всех аудиофайлов из JSON"""
        # Загружаем данные
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
            'generated_files': 0,
            'existing_files': 0,
            'errors': 0,
            'languages': {
                'en': {'files': 0, 'existing': 0, 'errors': 0},
                'ru': {'files': 0, 'existing': 0, 'errors': 0}
            }
        }
        
        logger.info(f"\n{'='*60}")
        logger.info(f"ГЕНЕРАЦИЯ АУДИОФАЙЛОВ ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")
        logger.info(f"{'='*60}")
        
        # Обрабатываем каждую категорию
        for category, phrases_list in data.items():
            logger.info(f"\nКатегория: {category}")
            logger.info(f"Фраз: {len(phrases_list)}")
            logger.info(f"{'-'*40}")
            
            results['total_categories'] += 1
            
            # Обрабатываем каждую фразу в категории
            for i, phrase_pair in enumerate(phrases_list, 1):
                target_phrase = phrase_pair.get('target', '').strip()
                native_phrase = phrase_pair.get('native', '').strip()
                
                if not target_phrase and not native_phrase:
                    logger.info(f"  Пропущена пустая фраза #{i}")
                    continue
                
                # Генерация английской версии (target)
                if target_phrase:
                    logger.info(f"  Фраза #{i} (EN): '{target_phrase[:50]}...'")
                    target_result = self.generate_audio(
                        target_phrase, 
                        'target'
                    )
                    
                    if target_result:
                        if target_result.get('already_exists'):
                            results['languages']['en']['existing'] += 1
                            results['existing_files'] += 1
                            #logger.info(f"    ✓ Файл уже существует")
                        else:
                            results['languages']['en']['files'] += 1
                            results['generated_files'] += 1
                            logger.info(f"    ✓ Файл создан")
                    else:
                        results['languages']['en']['errors'] += 1
                        results['errors'] += 1
                        logger.info(f"    ✗ Ошибка создания файла")
                
                # Генерация версии (native)
                if native_phrase:
                    logger.info(f"  Фраза #{i} (RU): '{native_phrase[:50]}...'")
                    native_result = self.generate_audio(
                        native_phrase, 
                        'native'
                    )
                    
                    if native_result:
                        if native_result.get('already_exists'):
                            results['languages']['ru']['existing'] += 1
                            results['existing_files'] += 1
                            #logger.info(f"    ✓ Файл уже существует")
                        else:
                            results['languages']['ru']['files'] += 1
                            results['generated_files'] += 1
                            logger.info(f"    ✓ Файл создан")
                    else:
                        results['languages']['ru']['errors'] += 1
                        results['errors'] += 1
                        logger.info(f"    ✗ Ошибка создания файла")
                
                results['total_phrases'] += 1
        
        # Итоги
        logger.info(f"\n{'='*60}")
        logger.info("ИТОГИ:")
        logger.info(f"{'='*60}")
        logger.info(f"Движок: {results['engine']}")
        logger.info(f"Гендер: {self.voice_type}")
        logger.info(f"Категорий: {results['total_categories']}")
        logger.info(f"Фраз: {results['total_phrases']}")
        logger.info(f"Новых файлов: {results['generated_files']}")
        logger.info(f"Существовало: {results['existing_files']}")
        logger.info(f"Ошибок: {results['errors']}")
        logger.info(f"Файлы сохранены в: {self.base_output_dir}/")
        
        # Показываем структуру директорий
        logger.info(f"\nСтруктура директорий:")
        for lang_code in ['en', 'ru']:
            lang_dir = Path(self.base_output_dir) / lang_code
            if lang_dir.exists():
                mp3_files = list(lang_dir.glob("*.mp3"))
                logger.info(f"  {lang_code}/ - {len(mp3_files)} файлов")
        
        return results

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Генератор речи с поддержкой Edge-TTS')
    parser.add_argument('json_file', help='Путь к JSON файлу с фразами')
    parser.add_argument('--output-dir', default='output',
                       help='Директория для сохранения аудиофайлов')
    parser.add_argument('--use-gtts', action='store_true',
                       help='Использовать gTTS вместо Edge-TTS')
    parser.add_argument('--voice', help='Имя конкретного голоса для Edge-TTS')
    parser.add_argument('--voice-type', default='female', help='male or female')
    
    args = parser.parse_args()
    
    # Создаем генератор
    generator = EnhancedSpeechGenerator(
        json_file_path=args.json_file,
        use_edge_tts=not args.use_gtts,  # Если указан --use-gtts, то не использовать Edge-TTS
        voice_name=args.voice,
        voice_type=args.voice_type,
        output_dir=args.output_dir
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
    print(f"Аудиофайлы сохранены по категориям в: {generator.base_output_dir}/")

if __name__ == "__main__":
    main()