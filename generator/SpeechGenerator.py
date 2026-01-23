import pyttsx3
import json
import hashlib
import os
from pathlib import Path

class SpeechGenerator:
    def __init__(self, json_file_path=None):
        """
        Инициализация генератора речи
        
        Args:
            json_file_path: Путь к JSON файлу с фразами
        """
        self.engine = pyttsx3.init()
        self.json_file_path = json_file_path
        self.phrases_data = None
        
        # Настройка голосов
        self._setup_voices()
        
        # Директория для сохранения аудиофайлов
        self.base_output_dir = "../public/data/audio_files"
        Path(self.base_output_dir).mkdir(exist_ok=True)
        
    def _setup_voices(self):
        """Настройка голосов для разных языков"""
        voices = self.engine.getProperty('voices')
        
        # Автоматический поиск голосов
        self.english_voice_id = None
        self.russian_voice_id = None
        
        for voice in voices:
            voice_name = voice.name.lower()
            voice_id = voice.id.lower()
            
            # Поиск английского голоса
            if ('english' in voice_name or 'en' in voice_id or 
                'us' in voice_name or 'uk' in voice_name):
                self.english_voice_id = voice.id
            
            # Поиск русского голоса
            if ('russian' in voice_name or 'ru' in voice_id or 
                'russia' in voice_name):
                self.russian_voice_id = voice.id
        
        # Если голоса не найдены, используем первый доступный
        if not self.english_voice_id and voices:
            self.english_voice_id = voices[0].id
        if not self.russian_voice_id and voices:
            self.russian_voice_id = voices[0].id
        
        print(f"Используется английский голос: {self.english_voice_id}")
        print(f"Используется русский голос: {self.russian_voice_id}")
    
    def load_json_data(self, json_file_path=None):
        """
        Загрузка данных из JSON файла
        
        Args:
            json_file_path: Путь к JSON файлу (если None, использует self.json_file_path)
        
        Returns:
            dict: Загруженные данные
        """
        if json_file_path:
            self.json_file_path = json_file_path
        
        if not self.json_file_path or not os.path.exists(self.json_file_path):
            raise FileNotFoundError(f"JSON файл не найден: {self.json_file_path}")
        
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                self.phrases_data = json.load(f)
            print(f"Загружено {len(self.phrases_data)} категорий фраз")
            return self.phrases_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Ошибка чтения JSON файла: {e}")
    
    def _generate_filename(self, phrase, phrase_type='target'):
        """
        Генерация имени файла на основе фразы
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы ('target' или 'native')
        
        Returns:
            str: Имя файла в формате md5(phrase) + '.mp3'
        """
        # Создаем MD5 хэш фразы
        phrase_hash = hashlib.md5(phrase.encode('utf-8')).hexdigest()
        
        # Добавляем префикс типа фразы для удобства
        prefix = "en" if phrase_type == 'target' else "ru"
        
        return f"{prefix}_{phrase_hash}.mp3"
    
    def _get_phrase_type_info(self, phrase_type):
        """
        Получение информации о типе фразы
        
        Returns:
            tuple: (язык, голос, скорость)
        """
        if phrase_type == 'target':
            return ('en-US', self.english_voice_id, 160)  # Английский
        else:  # 'native'
            return ('ru-RU', self.russian_voice_id, 140)  # Русский
    
    def generate_audio(self, phrase, phrase_type='target', output_dir=None):
        """
        Генерация аудиофайла для одной фразы
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы ('target' или 'native')
            output_dir: Директория для сохранения
        
        Returns:
            dict: Информация о сгенерированном файле
        """
        if not phrase or not isinstance(phrase, str):
            return None
        
        # Генерация имени файла
        filename = self._generate_filename(phrase, phrase_type)
        
        # Определение директории для сохранения
        if output_dir:
            save_dir = Path(output_dir)
        else:
            save_dir = Path(self.base_output_dir)
        
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists():
            print(f"Файл уже существует: {filepath}")
            return {
                'phrase': phrase,
                'phrase_type': phrase_type,
                'filename': filename,
                'filepath': str(filepath),
                'already_exists': True
            }
        
        # Получаем настройки для типа фразы
        lang, voice_id, speed = self._get_phrase_type_info(phrase_type)
        
        try:
            # Настройка голоса и параметров
            self.engine.setProperty('voice', voice_id)
            self.engine.setProperty('rate', speed)
            self.engine.setProperty('volume', 0.9)
            
            # Сохранение в файл
            self.engine.save_to_file(phrase, str(filepath))
            self.engine.runAndWait()
            
            # Проверяем, что файл создан
            if filepath.exists() and filepath.stat().st_size > 0:
                print(f"✓ Создан файл: {filepath}")
                
                return {
                    'phrase': phrase,
                    'phrase_type': phrase_type,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False
                }
            else:
                print(f"✗ Ошибка: файл не создан или пустой: {filepath}")
                return None
                
        except Exception as e:
            print(f"✗ Ошибка при генерации аудио для фразы '{phrase}': {e}")
            return None
    
    def generate_all_from_json(self, json_file_path=None):
        """
        Генерация аудиофайлов для всех фраз из JSON
        
        Args:
            json_file_path: Путь к JSON файлу
        
        Returns:
            dict: Статистика по сгенерированным файлам
        """
        # Загружаем данные
        data = self.load_json_data(json_file_path)
        
        if not data:
            return {"error": "Нет данных для обработки"}
        
        results = {
            'total_categories': 0,
            'total_phrases': 0,
            'generated_files': 0,
            'existing_files': 0,
            'errors': 0,
            'categories': {}
        }
        
        # Обрабатываем каждую категорию
        for category, phrases_list in data.items():
            print(f"\n{'='*50}")
            print(f"Обработка категории: {category}")
            print(f"{'='*50}")
            
            # Создаем подпапку для категории
            category_dir = Path(self.base_output_dir) / category
            category_dir.mkdir(parents=True, exist_ok=True)
            
            category_results = {
                'category': category,
                'directory': str(category_dir),
                'target_files': 0,
                'native_files': 0,
                'errors': 0,
                'files': []
            }
            
            # Обрабатываем каждую фразу в категории
            for i, phrase_pair in enumerate(phrases_list, 1):
                target_phrase = phrase_pair.get('target', '').strip()
                native_phrase = phrase_pair.get('native', '').strip()
                
                if not target_phrase and not native_phrase:
                    print(f"  Пропущена пустая фраза #{i}")
                    continue
                
                print(f"\n  Фраза #{i}:")
                print(f"    EN: {target_phrase}")
                print(f"    RU: {native_phrase}")
                
                # Генерация английской версии (target)
                if target_phrase:
                    target_result = self.generate_audio(
                        target_phrase, 
                        'target', 
                        category_dir
                    )
                    
                    if target_result:
                        if target_result.get('already_exists'):
                            category_results['target_files'] += 1
                            results['existing_files'] += 1
                        else:
                            category_results['target_files'] += 1
                            results['generated_files'] += 1
                        category_results['files'].append(target_result)
                    else:
                        category_results['errors'] += 1
                        results['errors'] += 1
                
                # Генерация русской версии (native)
                if native_phrase:
                    native_result = self.generate_audio(
                        native_phrase, 
                        'native', 
                        category_dir
                    )
                    
                    if native_result:
                        if native_result.get('already_exists'):
                            category_results['native_files'] += 1
                            results['existing_files'] += 1
                        else:
                            category_results['native_files'] += 1
                            results['generated_files'] += 1
                        category_results['files'].append(native_result)
                    else:
                        category_results['errors'] += 1
                        results['errors'] += 1
                
                results['total_phrases'] += 1
            
            # Сохраняем результаты по категории
            results['categories'][category] = category_results
            results['total_categories'] += 1
            
            # Создаем JSON с метаданными для категории
            self._create_category_metadata(category, category_results)
        
        # Создаем общий файл метаданных
        self._create_overall_metadata(results)
        
        return results
    
    def _create_category_metadata(self, category, category_results):
        """Создание файла метаданных для категории"""
        metadata_file = Path(self.base_output_dir) / category / "metadata.json"
        
        metadata = {
            'category': category,
            'total_target_files': category_results['target_files'],
            'total_native_files': category_results['native_files'],
            'total_files': category_results['target_files'] + category_results['native_files'],
            'errors': category_results['errors'],
            'files': category_results['files']
        }
        
        try:
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"  Метаданные сохранены в: {metadata_file}")
        except Exception as e:
            print(f"  Ошибка при сохранении метаданных: {e}")
    
    def _create_overall_metadata(self, results):
        """Создание общего файла метаданных"""
        metadata_file = Path(self.base_output_dir) / "overall_metadata.json"
        
        metadata = {
            'total_categories': results['total_categories'],
            'total_phrases': results['total_phrases'],
            'total_generated_files': results['generated_files'],
            'total_existing_files': results['existing_files'],
            'total_errors': results['errors'],
            'categories_summary': {
                category: {
                    'target_files': data['target_files'],
                    'native_files': data['native_files'],
                    'total_files': data['target_files'] + data['native_files'],
                    'directory': data['directory']
                }
                for category, data in results['categories'].items()
            }
        }
        
        try:
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"\nОбщие метаданные сохранены в: {metadata_file}")
        except Exception as e:
            print(f"Ошибка при сохранении общих метаданных: {e}")
    
    def get_file_info(self, phrase, phrase_type='target', category=None):
        """
        Получение информации о файле для фразы
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы
            category: Категория (если известна)
        
        Returns:
            dict: Информация о файле
        """
        filename = self._generate_filename(phrase, phrase_type)
        
        # Если указана категория, ищем в конкретной папке
        if category:
            filepath = Path(self.base_output_dir) / category / filename
            if filepath.exists():
                return {
                    'exists': True,
                    'filename': filename,
                    'filepath': str(filepath),
                    'category': category
                }
        
        # Ищем во всех подпапках
        for category_dir in Path(self.base_output_dir).iterdir():
            if category_dir.is_dir():
                filepath = category_dir / filename
                if filepath.exists():
                    return {
                        'exists': True,
                        'filename': filename,
                        'filepath': str(filepath),
                        'category': category_dir.name
                    }
        
        return {'exists': False, 'filename': filename}
    
    def cleanup(self):
        """Очистка ресурсов"""
        try:
            self.engine.stop()
        except:
            pass

# Пример использования
if __name__ == "__main__":
    '''
    # Создаем пример JSON файла
    sample_data = {
        "Past simple": [
            {"target": "I worked yesterday.", "native": "Я работал вчера."},
            {"target": "She studied all night.", "native": "Она училась всю ночь."},
            {"target": "We watched a movie.", "native": "Мы смотрели фильм."},
            {"target": "He called you an hour ago.", "native": "Он звонил тебе час назад."}
        ],
        "Present continuous": [
            {"target": "I am working now.", "native": "Я работаю сейчас."},
            {"target": "She is studying.", "native": "Она учится."},
            {"target": "We are watching TV.", "native": "Мы смотрим телевизор."}
        ]
    }
    
    # Сохраняем пример JSON файла
    with open('phrases.json', 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    print("Создан пример файла phrases.json")
    '''
    
    # Инициализация генератора
    generator = SpeechGenerator('C:\\OpenServer\\domains\\eng_frases\\public\\data\\en-ru.json')
    
    try:
        # Генерация всех аудиофайлов
        results = generator.generate_all_from_json()
        
        print("\n" + "="*60)
        print("РЕЗУЛЬТАТЫ:")
        print("="*60)
        print(f"Всего категорий: {results['total_categories']}")
        print(f"Всего фраз: {results['total_phrases']}")
        print(f"Создано новых файлов: {results['generated_files']}")
        print(f"Уже существовало файлов: {results['existing_files']}")
        print(f"Ошибок: {results['errors']}")
        
        # Пример поиска файла
        print("\n" + "="*60)
        print("ПОИСК ФАЙЛА:")
        print("="*60)
        
        test_phrase = "I worked yesterday."
        file_info = generator.get_file_info(test_phrase, 'target')
        
        if file_info['exists']:
            print(f"Файл для фразы '{test_phrase}':")
            print(f"  Имя файла: {file_info['filename']}")
            print(f"  Путь: {file_info['filepath']}")
            print(f"  Категория: {file_info.get('category', 'неизвестно')}")
            
            # Проверка MD5 хэша
            expected_hash = hashlib.md5(test_phrase.encode('utf-8')).hexdigest()
            print(f"  MD5 хэш: {expected_hash}")
            
            # Проверяем, что имя файла совпадает
            if file_info['filename'] == f"en_{expected_hash}.mp3":
                print("  ✓ Проверка MD5 хэша пройдена")
            else:
                print("  ✗ Ошибка: имя файла не соответствует MD5 хэшу")
        else:
            print(f"Файл для фразы '{test_phrase}' не найден")
        
    except Exception as e:
        print(f"Ошибка: {e}")
    
    finally:
        generator.cleanup()