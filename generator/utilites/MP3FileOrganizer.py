import os
import shutil
from pathlib import Path
import argparse
import logging
from typing import List, Tuple, Dict

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class MP3FileOrganizer:
    def __init__(self, base_dir: str, dry_run: bool = False):
        """
        Инициализация организатора MP3 файлов
        
        Args:
            base_dir: Базовая директория для сканирования
            dry_run: Режим тестирования (без реального перемещения файлов)
        """
        self.base_dir = Path(base_dir).resolve()
        self.dry_run = dry_run
        
        # Пары префикс-папка
        self.prefix_folders = {
            'ru_': 'ru',
            'en_': 'en',
            'de_': 'de',
            'fr_': 'fr',
            'es_': 'es',
            'zh_': 'zh',
            'ja_': 'ja'
        }
        
        # Статистика
        self.stats = {
            'total_mp3_files': 0,
            'files_moved': 0,
            'files_skipped': 0,
            'folders_created': 0,
            'errors': 0
        }
        
    def scan_directory(self) -> List[Path]:
        """
        Сканирование директории на наличие MP3 файлов
        
        Returns:
            Список путей к MP3 файлам
        """
        mp3_files = []
        
        # Рекурсивно ищем все MP3 файлы
        for root, dirs, files in os.walk(self.base_dir):
            for file in files:
                if file.lower().endswith('.mp3'):
                    file_path = Path(root) / file
                    mp3_files.append(file_path)
        
        logger.info(f"Найдено {len(mp3_files)} MP3 файлов")
        return mp3_files
    
    def get_prefix_folder(self, filename: str) -> Tuple[str, str]:
        """
        Определение целевой папки по префиксу имени файла
        
        Args:
            filename: Имя файла
        
        Returns:
            Кортеж (префикс, имя_папки) или (None, None) если префикс не найден
        """
        filename_lower = filename.lower()
        
        for prefix, folder in self.prefix_folders.items():
            if filename_lower.startswith(prefix):
                return prefix, folder
        
        # Проверяем другие возможные префиксы
        if filename_lower.startswith('rus_'):
            return 'rus_', 'ru'
        elif filename_lower.startswith('eng_'):
            return 'eng_', 'en'
        elif filename_lower.startswith('german_'):
            return 'german_', 'de'
        elif filename_lower.startswith('french_'):
            return 'french_', 'fr'
        elif filename_lower.startswith('spanish_'):
            return 'spanish_', 'es'
        elif filename_lower.startswith('chinese_'):
            return 'chinese_', 'zh'
        elif filename_lower.startswith('japanese_'):
            return 'japanese_', 'ja'
        
        return None, None
    
    def create_target_folder(self, folder_path: Path) -> bool:
        """
        Создание целевой папки если она не существует
        
        Args:
            folder_path: Путь к папке
        
        Returns:
            True если папка создана или уже существует
        """
        try:
            if not folder_path.exists():
                if not self.dry_run:
                    folder_path.mkdir(parents=True, exist_ok=True)
                logger.debug(f"Создана папка: {folder_path}")
                self.stats['folders_created'] += 1
            return True
        except Exception as e:
            logger.error(f"Ошибка создания папки {folder_path}: {e}")
            self.stats['errors'] += 1
            return False
    
    def move_mp3_file(self, src_file: Path, target_folder: Path) -> bool:
        """
        Перемещение MP3 файла в целевую папку
        
        Args:
            src_file: Исходный файл
            target_folder: Целевая папка
        
        Returns:
            True если файл успешно перемещен
        """
        try:
            target_file = target_folder / src_file.name
            
            if target_file.exists():
                logger.warning(f"Файл уже существует в целевой папке: {target_file}")
                # Добавляем суффикс к имени файла
                counter = 1
                while target_file.exists():
                    new_name = f"{src_file.stem}_{counter}{src_file.suffix}"
                    target_file = target_folder / new_name
                    counter += 1
                logger.info(f"Изменили имя на: {target_file.name}")
            
            if self.dry_run:
                logger.info(f"DRY RUN: Переместили бы {src_file} -> {target_file}")
            else:
                shutil.move(str(src_file), str(target_file))
                logger.info(f"Перемещено: {src_file.name} -> {target_folder.name}/")
            
            self.stats['files_moved'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Ошибка перемещения файла {src_file}: {e}")
            self.stats['errors'] += 1
            return False
    
    def process_file(self, mp3_file: Path) -> bool:
        """
        Обработка одного MP3 файла
        
        Args:
            mp3_file: Путь к MP3 файлу
        
        Returns:
            True если файл успешно обработан
        """
        filename = mp3_file.name
        prefix, folder_name = self.get_prefix_folder(filename)
        
        if not prefix:
            logger.warning(f"Неизвестный префикс у файла: {filename}")
            self.stats['files_skipped'] += 1
            return False
        
        # Создаем целевую папку
        target_folder = self.base_dir / folder_name
        if not self.create_target_folder(target_folder):
            return False
        
        # Перемещаем файл
        if not self.move_mp3_file(mp3_file, target_folder):
            return False
        
        return True
    
    def run(self) -> Dict:
        """
        Запуск процесса организации файлов
        
        Returns:
            Словарь со статистикой
        """
        logger.info(f"Начинаем сканирование директории: {self.base_dir}")
        logger.info(f"Режим тестирования: {'ДА' if self.dry_run else 'НЕТ'}")
        
        # Сканируем MP3 файлы
        mp3_files = self.scan_directory()
        self.stats['total_mp3_files'] = len(mp3_files)
        
        if not mp3_files:
            logger.warning("MP3 файлы не найдены!")
            return self.stats
        
        # Обрабатываем каждый файл
        for i, mp3_file in enumerate(mp3_files, 1):
            logger.info(f"[{i}/{len(mp3_files)}] Обработка: {mp3_file.name}")
            self.process_file(mp3_file)
        
        # Выводим статистику
        self.print_stats()
        
        return self.stats
    
    def print_stats(self):
        """Вывод статистики обработки"""
        print("\n" + "="*60)
        print("СТАТИСТИКА ОБРАБОТКИ")
        print("="*60)
        print(f"Всего MP3 файлов: {self.stats['total_mp3_files']}")
        print(f"Перемещено файлов: {self.stats['files_moved']}")
        print(f"Пропущено файлов: {self.stats['files_skipped']}")
        print(f"Создано папок: {self.stats['folders_created']}")
        print(f"Ошибок: {self.stats['errors']}")
        
        if self.dry_run:
            print("\n⚠️  РЕЖИМ ТЕСТИРОВАНИЯ - файлы не были перемещены!")
        
        print("\nСтруктура папок после обработки:")
        self.print_folder_structure()
    
    def print_folder_structure(self):
        """Вывод структуры папок"""
        if not self.base_dir.exists():
            print(f"Директория {self.base_dir} не существует")
            return
        
        print(f"\n{self.base_dir}/")
        
        for item in sorted(self.base_dir.iterdir()):
            if item.is_dir():
                # Считаем MP3 файлы в папке
                mp3_count = len(list(item.glob("*.mp3")))
                print(f"  ├── {item.name}/ ({mp3_count} MP3 файлов)")
            elif item.is_file() and item.suffix.lower() == '.mp3':
                print(f"  ├── {item.name} (не перемещен)")

def main():
    """Основная функция"""
    parser = argparse.ArgumentParser(
        description='Организация MP3 файлов по папкам на основе префиксов'
    )
    
    parser.add_argument(
        'directory',
        help='Директория для сканирования'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Режим тестирования (без реального перемещения файлов)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Подробный вывод (debug уровень)'
    )
    
    parser.add_argument(
        '--add-prefix',
        action='append',
        help='Добавить пользовательское соответствие префикс->папка (формат: ru_:russian)'
    )
    
    args = parser.parse_args()
    
    # Настройка уровня логирования
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Проверяем существование директории
    if not Path(args.directory).exists():
        logger.error(f"Директория не существует: {args.directory}")
        return
    
    # Создаем организатор
    organizer = MP3FileOrganizer(args.directory, args.dry_run)
    
    # Добавляем пользовательские префиксы если есть
    if args.add_prefix:
        for mapping in args.add_prefix:
            if ':' in mapping:
                prefix, folder = mapping.split(':', 1)
                organizer.prefix_folders[prefix] = folder
                logger.info(f"Добавлено соответствие: {prefix} -> {folder}")
    
    # Запускаем обработку
    organizer.run()

if __name__ == "__main__":
    main()