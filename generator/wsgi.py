# /home/vmaya/www/eng_frases/generator/wsgi.py
import sys
import os

# Добавьте пути к проекту
sys.path.insert(0, '/home/vmaya/www/eng_frases/generator')

# Импортируйте приложение
from server import app as application

# НЕ запускайте app.run() здесь!