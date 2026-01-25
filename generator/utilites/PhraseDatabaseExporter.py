# export_phrases.py
import mysql.connector
from mysql.connector import Error
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PhraseDatabaseExporter:
    def __init__(self, host: str, database: str, user: str, password: str, port: int = 3306):
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.port = port
        
        self.connection = None
        self.cursor = None
    
    def connect(self):
        try:
            self.connection = mysql.connector.connect(
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password,
                port=self.port,
                charset='utf8mb4'
            )
            
            if self.connection.is_connected():
                self.cursor = self.connection.cursor(dictionary=True)
                logger.info("✓ Подключение к MySQL успешно")
                
        except Error as e:
            logger.error(f"Ошибка подключения к MySQL: {e}")
            raise
    
    def disconnect(self):
        if self.connection and self.connection.is_connected():
            self.cursor.close()
            self.connection.close()
            logger.info("✗ Отключение от MySQL")
    
    def export_to_json(self, output_file: str, export_format: str = 'grouped'):
        """
        Экспорт данных из базы в JSON файл
        
        Args:
            output_file: Путь к выходному файлу
            export_format: Формат экспорта ('grouped' или 'flat')
        """
        try:
            query = """
            SELECT 
                pt.type_name,
                p.target_text,
                p.native_text
            FROM phrases p
            JOIN phrase_types pt ON p.type_id = pt.id
            WHERE p.is_active = TRUE
            ORDER BY pt.type_name, p.id
            """
            
            self.cursor.execute(query)
            results = self.cursor.fetchall()
            
            if not results:
                logger.warning("Нет данных для экспорта")
                return
            
            logger.info(f"Найдено {len(results)} фраз")
            
            if export_format == 'grouped':
                # Группировка по типам фраз
                data = {}
                for row in results:
                    type_name = row['type_name']
                    if type_name not in data:
                        data[type_name] = []
                    
                    data[type_name].append({
                        'target': row['target_text'],
                        'native': row['native_text']
                    })
                
                output_data = data
                
            else:  # flat format
                output_data = results
            
            # Сохраняем в файл
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2, default=str)
            
            logger.info(f"✓ Данные экспортированы в: {output_file}")
            logger.info(f"Формат: {export_format}")
            logger.info(f"Количество записей: {len(results)}")
            
            # Показываем образец
            self.show_sample(output_data)
            
        except Error as e:
            logger.error(f"Ошибка экспорта: {e}")
    
    def show_sample(self, data: dict, sample_size: int = 3):
        """Показать образец данных"""
        print(f"\n{'='*60}")
        print("ОБРАЗЕЦ ЭКСПОРТИРОВАННЫХ ДАННЫХ:")
        print(f"{'='*60}")
        
        if isinstance(data, dict):  # grouped format
            for i, (type_name, phrases) in enumerate(list(data.items())[:sample_size], 1):
                print(f"\n{i}. Тип: {type_name}")
                print(f"   Фраз: {len(phrases)}")
                if phrases:
                    print(f"   Пример:")
                    print(f"     EN: {phrases[0]['target'][:80]}...")
                    print(f"     RU: {phrases[0]['native'][:80]}...")
        
        else:  # flat format
            for i, row in enumerate(data[:sample_size], 1):
                print(f"\n{i}. Тип: {row['type_name']}")
                print(f"   EN: {row['target_text'][:80]}...")
                print(f"   RU: {row['native_text'][:80]}...")

def main():
    parser = argparse.ArgumentParser(description='Экспорт фраз из MySQL в JSON')
    
    parser.add_argument('output_file', help='Путь к выходному JSON файлу')
    parser.add_argument('--host', default='localhost', help='Хост MySQL')
    parser.add_argument('--database', default='phrases_db', help='Имя базы данных')
    parser.add_argument('--user', default='root', help='Имя пользователя MySQL')
    parser.add_argument('--password', default='', help='Пароль MySQL')
    parser.add_argument('--port', type=int, default=3306, help='Порт MySQL')
    parser.add_argument('--format', choices=['grouped', 'flat'], default='grouped', 
                       help='Формат экспорта (grouped или flat)')
    
    args = parser.parse_args()
    
    exporter = PhraseDatabaseExporter(
        host=args.host,
        database=args.database,
        user=args.user,
        password=args.password,
        port=args.port
    )
    
    try:
        exporter.connect()
        exporter.export_to_json(args.output_file, args.format)
    except Exception as e:
        logger.error(f"Ошибка: {e}")
    finally:
        exporter.disconnect()

if __name__ == "__main__":
    main()