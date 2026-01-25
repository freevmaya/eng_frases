import json
import mysql.connector
from mysql.connector import Error
from typing import Dict, List, Any
import sys
from pathlib import Path
import argparse
import logging
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class PhraseDatabaseImporter:
    def __init__(self, host: str, database: str, user: str, password: str, port: int = 3306):
        """
        Инициализация импортера базы данных
        
        Args:
            host: Хост MySQL
            database: Имя базы данных
            user: Имя пользователя
            password: Пароль
            port: Порт MySQL
        """
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.port = port
        
        # Подключение к базе данных
        self.connection = None
        self.cursor = None
        
    def connect(self):
        """Подключение к базе данных MySQL"""
        try:
            self.connection = mysql.connector.connect(
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password,
                port=self.port,
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci'
            )
            
            if self.connection.is_connected():
                self.cursor = self.connection.cursor()
                logger.info("✓ Подключение к MySQL успешно")
                
        except Error as e:
            logger.error(f"Ошибка подключения к MySQL: {e}")
            sys.exit(1)
    
    def disconnect(self):
        """Отключение от базы данных"""
        if self.connection and self.connection.is_connected():
            self.cursor.close()
            self.connection.close()
            logger.info("✗ Отключение от MySQL")
    
    def check_table_exists(self, table_name: str) -> bool:
        """Проверка существования таблицы"""
        try:
            self.cursor.execute(f"""
                SELECT COUNT(*)
                FROM information_schema.tables 
                WHERE table_schema = %s 
                AND table_name = %s
            """, (self.database, table_name))
            
            return self.cursor.fetchone()[0] == 1
            
        except Error as e:
            logger.error(f"Ошибка проверки таблицы {table_name}: {e}")
            return False
    
    def check_column_exists(self, table_name: str, column_name: str) -> bool:
        """Проверка существования столбца в таблице"""
        try:
            self.cursor.execute(f"""
                SELECT COUNT(*)
                FROM information_schema.columns 
                WHERE table_schema = %s 
                AND table_name = %s 
                AND column_name = %s
            """, (self.database, table_name, column_name))
            
            return self.cursor.fetchone()[0] == 1
            
        except Error as e:
            logger.error(f"Ошибка проверки столбца {column_name} в таблице {table_name}: {e}")
            return False
    
    def drop_table_if_exists(self, table_name: str):
        """Удаление таблицы если она существует"""
        try:
            if self.check_table_exists(table_name):
                self.cursor.execute(f"DROP TABLE {table_name}")
                self.connection.commit()
                logger.info(f"✓ Таблица {table_name} удалена")
                
        except Error as e:
            logger.error(f"Ошибка удаления таблицы {table_name}: {e}")
            self.connection.rollback()
    
    def create_tables(self):
        """Создание таблиц"""
        try:
            # Удаляем существующие таблицы
            self.drop_table_if_exists('phrases')
            self.drop_table_if_exists('phrase_types')
            
            # Таблица типов фраз (phrase_types)
            create_phrase_types_table = """
            CREATE TABLE phrase_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type_name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_type_name (type_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            
            # Таблица фраз (phrases)
            create_phrases_table = """
            CREATE TABLE phrases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type_id INT NOT NULL,
                target_text TEXT NOT NULL,
                native_text TEXT NOT NULL,
                direction VARCHAR(10) DEFAULT 'en-ru',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES phrase_types(id) ON DELETE CASCADE,
                INDEX idx_type_id (type_id),
                INDEX idx_direction (direction),
                INDEX idx_active (is_active),
                FULLTEXT idx_text_search (target_text, native_text)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            
            # Создаем таблицы
            self.cursor.execute(create_phrase_types_table)
            logger.info("✓ Таблица phrase_types создана")
            
            self.cursor.execute(create_phrases_table)
            logger.info("✓ Таблица phrases создана")
            
            self.connection.commit()
            
        except Error as e:
            logger.error(f"Ошибка создания таблиц: {e}")
            self.connection.rollback()
            raise
    
    def get_or_create_phrase_type(self, type_name: str) -> int:
        """
        Получение ID типа фразы или создание нового
        
        Args:
            type_name: Название типа фразы
        
        Returns:
            ID типа фразы
        """
        try:
            # Проверяем, существует ли таблица phrase_types
            if not self.check_table_exists('phrase_types'):
                logger.warning("Таблица phrase_types не существует. Создаем...")
                self.create_tables()
            
            # Проверяем структуру таблицы
            if not self.check_column_exists('phrase_types', 'type_name'):
                logger.warning("Столбец type_name не найден. Создаем таблицу заново...")
                self.create_tables()
            
            # Пытаемся найти существующий тип
            query = "SELECT id FROM phrase_types WHERE type_name = %s"
            self.cursor.execute(query, (type_name,))
            result = self.cursor.fetchone()
            
            if result:
                logger.debug(f"Тип фразы найден: {type_name} (ID: {result[0]})")
                return result[0]
            
            # Создаем новый тип
            query = "INSERT INTO phrase_types (type_name) VALUES (%s)"
            self.cursor.execute(query, (type_name,))
            self.connection.commit()
            
            type_id = self.cursor.lastrowid
            logger.info(f"✓ Создан новый тип фразы: {type_name} (ID: {type_id})")
            
            return type_id
            
        except Error as e:
            logger.error(f"Ошибка при работе с типом фразы '{type_name}': {e}")
            self.connection.rollback()
            raise
    
    def insert_phrase(self, type_id: int, target_text: str, native_text: str, direction: str = 'en-ru') -> bool:
        """
        Вставка фразы в базу данных
        
        Args:
            type_id: ID типа фразы
            target_text: Текст на целевом языке (английский)
            native_text: Текст на родном языке (русский)
            direction: Направление перевода (по умолчанию 'en-ru')
        
        Returns:
            True если успешно
        """
        try:
            # Проверяем, существует ли таблица phrases
            if not self.check_table_exists('phrases'):
                logger.warning("Таблица phrases не существует. Создаем...")
                self.create_tables()
            
            # Проверяем структуру таблицы
            if not all([
                self.check_column_exists('phrases', 'target_text'),
                self.check_column_exists('phrases', 'native_text'),
                self.check_column_exists('phrases', 'direction')
            ]):
                logger.warning("Неправильная структура таблицы phrases. Создаем заново...")
                self.create_tables()
            
            # Вставляем фразу
            query = """
            INSERT INTO phrases (type_id, target_text, native_text, direction)
            VALUES (%s, %s, %s, %s)
            """
            
            self.cursor.execute(query, (type_id, target_text, native_text, direction))
            self.connection.commit()
            
            phrase_id = self.cursor.lastrowid
            logger.debug(f"✓ Фраза добавлена (ID: {phrase_id})")
            
            return True
            
        except Error as e:
            logger.error(f"Ошибка при добавлении фразы: {e}")
            logger.error(f"Текст (EN): {target_text[:50]}...")
            logger.error(f"Текст (RU): {native_text[:50]}...")
            self.connection.rollback()
            return False
    
    def import_json_file(self, json_file_path: str, clear_existing: bool = False):
        """
        Импорт данных из JSON файла
        
        Args:
            json_file_path: Путь к JSON файлу
            clear_existing: Очистить существующие данные
        """
        # Проверяем существование файла
        if not Path(json_file_path).exists():
            logger.error(f"Файл не найден: {json_file_path}")
            return
        
        try:
            # Читаем JSON файл
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            logger.info(f"✓ Файл прочитан: {json_file_path}")
            logger.info(f"Количество категорий: {len(data)}")
            
            # Очищаем существующие данные если нужно
            if clear_existing:
                self.clear_all_data()
            
            # Статистика
            stats = {
                'total_types': 0,
                'total_phrases': 0,
                'errors': 0
            }
            
            # Обрабатываем каждую категорию
            for type_name, phrases_list in data.items():
                logger.info(f"\nОбработка категории: '{type_name}'")
                logger.info(f"Количество фраз: {len(phrases_list)}")
                
                try:
                    # Получаем или создаем тип фразы
                    type_id = self.get_or_create_phrase_type(type_name)
                    stats['total_types'] += 1
                    
                    # Обрабатываем каждую фразу
                    for i, phrase_pair in enumerate(phrases_list, 1):
                        target_text = phrase_pair.get('target', '').strip()
                        native_text = phrase_pair.get('native', '').strip()
                        
                        if not target_text or not native_text:
                            logger.warning(f"  Фраза #{i}: пропущена (пустой текст)")
                            continue
                        
                        logger.debug(f"  Фраза #{i}:")
                        logger.debug(f"    EN: {target_text[:60]}...")
                        logger.debug(f"    RU: {native_text[:60]}...")
                        
                        # Добавляем фразу в базу
                        success = self.insert_phrase(type_id, target_text, native_text, 'en-ru')
                        
                        if success:
                            stats['total_phrases'] += 1
                        else:
                            stats['errors'] += 1
                            logger.error(f"  ✗ Ошибка добавления фразы #{i}")
                    
                    logger.info(f"✓ Завершено: {len(phrases_list)} фраз обработано")
                    
                except Exception as e:
                    logger.error(f"Ошибка обработки категории '{type_name}': {e}")
                    stats['errors'] += 1
            
            # Выводим статистику
            self.print_stats(stats)
            
            # Экспортируем данные для проверки
            self.export_sample_data()
            
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка чтения JSON файла: {e}")
        except Exception as e:
            logger.error(f"Неизвестная ошибка: {e}")
    
    def clear_all_data(self):
        """Очистка всех данных в таблицах"""
        try:
            confirm = input("Вы уверены, что хотите очистить ВСЕ данные? (yes/no): ")
            if confirm.lower() != 'yes':
                logger.info("Очистка отменена")
                return
            
            logger.warning("Очистка всех данных...")
            
            # Отключаем проверку внешних ключей
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            
            # Очищаем таблицы
            self.cursor.execute("TRUNCATE TABLE phrases")
            self.cursor.execute("TRUNCATE TABLE phrase_types")
            
            # Включаем проверку внешних ключей
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            self.connection.commit()
            logger.info("✓ Все данные очищены")
            
        except Error as e:
            logger.error(f"Ошибка очистки данных: {e}")
            self.connection.rollback()
    
    def export_sample_data(self, limit: int = 10):
        """Экспорт образца данных для проверки"""
        try:
            logger.info(f"\n{'='*60}")
            logger.info("ОБРАЗЕЦ ДАННЫХ ИЗ БАЗЫ:")
            logger.info(f"{'='*60}")
            
            # Получаем образцы данных
            query = """
            SELECT 
                pt.type_name,
                p.target_text,
                p.native_text,
                p.direction,
                p.created_at
            FROM phrases p
            JOIN phrase_types pt ON p.type_id = pt.id
            ORDER BY p.id DESC
            LIMIT %s
            """
            
            self.cursor.execute(query, (limit,))
            results = self.cursor.fetchall()
            
            if not results:
                logger.info("Нет данных в базе")
                return
            
            for i, row in enumerate(results, 1):
                type_name, target_text, native_text, direction, created_at = row
                logger.info(f"\n{i}. Тип: {type_name} (направление: {direction})")
                logger.info(f"   EN: {target_text[:80]}...")
                logger.info(f"   RU: {native_text[:80]}...")
                logger.info(f"   Дата: {created_at}")
            
            # Статистика базы данных
            self.print_database_stats()
            
        except Error as e:
            logger.error(f"Ошибка экспорта данных: {e}")
    
    def print_database_stats(self):
        """Вывод статистики базы данных"""
        try:
            # Количество типов фраз
            self.cursor.execute("SELECT COUNT(*) FROM phrase_types")
            type_count = self.cursor.fetchone()[0]
            
            # Количество фраз
            self.cursor.execute("SELECT COUNT(*) FROM phrases")
            phrase_count = self.cursor.fetchone()[0]
            
            # Количество фраз по типам
            self.cursor.execute("""
                SELECT pt.type_name, COUNT(p.id) as phrase_count
                FROM phrase_types pt
                LEFT JOIN phrases p ON pt.id = p.type_id
                GROUP BY pt.id
                ORDER BY phrase_count DESC
            """)
            type_stats = self.cursor.fetchall()
            
            # Количество фраз по направлениям
            self.cursor.execute("""
                SELECT direction, COUNT(*) as phrase_count
                FROM phrases
                GROUP BY direction
                ORDER BY phrase_count DESC
            """)
            direction_stats = self.cursor.fetchall()
            
            logger.info(f"\n{'='*60}")
            logger.info("СТАТИСТИКА БАЗЫ ДАННЫХ:")
            logger.info(f"{'='*60}")
            logger.info(f"Всего типов фраз: {type_count}")
            logger.info(f"Всего фраз: {phrase_count}")
            
            logger.info("\nРаспределение по типам:")
            for type_name, count in type_stats:
                logger.info(f"  {type_name}: {count} фраз")
            
            logger.info("\nРаспределение по направлениям:")
            for direction, count in direction_stats:
                logger.info(f"  {direction}: {count} фраз")
            
        except Error as e:
            logger.error(f"Ошибка получения статистики: {e}")
    
    def print_stats(self, stats: Dict[str, int]):
        """Вывод статистики импорта"""
        print(f"\n{'='*60}")
        print("СТАТИСТИКА ИМПОРТА:")
        print(f"{'='*60}")
        print(f"Обработано категорий: {stats['total_types']}")
        print(f"Добавлено фраз: {stats['total_phrases']}")
        print(f"Ошибок: {stats['errors']}")

def create_database_if_not_exists(host: str, user: str, password: str, database: str, port: int = 3306):
    """
    Создание базы данных если она не существует
    
    Args:
        host: Хост MySQL
        user: Имя пользователя
        password: Пароль
        database: Имя базы данных
        port: Порт MySQL
    """
    try:
        # Подключаемся без указания базы данных
        connection = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            port=port
        )
        
        cursor = connection.cursor()
        
        # Создаем базу данных если не существует
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        logger.info(f"✓ База данных '{database}' создана или уже существует")
        
        cursor.close()
        connection.close()
        
    except Error as e:
        logger.error(f"Ошибка создания базы данных: {e}")
        sys.exit(1)

def main():
    """Основная функция"""
    parser = argparse.ArgumentParser(description='Импорт фраз из JSON в MySQL базу данных')
    
    parser.add_argument('json_file', help='Путь к JSON файлу с фразами')
    parser.add_argument('--host', default='localhost', help='Хост MySQL (по умолчанию: localhost)')
    parser.add_argument('--database', default='eng_phrases', help='Имя базы данных (по умолчанию: eng_phrases)')
    parser.add_argument('--user', default='root', help='Имя пользователя MySQL (по умолчанию: root)')
    parser.add_argument('--password', default='', help='Пароль MySQL')
    parser.add_argument('--port', type=int, default=3306, help='Порт MySQL (по умолчанию: 3306)')
    parser.add_argument('--create-db', action='store_true', help='Создать базу данных если не существует')
    parser.add_argument('--clear', action='store_true', help='Очистить существующие данные перед импортом')
    
    args = parser.parse_args()
    
    # Создаем базу данных если нужно
    if args.create_db:
        create_database_if_not_exists(
            host=args.host,
            user=args.user,
            password=args.password,
            database=args.database,
            port=args.port
        )
    
    # Создаем импортер
    importer = PhraseDatabaseImporter(
        host=args.host,
        database=args.database,
        user=args.user,
        password=args.password,
        port=args.port
    )
    
    try:
        # Подключаемся к базе данных
        importer.connect()
        
        # Создаем таблицы
        importer.create_tables()
        
        # Импортируем данные
        importer.import_json_file(args.json_file, clear_existing=args.clear)
        
    except Exception as e:
        logger.error(f"Ошибка: {e}")
    
    finally:
        # Отключаемся от базы данных
        importer.disconnect()

if __name__ == "__main__":
    main()