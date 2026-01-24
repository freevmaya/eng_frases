import json
import hashlib
from pathlib import Path
from typing import Dict, List

class AudioBatchProcessor:
    """Класс для пакетной обработки аудиофайлов"""
    
    def __init__(self, base_audio_dir: str = '../public/data/audio_files_gtts'):
        """
        Инициализация процессора
        
        Args:
            base_audio_dir: Базовая директория с аудиофайлами
        """
        self.BASE_AUDIO_DIR = base_audio_dir
    
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
        phrase_hash = hashlib.md5(phrase.encode('utf-8')).hexdigest()
        return f"{language}_{phrase_hash}.mp3"
    
    def verify_audio_files(self, json_file_path: str) -> Dict:
        """
        Проверка соответствия JSON и сгенерированных файлов
        
        Args:
            json_file_path: Путь к JSON файлу с фразами
        
        Returns:
            dict: Статистика проверки
        """
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
            
            category_dir = Path(self.BASE_AUDIO_DIR) / category
            
            for phrase_pair in phrases_list:
                stats['total_phrases'] += 1
                
                # Проверка английской фразы
                if 'target' in phrase_pair and phrase_pair['target'].strip():
                    stats['expected_files'] += 1
                    category_stats['expected'] += 1
                    
                    phrase = phrase_pair['target'].strip()
                    filename = self._generate_filename(phrase, 'en')
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
                    filename = self._generate_filename(phrase, 'ru')
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
            for missing in stats['missing_files'][:10]:
                print(f"  • [{missing['category']}] {missing['type']}: {missing['phrase'][:50]}...")
            if len(stats['missing_files']) > 10:
                print(f"  ... и еще {len(stats['missing_files']) - 10} файлов")
        
        # Сохраняем отчет
        report_file = Path(self.BASE_AUDIO_DIR) / "verification_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Отчет проверки сохранен: {report_file}")
        
        return stats