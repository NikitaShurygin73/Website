"""
Скрипт заполнения БД тестовыми данными.
Запуск: python seed.py  (из папки backend, с активированным venv)

Создаёт:
  - 5 отделов (группы-чаты с is_department=True)
  - 15 пользователей (по 3 на отдел)
  - 5 тимлидов (первый пользователь в каждом отделе)
  - Добавляет admin во все отделы
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import async_session, init_db
from app.models import User, Chat, ChatMember
from app.auth import hash_password
from sqlalchemy import select


DEPARTMENTS = [
    "Разработка",
    "Дизайн",
    "Маркетинг",
    "Продажи",
    "Аналитика",
]

# 15 пользователей — 3 на отдел
USERS = [
    # Разработка
    {"username": "sokolov",  "display_name": "Алексей Соколов",   "password": "pass123", "is_team_lead": True},
    {"username": "ivanova",  "display_name": "Мария Иванова",     "password": "pass123"},
    {"username": "petrov",   "display_name": "Дмитрий Петров",    "password": "pass123"},
    # Дизайн
    {"username": "sidorova", "display_name": "Анна Сидорова",     "password": "pass123", "is_team_lead": True},
    {"username": "kozlov",   "display_name": "Павел Козлов",      "password": "pass123"},
    {"username": "morozova", "display_name": "Елена Морозова",    "password": "pass123"},
    # Маркетинг
    {"username": "novikov",  "display_name": "Иван Новиков",      "password": "pass123", "is_team_lead": True},
    {"username": "popova",   "display_name": "Ольга Попова",      "password": "pass123"},
    {"username": "lebedev",  "display_name": "Сергей Лебедев",    "password": "pass123"},
    # Продажи
    {"username": "soloveva", "display_name": "Наталья Соловьёва", "password": "pass123", "is_team_lead": True},
    {"username": "orlov",    "display_name": "Кирилл Орлов",     "password": "pass123"},
    {"username": "fedorova", "display_name": "Виктория Фёдорова","password": "pass123"},
    # Аналитика
    {"username": "mihailov", "display_name": "Максим Михайлов",   "password": "pass123", "is_team_lead": True},
    {"username": "zaitseva", "display_name": "Юлия Зайцева",     "password": "pass123"},
    {"username": "belov",    "display_name": "Артём Белов",      "password": "pass123"},
]


async def seed():
    await init_db()

    async with async_session() as db:
        # Найдём admin
        admin_res = await db.execute(select(User).where(User.username == "admin"))
        admin = admin_res.scalar_one_or_none()
        if not admin:
            print("Пользователь admin не найден. Сначала запустите бэкенд для создания admin.")
            return

        # Создаём пользователей (пропускаем если уже существуют)
        created_users = []
        for u_data in USERS:
            existing = await db.execute(select(User).where(User.username == u_data["username"]))
            if existing.scalar_one_or_none():
                print(f"  Пользователь @{u_data['username']} уже существует, пропускаем")
                res = await db.execute(select(User).where(User.username == u_data["username"]))
                created_users.append(res.scalar_one())
                continue
            user = User(
                username=u_data["username"],
                display_name=u_data["display_name"],
                password_hash=hash_password(u_data["password"]),
                is_team_lead=u_data.get("is_team_lead", False),
            )
            db.add(user)
            await db.flush()
            created_users.append(user)
            role = " [ТИМЛИД]" if u_data.get("is_team_lead") else ""
            print(f"  + Пользователь: {u_data['display_name']} (@{u_data['username']}){role}")

        await db.commit()

        # Обновляем ссылки
        for i, u in enumerate(created_users):
            await db.refresh(u)

        # Создаём отделы (3 пользователя на отдел, тимлид = создатель)
        for i, dept_name in enumerate(DEPARTMENTS):
            # Проверяем, не существует ли уже такой отдел
            existing = await db.execute(
                select(Chat).where(Chat.name == dept_name, Chat.is_department == True)
            )
            if existing.scalar_one_or_none():
                print(f"  Отдел '{dept_name}' уже существует, пропускаем")
                continue

            members_slice = created_users[i * 3:(i + 1) * 3]
            # Тимлид (первый) становится создателем
            team_lead = members_slice[0]

            chat = Chat(
                is_group=True,
                is_department=True,
                name=dept_name,
                admin_id=team_lead.id,
            )
            db.add(chat)
            await db.flush()

            # Добавляем тимлида, остальных участников и admin
            member_ids = {team_lead.id, admin.id} | {u.id for u in members_slice}
            for uid in member_ids:
                db.add(ChatMember(chat_id=chat.id, user_id=uid))

            await db.commit()
            members_names = ", ".join(u.display_name for u in members_slice)
            print(f"  + Отдел: {dept_name} | Тимлид: {team_lead.display_name} | Участники: {members_names}")

        print("\n✓ Готово! Все данные созданы.")
        print("  Пароль всех пользователей: pass123")


if __name__ == "__main__":
    asyncio.run(seed())
