# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(24).hex()
    HF_TOKEN = os.environ.get('HF_TOKEN')
    
    MYSQL_CONFIG = {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'phrases_user'),
        'password': os.environ.get('MYSQL_PASSWORD', ''),
        'database': os.environ.get('MYSQL_DATABASE', 'eng_phrases'),
        'port': int(os.environ.get('MYSQL_PORT', 3306))
    }
    
    # Путь к логам
    LOG_DIR = '/var/log/english-phrases'
    
    # Настройки
    DEBUG = os.environ.get('FLASK_ENV') == 'development'
    TESTING = False