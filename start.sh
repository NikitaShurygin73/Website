#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Запуск базы данных..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d

echo "==> Запуск бэкенда..."
cd "$ROOT_DIR/backend"
source venv/bin/activate
nohup python run.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "    Бэкенд запущен (PID: $BACKEND_PID)"

echo "==> Запуск фронтенда..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "    Фронтенд запущен (PID: $FRONTEND_PID)"

echo ""
echo "✓ Сайт доступен на http://localhost:3000"
echo "  Бэкенд: http://localhost:8000"
echo "  Лог бэкенда: tail -f /tmp/backend.log"
echo ""
echo "Для остановки: bash stop.sh"

echo "$BACKEND_PID" > /tmp/messenger_backend.pid
echo "$FRONTEND_PID" > /tmp/messenger_frontend.pid

wait
