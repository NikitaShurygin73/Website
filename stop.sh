#!/bin/bash

echo "==> Остановка сервисов..."

if [ -f /tmp/messenger_backend.pid ]; then
  kill $(cat /tmp/messenger_backend.pid) 2>/dev/null && echo "    Бэкенд остановлен"
  rm /tmp/messenger_backend.pid
fi

if [ -f /tmp/messenger_frontend.pid ]; then
  kill $(cat /tmp/messenger_frontend.pid) 2>/dev/null && echo "    Фронтенд остановлен"
  rm /tmp/messenger_frontend.pid
fi

pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "✓ Всё остановлено"
