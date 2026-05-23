"""
Скрипт засева тестовых сообщений.
Создаёт личные переписки между разными пользователями
и сообщения в групповых чатах отделов.
Запуск: python seed_messages.py (из папки backend с активированным venv)
"""
import asyncio, sys, os, random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from app.database import async_session, init_db
from app.models import User, Chat, ChatMember, Message
from sqlalchemy import select, and_

# Наборы реалистичных сообщений
GREETINGS = [
    "Привет! Как дела?",
    "Привет, есть минута?",
    "Добрый день!",
    "Здравствуй! Как ты?",
]
REPLIES = [
    "Всё хорошо, спасибо! А у тебя?",
    "Привет! Да, что-то хотел?",
    "Добрый! Слушаю.",
    "Норм, работаю. Что случилось?",
]
WORK_MSGS = [
    "Можешь посмотреть мой PR? Ссылку скинул в задаче.",
    "Отчёт готов, отправил на почту.",
    "Созвонимся сегодня в 15:00?",
    "Задача закрыта, всё работает.",
    "Нужна помощь с конфигом, не могу поднять локально.",
    "Обновил документацию по API.",
    "Дедлайн перенесли на пятницу.",
    "Заказчик доволен результатом!",
    "Баг воспроизвёлся, разбираюсь.",
    "Выложил новую версию на стейджинг.",
]
GROUP_MSGS = [
    "Всем привет! Напоминаю про стендап в 10:00.",
    "Обновил задачи в Jira, посмотрите.",
    "Кто брал ноутбук из переговорки?",
    "Ребята, в пятницу тимбилдинг, не забывайте.",
    "Выкатили обновление, всё прошло чисто.",
    "Спасибо всем за работу на этой неделе! 🎉",
    "Есть вопросы по новому процессу — пишите.",
    "Коллеги, завтра митинг с заказчиком в 14:00.",
    "Новый дашборд готов, ссылка в Confluence.",
    "Планируем спринт-ревью на четверг.",
    "Кто занимается задачей AUTH-42?",
    "Документацию обновил, можно смотреть.",
]


async def get_or_create_direct_chat(db, user1_id, user2_id):
    """Ищет существующий личный чат, либо создаёт новый."""
    res = await db.execute(
        select(ChatMember.chat_id).where(ChatMember.user_id == user1_id)
    )
    u1_chats = {r[0] for r in res.all()}
    res = await db.execute(
        select(ChatMember.chat_id).where(ChatMember.user_id == user2_id)
    )
    u2_chats = {r[0] for r in res.all()}
    common = u1_chats & u2_chats
    for cid in common:
        res = await db.execute(select(Chat).where(Chat.id == cid))
        chat = res.scalar_one_or_none()
        if chat and not chat.is_group:
            return chat
    chat = Chat(is_group=False)
    db.add(chat)
    await db.flush()
    db.add(ChatMember(chat_id=chat.id, user_id=user1_id))
    db.add(ChatMember(chat_id=chat.id, user_id=user2_id))
    await db.commit()
    await db.refresh(chat)
    return chat


async def add_message(db, chat_id, sender_id, content, minutes_ago=0):
    ts = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    msg = Message(chat_id=chat_id, sender_id=sender_id, content=content, created_at=ts)
    db.add(msg)


async def seed_messages():
    await init_db()

    async with async_session() as db:
        # Загружаем всех пользователей
        res = await db.execute(select(User).where(User.is_active == True))
        all_users = res.scalars().all()
        by_name = {u.username: u for u in all_users}

        print(f"Пользователей: {len(all_users)}")

        # --- Личные переписки ---
        pairs = [
            ("sokolov",  "ivanova"),
            ("sokolov",  "petrov"),
            ("sidorova", "kozlov"),
            ("novikov",  "popova"),
            ("soloveva", "orlov"),
            ("mihailov", "zaitseva"),
            ("admin",    "sokolov"),
            ("admin",    "sidorova"),
            ("petrov",   "morozova"),
            ("orlov",    "fedorova"),
            ("belov",    "zaitseva"),
            ("novikov",  "lebedev"),
        ]

        for u1_name, u2_name in pairs:
            u1, u2 = by_name.get(u1_name), by_name.get(u2_name)
            if not u1 or not u2:
                continue
            chat = await get_or_create_direct_chat(db, u1.id, u2.id)
            # 8-12 сообщений в диалоге
            count = random.randint(8, 12)
            offset = random.randint(60, 1440)  # начали разговор 1-24ч назад
            speakers = [u1, u2]
            await add_message(db, chat.id, speakers[0].id, random.choice(GREETINGS), offset)
            await add_message(db, chat.id, speakers[1].id, random.choice(REPLIES), offset - 2)
            for i in range(count - 2):
                speaker = speakers[i % 2]
                await add_message(db, chat.id, speaker.id,
                                  random.choice(WORK_MSGS),
                                  offset - 5 - i * 3)
            await db.commit()
            print(f"  ✓ {u1.display_name} ↔ {u2.display_name}: {count} сообщений")

        # --- Сообщения в групповых чатах отделов ---
        res = await db.execute(select(Chat).where(Chat.is_department == True))
        dept_chats = res.scalars().all()

        for dept in dept_chats:
            res = await db.execute(
                select(User).join(ChatMember, ChatMember.user_id == User.id)
                .where(ChatMember.chat_id == dept.id)
            )
            members = res.scalars().all()
            if not members:
                continue
            count = random.randint(10, 16)
            offset = random.randint(30, 480)
            for i in range(count):
                sender = random.choice(members)
                await add_message(db, dept.id, sender.id,
                                  random.choice(GROUP_MSGS),
                                  offset - i * 4)
            await db.commit()
            print(f"  ✓ Отдел '{dept.name}': {count} сообщений")

        print("\n✓ Сообщения добавлены!")


if __name__ == "__main__":
    asyncio.run(seed_messages())
