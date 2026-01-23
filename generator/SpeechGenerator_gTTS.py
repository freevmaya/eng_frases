from gtts import gTTS
import json
import hashlib
import os
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import requests

class SpeechGenerator:
    def __init__(self, json_file_path: Optional[str] = None):
        """
        Инициализация генератора речи с использованием gTTS
        
        Args:
            json_file_path: Путь к JSON файлу с фразами
        """
        self.json_file_path = json_file_path
        self.phrases_data = None
        
        # Директория для сохранения аудиофайлов
        self.base_output_dir = "../public/data/audio_files_gtts"
        Path(self.base_output_dir).mkdir(exist_ok=True)
        
        # Настройки для gTTS
        self.language_map = {
            'target': 'en',    # Английский
            'native': 'ru'     # Русский
        }
        
        # Задержка между запросами (чтобы не превысить лимиты)
        self.request_delay = 0.5
        
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
            # Английский с разными акцентами
            return ('en', 'com', 1.0)  # Американский английский
            # Для британского английского: return ('en', 'co.uk', 1.0)
        else:  # 'native'
            # Русский
            return ('ru', 'com', 0.9)  # Немного медленнее для русского
    
    def load_json_data(self, json_file_path: Optional[str] = None) -> Dict:
        """
        Загрузка данных из JSON файла
        
        Args:
            json_file_path: Путь к JSON файлу
        
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
            print(f"✓ Загружено {len(self.phrases_data)} категорий фраз")
            return self.phrases_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Ошибка чтения JSON файла: {e}")
    
    def _generate_filename(self, phrase: str, phrase_type: str = 'target') -> str:
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
        
        # Добавляем префикс языка
        lang_code = self.language_map.get(phrase_type, 'unknown')
        
        return f"{lang_code}_{phrase_hash}.mp3"
    
    def generate_audio(self, phrase: str, phrase_type: str = 'target', 
                      output_dir: Optional[Path] = None) -> Optional[Dict]:
        """
        Генерация аудиофайла для одной фразы с использованием gTTS
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы ('target' или 'native')
            output_dir: Директория для сохранения
        
        Returns:
            dict: Информация о сгенерированном файле или None при ошибке
        """
        if not phrase or not isinstance(phrase, str):
            print("✗ Пустая фраза")
            return None
        
        # Генерация имени файла
        filename = self._generate_filename(phrase, phrase_type)
        
        # Определение директории для сохранения
        if output_dir:
            save_dir = output_dir
        else:
            save_dir = Path(self.base_output_dir)
        
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Полный путь к файлу
        filepath = save_dir / filename
        
        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            print(f"✓ Файл уже существует: {filename}")
            return {
                'phrase': phrase,
                'phrase_type': phrase_type,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True
            }
        
        # Получаем настройки языка
        lang, tld, slow = self._get_language_settings(phrase_type)
        
        try:
            print(f"  Генерация аудио для: '{phrase[:50]}...'")
            
            # Создаем gTTS объект
            tts = gTTS(
                text=phrase,
                lang=lang,
                tld=tld,
                slow=False
            )
            
            # Сохраняем в файл
            tts.save(str(filepath))
            
            # Добавляем задержку между запросами
            time.sleep(self.request_delay)
            
            # Проверяем, что файл создан
            if filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                print(f"  ✓ Создан: {filename} ({file_size_kb:.1f} KB)")
                
                return {
                    'phrase': phrase,
                    'phrase_type': phrase_type,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False
                }
            else:
                print(f"✗ Ошибка: файл не создан или пустой: {filename}")
                return None
                
        except Exception as e:
            print(f"✗ Ошибка при генерации аудио для '{phrase[:30]}...': {str(e)}")
            return None
    
    def generate_all_from_json(self, json_file_path: Optional[str] = None) -> Dict:
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
        
        # Проверяем интернет-соединение
        if not self._check_internet_connection():
            return {"error": "Требуется интернет-соединение для gTTS"}
        
        results = {
            'total_categories': 0,
            'total_phrases': 0,
            'generated_files': 0,
            'existing_files': 0,
            'errors': 0,
            'categories': {}
        }
        
        print("\n" + "="*60)
        print("НАЧАЛО ГЕНЕРАЦИИ АУДИОФАЙЛОВ С gTTS")
        print("="*60)
        
        # Обрабатываем каждую категорию
        for category, phrases_list in data.items():
            print(f"\n{'='*50}")
            print(f"Категория: {category}")
            print(f"Количество фраз: {len(phrases_list)}")
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
                
                # Генерация английской версии (target)
                if target_phrase:
                    print(f"    EN: {target_phrase}")
                    target_result = self.generate_audio(
                        target_phrase, 
                        'target', 
                        category_dir
                    )
                    
                    if target_result:
                        if target_result.get('already_exists'):
                            category_results['target_files'] += 1
                            results['existing_files'] += 1
                            print(f"    ✓ Английский файл уже существует")
                        else:
                            category_results['target_files'] += 1
                            results['generated_files'] += 1
                            print(f"    ✓ Английский файл создан")
                        category_results['files'].append(target_result)
                    else:
                        category_results['errors'] += 1
                        results['errors'] += 1
                        print(f"    ✗ Ошибка создания английского файла")
                
                # Генерация русской версии (native)
                if native_phrase:
                    print(f"    RU: {native_phrase}")
                    native_result = self.generate_audio(
                        native_phrase, 
                        'native', 
                        category_dir
                    )
                    
                    if native_result:
                        if native_result.get('already_exists'):
                            category_results['native_files'] += 1
                            results['existing_files'] += 1
                            print(f"    ✓ Русский файл уже существует")
                        else:
                            category_results['native_files'] += 1
                            results['generated_files'] += 1
                            print(f"    ✓ Русский файл создан")
                        category_results['files'].append(native_result)
                    else:
                        category_results['errors'] += 1
                        results['errors'] += 1
                        print(f"    ✗ Ошибка создания русского файла")
                
                results['total_phrases'] += 1
            
            # Сохраняем результаты по категории
            results['categories'][category] = category_results
            results['total_categories'] += 1
            
            # Создаем JSON с метаданными для категории
            self._create_category_metadata(category, category_results)
        
        # Создаем общий файл метаданных
        self._create_overall_metadata(results)
        
        return results
    
    def _create_category_metadata(self, category: str, category_results: Dict):
        """Создание файла метаданных для категории"""
        metadata_file = Path(self.base_output_dir) / category / "metadata.json"
        
        metadata = {
            'category': category,
            'total_target_files': category_results['target_files'],
            'total_native_files': category_results['native_files'],
            'total_files': category_results['target_files'] + category_results['native_files'],
            'errors': category_results['errors'],
            'files': category_results['files'],
            'generated_with': 'gTTS',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        try:
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"  ✓ Метаданные сохранены: {metadata_file.name}")
        except Exception as e:
            print(f"  ✗ Ошибка при сохранении метаданных: {e}")
    
    def _create_overall_metadata(self, results: Dict):
        """Создание общего файла метаданных"""
        metadata_file = Path(self.base_output_dir) / "overall_metadata.json"
        
        metadata = {
            'total_categories': results['total_categories'],
            'total_phrases': results['total_phrases'],
            'total_generated_files': results['generated_files'],
            'total_existing_files': results['existing_files'],
            'total_errors': results['errors'],
            'generated_with': 'gTTS',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
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
            print(f"\n✓ Общие метаданные сохранены: {metadata_file}")
        except Exception as e:
            print(f"✗ Ошибка при сохранении общих метаданных: {e}")
    
    def get_file_info(self, phrase: str, phrase_type: str = 'target', 
                     category: Optional[str] = None) -> Dict:
        """
        Получение информации о файле для фразы
        
        Args:
            phrase: Текст фразы
            phrase_type: Тип фразы
            category: Категория
        
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
                    'category': category,
                    'file_size': filepath.stat().st_size
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
                        'category': category_dir.name,
                        'file_size': filepath.stat().st_size
                    }
        
        return {'exists': False, 'filename': filename}
    
    def generate_single_category(self, category_name: str, phrases_list: List[Dict]):
        """
        Генерация аудио для одной категории
        
        Args:
            category_name: Название категории
            phrases_list: Список фраз в формате [{"target": "...", "native": "..."}]
        
        Returns:
            dict: Результаты генерации
        """
        print(f"\nГенерация категории: {category_name}")
        
        # Создаем подпапку для категории
        category_dir = Path(self.base_output_dir) / category_name
        category_dir.mkdir(parents=True, exist_ok=True)
        
        results = {
            'category': category_name,
            'target_files': 0,
            'native_files': 0,
            'errors': 0,
            'files': []
        }
        
        for i, phrase_pair in enumerate(phrases_list, 1):
            target_phrase = phrase_pair.get('target', '').strip()
            native_phrase = phrase_pair.get('native', '').strip()
            
            if target_phrase:
                target_result = self.generate_audio(target_phrase, 'target', category_dir)
                if target_result:
                    if target_result.get('already_exists'):
                        results['target_files'] += 1
                    else:
                        results['target_files'] += 1
                    results['files'].append(target_result)
                else:
                    results['errors'] += 1
            
            if native_phrase:
                native_result = self.generate_audio(native_phrase, 'native', category_dir)
                if native_result:
                    if native_result.get('already_exists'):
                        results['native_files'] += 1
                    else:
                        results['native_files'] += 1
                    results['files'].append(native_result)
                else:
                    results['errors'] += 1
        
        # Сохраняем метаданные
        self._create_category_metadata(category_name, results)
        
        return results
    
    def cleanup(self):
        """Очистка (gTTS не требует специальной очистки)"""
        pass

# Дополнительные утилиты
class AudioBatchProcessor:
    """Класс для пакетной обработки аудиофайлов"""
    
    @staticmethod
    def create_sample_json(output_path: str = 'phrases.json'):
        """Создание примерного JSON файла"""
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
                {"target": "We are watching TV.", "native": "Мы смотрим телевизор."},
                {"target": "They are playing football.", "native": "Они играют в футбол."}
            ],
            "Future tense": [
                {"target": "I will go to the cinema tomorrow.", "native": "Я пойду в кино завтра."},
                {"target": "She is going to visit her parents.", "native": "Она собирается навестить своих родителей."},
                {"target": "We will have a meeting at 5 PM.", "native": "У нас будет встреча в 5 вечера."}
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sample_data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ Создан пример JSON файла: {output_path}")
        return output_path
    
    @staticmethod
    def verify_audio_files(json_file_path: str, audio_dir: str = 'audio_files_gtts'):
        """Проверка соответствия JSON и сгенерированных файлов"""
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print("\n" + "="*60)
        print("ПРОВЕРКА СООТВЕТСТВИЯ АУДИОФАЙЛОВ")
        print("="*60)
        
        stats = {
            'total_phrases': 0,
            'expected_files': 0,
            'found_files': 0,
            'missing_files': [],
            'categories': {}
        }
        
        for category, phrases_list in data.items():
            category_stats = {
                'expected': 0,
                'found': 0,
                'missing': []
            }
            
            category_dir = Path(audio_dir) / category
            
            for phrase_pair in phrases_list:
                stats['total_phrases'] += 1
                
                # Проверка английской фразы
                if 'target' in phrase_pair and phrase_pair['target'].strip():
                    stats['expected_files'] += 1
                    category_stats['expected'] += 1
                    
                    phrase = phrase_pair['target'].strip()
                    filename = f"en_{hashlib.md5(phrase.encode('utf-8')).hexdigest()}.mp3"
                    filepath = category_dir / filename
                    
                    if filepath.exists():
                        stats['found_files'] += 1
                        category_stats['found'] += 1
                    else:
                        category_stats['missing'].append(f"EN: {phrase}")
                        stats['missing_files'].append({
                            'category': category,
                            'type': 'target',
                            'phrase': phrase,
                            'filename': filename
                        })
                
                # Проверка русской фразы
                if 'native' in phrase_pair and phrase_pair['native'].strip():
                    stats['expected_files'] += 1
                    category_stats['expected'] += 1
                    
                    phrase = phrase_pair['native'].strip()
                    filename = f"ru_{hashlib.md5(phrase.encode('utf-8')).hexdigest()}.mp3"
                    filepath = category_dir / filename
                    
                    if filepath.exists():
                        stats['found_files'] += 1
                        category_stats['found'] += 1
                    else:
                        category_stats['missing'].append(f"RU: {phrase}")
                        stats['missing_files'].append({
                            'category': category,
                            'type': 'native',
                            'phrase': phrase,
                            'filename': filename
                        })
            
            stats['categories'][category] = category_stats
        
        # Вывод результатов
        print(f"\nОбщая статистика:")
        print(f"  Всего фраз: {stats['total_phrases']}")
        print(f"  Ожидается файлов: {stats['expected_files']}")
        print(f"  Найдено файлов: {stats['found_files']}")
        print(f"  Отсутствует файлов: {len(stats['missing_files'])}")
        
        if stats['missing_files']:
            print(f"\nОтсутствующие файлы:")
            for missing in stats['missing_files'][:10]:  # Показываем первые 10
                print(f"  • [{missing['category']}] {missing['type']}: {missing['phrase'][:50]}...")
            if len(stats['missing_files']) > 10:
                print(f"  ... и еще {len(stats['missing_files']) - 10} файлов")
        
        # Сохраняем отчет
        report_file = Path(audio_dir) / "verification_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Отчет проверки сохранен: {report_file}")
        
        return stats

# Пример использования
if __name__ == "__main__":
    import sys
    
    print("ГЕНЕРАТОР РЕЧИ С ИСПОЛЬЗОВАНИЕМ gTTS")
    print("="*60)
    json_file = 'C:\\OpenServer\\domains\\eng_frases\\public\\data\\en-ru.json'
    
    # Создаем пример JSON файла
    # AudioBatchProcessor.create_sample_json(json_file)
    
    try:
        # Инициализация генератора
        generator = SpeechGenerator(json_file)
        
        # Опции выполнения
        if len(sys.argv) > 1:
            mode = sys.argv[1]
            
            if mode == '--verify':
                # Только проверка существующих файлов
                AudioBatchProcessor.verify_audio_files(json_file)
                sys.exit(0)
            
            elif mode == '--single':
                # Генерация одной категории
                if len(sys.argv) > 2:
                    category_name = sys.argv[2]
                    # Загружаем данные
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if category_name in data:
                        result = generator.generate_single_category(
                            category_name, 
                            data[category_name]
                        )
                        print(f"\nРезультаты для категории '{category_name}':")
                        print(f"  Английских файлов: {result['target_files']}")
                        print(f"  Русских файлов: {result['native_files']}")
                        print(f"  Ошибок: {result['errors']}")
                    else:
                        print(f"Категория '{category_name}' не найдена в JSON файле")
                else:
                    print("Укажите название категории: python script.py --single 'Past simple'")
                
                sys.exit(0)
        
        # Полная генерация всех аудиофайлов
        print("\nЗапуск полной генерации аудиофайлов...")
        results = generator.generate_all_from_json()
        
        print("\n" + "="*60)
        print("ИТОГОВЫЕ РЕЗУЛЬТАТЫ:")
        print("="*60)
        print(f"Всего категорий: {results['total_categories']}")
        print(f"Всего фраз: {results['total_phrases']}")
        print(f"Создано новых файлов: {results['generated_files']}")
        print(f"Уже существовало файлов: {results['existing_files']}")
        print(f"Ошибок: {results['errors']}")
        
        # Показываем статистику по категориям
        print("\nСтатистика по категориям:")
        for category, data in results.get('categories', {}).items():
            total_files = data['target_files'] + data['native_files']
            print(f"  • {category}: {total_files} файлов "
                  f"({data['target_files']} EN, {data['native_files']} RU)")
        
        # Проверка соответствия файлов
        print("\n" + "="*60)
        print("ПРОВЕРКА СООТВЕТСТВИЯ:")
        print("="*60)
        AudioBatchProcessor.verify_audio_files(json_file)
        
        # Пример поиска файла
        print("\n" + "="*60)
        print("ПРИМЕР ПОИСКА ФАЙЛА:")
        print("="*60)
        
        test_phrase = "I worked yesterday."
        file_info = generator.get_file_info(test_phrase, 'target')
        
        if file_info['exists']:
            print(f"Найден файл для фразы: '{test_phrase}'")
            print(f"  Имя файла: {file_info['filename']}")
            print(f"  Путь: {file_info['filepath']}")
            print(f"  Размер: {file_info['file_size'] / 1024:.1f} KB")
            
            # Проверяем MD5 хэш
            expected_hash = hashlib.md5(test_phrase.encode('utf-8')).hexdigest()
            expected_filename = f"en_{expected_hash}.mp3"
            
            if file_info['filename'] == expected_filename:
                print(f"  ✓ MD5 хэш совпадает: {expected_hash[:8]}...")
            else:
                print(f"  ✗ Ошибка: имя файла не соответствует MD5 хэшу")
        else:
            print(f"Файл для фразы '{test_phrase}' не найден")
        
        print(f"\n✓ Генерация завершена!")
        print(f"  Аудиофайлы сохранены в: {generator.base_output_dir}/")
        
    except KeyboardInterrupt:
        print("\n\n✗ Генерация прервана пользователем")
    except Exception as e:
        print(f"\n✗ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()