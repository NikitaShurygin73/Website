import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import init_db, async_session, engine
from .models import User, Message
from .auth import hash_password
from .routes.auth_routes import router as auth_router
from .routes.chat_routes import router as chat_router
from .routes.admin_routes import router as admin_router
from .routes.file_routes import router as file_router, UPLOADS_DIR
from .routes.message_routes import router as message_router
from .websocket import websocket_endpoint
from sqlalchemy import select, text, delete, and_


# Фоновая задача: чистка удалённых сообщений (15 дней) и старых файлов (30 дней), запуск раз в сутки
async def cleanup_old_files():
    while True:
        await asyncio.sleep(24 * 60 * 60)
        now = datetime.now(timezone.utc)
        # Удаляем мягко-удалённые сообщения старше 15 дней
        async with async_session() as db:
            cutoff_msgs = now - timedelta(days=15)
            await db.execute(
                delete(Message).where(
                    and_(Message.is_deleted == True, Message.deleted_at < cutoff_msgs)
                )
            )
            await db.commit()
        # Удаляем файлы из uploads старше 30 дней
        cutoff_files = datetime.now() - timedelta(days=30)
        for f in UPLOADS_DIR.iterdir():
            if f.is_file():
                mtime = datetime.fromtimestamp(f.stat().st_mtime)
                if mtime < cutoff_files:
                    f.unlink(missing_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Миграция: добавляем столбцы в messages если их ещё нет
    async with engine.begin() as conn:
        for stmt in [
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size BIGINT",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_file_attachment BOOLEAN DEFAULT FALSE",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS files JSONB",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN DEFAULT FALSE",
            "ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_department BOOLEAN DEFAULT FALSE",
            "ALTER TABLE chats ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            """CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                is_resolved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS support_replies (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
        ]:
            await conn.execute(text(stmt))
    # Создаём администратора по умолчанию если его ещё нет
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                display_name="Администратор",
                password_hash=hash_password("admin123"),
                is_admin=True,
            )
            db.add(admin)
            await db.commit()
    cleanup_task = asyncio.create_task(cleanup_old_files())
    yield
    cleanup_task.cancel()


# Инициализация FastAPI и CORS
app = FastAPI(title="Messenger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(file_router)
app.include_router(message_router)

app.add_api_websocket_route("/ws/chat", websocket_endpoint)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
