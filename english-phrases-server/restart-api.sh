#!/bin/bash
echo "Останавливаем сервис..."
sudo systemctl stop english-phrases

echo "Освобождаем порт 5001..."
sudo fuser -k 5001/tcp 2>/dev/null
sudo fuser -k 5002/tcp 2>/dev/null

echo "Ждем 5 секунд..."
sleep 5

echo "Запускаем сервис..."
sudo systemctl start english-phrases

echo "Проверяем статус..."
sleep 3
sudo systemctl status english-phrases --no-pager

echo "Проверяем порты..."
sudo netstat -tlnp | grep :500