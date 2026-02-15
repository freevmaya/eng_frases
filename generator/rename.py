import os
from pathlib import Path
import logging
from typing import List, Tuple

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def rename_audio_files(base_dir: str = "../public/data/voices", min_size_bytes: int = 100 * 1024) -> dict:
    """
    Переименовывает файлы, удаляя префиксы male_ и female_
    
    Args:
        base_dir: Базовая директория для поиска файлов
        min_size_bytes: Минимальный размер файла в байтах (100 КБ = 102400 байт)
                       Файлы меньше этого размера будут перезаписаны
    
    Returns:
        dict: Статистика переименования
    """
    
    stats = {
        'male_renamed': 0,
        'female_renamed': 0,
        'skipped_exists_larger': 0,
        'overwritten_smaller': 0,
        'errors': 0,
        'total_files': 0
    }
    
    # Префиксы для удаления
    prefixes = ['male_', 'female_']
    
    # Преобразуем путь в объект Path
    base_path = Path(base_dir)
    
    if not base_path.exists():
        logger.error(f"Директория не найдена: {base_dir}")
        return stats
    
    logger.info(f"{'='*60}")
    logger.info(f"ПОИСК ФАЙЛОВ В: {base_path.absolute()}")
    logger.info(f"{'='*60}")
    
    # Рекурсивно обходим все поддиректории
    all_files = list(base_path.rglob("*.mp3"))
    stats['total_files'] = len(all_files)
    
    logger.info(f"Найдено MP3 файлов: {stats['total_files']}")
    logger.info(f"{'='*60}\n")
    
    for file_path in all_files:
        filename = file_path.name
        
        # Проверяем каждый префикс
        for prefix in prefixes:
            if filename.startswith(prefix):
                # Формируем новое имя файла (убираем префикс)
                new_filename = filename[len(prefix):]
                new_filepath = file_path.parent / new_filename
                
                # Определяем тип голоса для статистики
                voice_type = prefix[:-1]  # убираем подчеркивание
                
                logger.info(f"Файл: {filename}")
                logger.info(f"  -> Новое имя: {new_filename}")
                
                # Проверяем, существует ли уже файл с таким именем
                if new_filepath.exists():
                    old_size = new_filepath.stat().st_size
                    new_size = file_path.stat().st_size
                    
                    logger.info(f"  ! Файл уже существует: {new_filename}")
                    logger.info(f"    Размер существующего: {old_size/1024:.1f} КБ")
                    logger.info(f"    Размер нового: {new_size/1024:.1f} КБ")
                    
                    # Если существующий файл меньше минимального размера, перезаписываем
                    if old_size < min_size_bytes:
                        try:
                            # Удаляем старый файл
                            os.remove(new_filepath)
                            # Переименовываем новый
                            file_path.rename(new_filepath)
                            logger.info(f"  ✓ ПЕРЕЗАПИСАН (старый файл был меньше {min_size_bytes/1024:.0f} КБ)")
                            
                            if voice_type == 'male':
                                stats['male_renamed'] += 1
                            else:
                                stats['female_renamed'] += 1
                            stats['overwritten_smaller'] += 1
                            
                        except Exception as e:
                            logger.error(f"  ✗ Ошибка при перезаписи: {e}")
                            stats['errors'] += 1
                    else:
                        logger.info(f"  → ПРОПУЩЕН (существующий файл больше {min_size_bytes/1024:.0f} КБ)")
                        stats['skipped_exists_larger'] += 1
                else:
                    # Файл не существует, просто переименовываем
                    try:
                        file_path.rename(new_filepath)
                        logger.info(f"  ✓ ПЕРЕИМЕНОВАН")
                        
                        if voice_type == 'male':
                            stats['male_renamed'] += 1
                        else:
                            stats['female_renamed'] += 1
                            
                    except Exception as e:
                        logger.error(f"  ✗ Ошибка при переименовании: {e}")
                        stats['errors'] += 1
                
                logger.info("")  # Пустая строка для разделения
                break  # Выходим из цикла prefixes, так как файл уже обработан
    
    return stats

def rename_audio_files_with_preview(base_dir: str = "../public/data/voices", 
                                   min_size_bytes: int = 100 * 1024,
                                   dry_run: bool = False) -> dict:
    """
    Переименовывает файлы с предварительным просмотром
    
    Args:
        base_dir: Базовая директория для поиска файлов
        min_size_bytes: Минимальный размер файла в байтах
        dry_run: Если True, только показывает что будет сделано без реальных изменений
    
    Returns:
        dict: Статистика
    """
    
    stats = {
        'male_found': 0,
        'female_found': 0,
        'to_rename': 0,
        'to_overwrite': 0,
        'to_skip': 0,
        'total_files': 0
    }
    
    prefixes = ['male_', 'female_']
    base_path = Path(base_dir)
    
    if not base_path.exists():
        logger.error(f"Директория не найдена: {base_dir}")
        return stats
    
    mode = "ПРЕДПРОСМОТР (сухие запуски)" if dry_run else "РЕАЛЬНОЕ ПЕРЕИМЕНОВАНИЕ"
    
    logger.info(f"{'='*60}")
    logger.info(f"{mode}")
    logger.info(f"Директория: {base_path.absolute()}")
    logger.info(f"Минимальный размер для перезаписи: {min_size_bytes/1024:.0f} КБ")
    logger.info(f"{'='*60}")
    
    all_files = list(base_path.rglob("*.mp3"))
    stats['total_files'] = len(all_files)
    
    logger.info(f"Найдено MP3 файлов: {stats['total_files']}\n")
    
    for file_path in sorted(all_files):
        filename = file_path.name
        
        for prefix in prefixes:
            if filename.startswith(prefix):
                voice_type = prefix[:-1]
                new_filename = filename[len(prefix):]
                new_filepath = file_path.parent / new_filename
                
                stats[f'{voice_type}_found'] += 1
                
                action = "ПЕРЕИМЕНОВАТЬ"
                details = []
                
                if new_filepath.exists():
                    old_size = new_filepath.stat().st_size
                    new_size = file_path.stat().st_size
                    
                    if old_size < min_size_bytes:
                        action = "ПЕРЕЗАПИСАТЬ"
                        details = [f"(существующий {old_size/1024:.1f} КБ < {min_size_bytes/1024:.0f} КБ)"]
                        stats['to_overwrite'] += 1
                    else:
                        action = "ПРОПУСТИТЬ"
                        details = [f"(существующий {old_size/1024:.1f} КБ >= {min_size_bytes/1024:.0f} КБ)"]
                        stats['to_skip'] += 1
                else:
                    stats['to_rename'] += 1
                
                # Формируем строку для вывода
                rel_path = file_path.relative_to(base_path)
                new_rel_path = new_filepath.relative_to(base_path)
                
                status_icon = {
                    'ПЕРЕИМЕНОВАТЬ': '→',
                    'ПЕРЕЗАПИСАТЬ': '⚠',
                    'ПРОПУСТИТЬ': '○'
                }.get(action, '?')
                
                details_str = ' ' + ' '.join(details) if details else ''
                
                if dry_run:
                    logger.info(f"{status_icon} {rel_path}")
                    logger.info(f"    -> {new_rel_path}{details_str}")
                else:
                    logger.info(f"{status_icon} {filename}")
                    logger.info(f"    -> {new_filename}{details_str}")
                
                break
    
    logger.info(f"\n{'='*60}")
    logger.info("СТАТИСТИКА:")
    logger.info(f"{'='*60}")
    logger.info(f"Найдено male_ файлов: {stats['male_found']}")
    logger.info(f"Найдено female_ файлов: {stats['female_found']}")
    logger.info(f"Всего найдено: {stats['male_found'] + stats['female_found']}")
    logger.info(f"\nБудет переименовано (новые файлы): {stats['to_rename']}")
    logger.info(f"Будет перезаписано (существующие < {min_size_bytes/1024:.0f} КБ): {stats['to_overwrite']}")
    logger.info(f"Будет пропущено (существующие >= {min_size_bytes/1024:.0f} КБ): {stats['to_skip']}")
    
    return stats

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Переименование аудиофайлов (удаление префиксов male_/female_)')
    parser.add_argument('--dir', default='../public/data/voices',
                       help='Директория для поиска файлов (по умолчанию: ../public/data/voices)')
    parser.add_argument('--min-size', type=int, default=100,
                       help='Минимальный размер файла в КБ для сохранения (по умолчанию: 100)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Режим предпросмотра без реальных изменений')
    parser.add_argument('--execute', action='store_true',
                       help='Реально выполнить переименование (без этого флага только предпросмотр)')
    
    args = parser.parse_args()
    
    # Конвертируем КБ в байты
    min_size_bytes = args.min_size * 1024
    
    if args.execute:
        # Реальное переименование
        logger.info("РЕЖИМ: РЕАЛЬНОЕ ПЕРЕИМЕНОВАНИЕ\n")
        stats = rename_audio_files(args.dir, min_size_bytes)
        
        print(f"\n{'='*60}")
        print("ИТОГИ:")
        print(f"{'='*60}")
        print(f"Переименовано male_ файлов: {stats['male_renamed']}")
        print(f"Переименовано female_ файлов: {stats['female_renamed']}")
        print(f"Всего переименовано: {stats['male_renamed'] + stats['female_renamed']}")
        print(f"Перезаписано (маленькие файлы): {stats['overwritten_smaller']}")
        print(f"Пропущено (существующие >= {args.min_size} КБ): {stats['skipped_exists_larger']}")
        print(f"Ошибок: {stats['errors']}")
    else:
        # Режим предпросмотра
        logger.info("РЕЖИМ: ПРЕДПРОСМОТР (сухой запуски)\n")
        logger.info("Для реального переименования добавьте флаг --execute\n")
        rename_audio_files_with_preview(args.dir, min_size_bytes, dry_run=True)

if __name__ == "__main__":
    main()