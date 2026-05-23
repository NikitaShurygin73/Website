from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, delete as sql_delete
from typing import List, Optional
from ..database import get_db
from ..models import User, Chat, ChatMember, Message
from ..schemas import ChatResponse, MessageResponse, CreateChatRequest, UserResponse, CreateGroupRequest, AddMemberRequest
from ..auth import get_current_user

router = APIRouter(prefix="/api", tags=["chats"])


def _last_msg_preview(msg) -> Optional[str]:
    if msg is None:
        return None
    if msg.content:
        return msg.content
    if msg.files:
        types = [f.get('type', '') for f in msg.files if isinstance(f, dict)]
        if all(t.startswith('image/') for t in types if t):
            return f'Фото ({len(msg.files)})' if len(msg.files) > 1 else 'Фото'
        return f'Файлов: {len(msg.files)}'
    if msg.file_url:
        if msg.file_type and msg.file_type.startswith('image/') and not msg.is_file_attachment:
            return 'Фото'
        return f'Файл: {msg.file_name}' if msg.file_name else 'Файл'
    return ''


# ---- Пользователи ----
@router.get("/users", response_model=List[UserResponse])
async def get_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.display_name)
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


# ---- Чаты ----
@router.get("/chats", response_model=List[ChatResponse])
async def get_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Все чаты текущего пользователя
    result = await db.execute(
        select(ChatMember).where(
            and_(ChatMember.user_id == current_user.id, ChatMember.is_visible == True)
        )
    )
    memberships = result.scalars().all()

    chats = []
    for membership in memberships:
        # Загружаем чат
        chat_result = await db.execute(select(Chat).where(Chat.id == membership.chat_id))
        chat = chat_result.scalar_one_or_none()
        if not chat:
            continue

        # Собеседник (для приватных чатов)
        other_user = None
        if not chat.is_group:
            other_member_result = await db.execute(
                select(ChatMember).where(
                    and_(ChatMember.chat_id == chat.id, ChatMember.user_id != current_user.id)
                )
            )
            other_member = other_member_result.scalar_one_or_none()
            if other_member:
                user_result = await db.execute(select(User).where(User.id == other_member.user_id))
                other_user = user_result.scalar_one_or_none()

        # Последнее сообщение
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.chat_id == chat.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Количество непрочитанных
        unread_count = 0
        if membership.last_read_at:
            unread_result = await db.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.chat_id == chat.id,
                        Message.created_at > membership.last_read_at,
                        Message.sender_id != current_user.id,
                    )
                )
            )
            unread_count = unread_result.scalar() or 0
        else:
            unread_result = await db.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.chat_id == chat.id,
                        Message.sender_id != current_user.id,
                    )
                )
            )
            unread_count = unread_result.scalar() or 0

        chat_data = ChatResponse(
            id=chat.id,
            is_group=chat.is_group,
            is_department=chat.is_department or False,
            admin_id=chat.admin_id,
            name=chat.name,
            other_user=UserResponse.model_validate(other_user) if other_user else None,
            last_message=_last_msg_preview(last_msg),
            last_message_time=last_msg.created_at if last_msg else None,
            unread_count=unread_count,
            created_at=chat.created_at,
        )
        chats.append(chat_data)

    # Сортировка по времени последнего сообщения
    chats.sort(key=lambda c: c.last_message_time or c.created_at, reverse=True)
    return chats


@router.post("/chats", response_model=ChatResponse)
async def create_chat(
    data: CreateChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем существующий чат между этими пользователями
    my_chats = await db.execute(
        select(ChatMember.chat_id).where(ChatMember.user_id == current_user.id)
    )
    my_chat_ids = [row[0] for row in my_chats.all()]

    if my_chat_ids:
        other_chats = await db.execute(
            select(ChatMember.chat_id).where(
                and_(
                    ChatMember.user_id == data.user_id,
                    ChatMember.chat_id.in_(my_chat_ids),
                )
            )
        )
        common_chat_ids = [row[0] for row in other_chats.all()]

        for chat_id in common_chat_ids:
            chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
            existing_chat = chat_result.scalar_one_or_none()
            if existing_chat and not existing_chat.is_group:
                # Чат уже существует — возвращаем его
                user_result = await db.execute(select(User).where(User.id == data.user_id))
                other_user = user_result.scalar_one_or_none()
                return ChatResponse(
                    id=existing_chat.id,
                    is_group=False,
                    name=None,
                    other_user=UserResponse.model_validate(other_user) if other_user else None,
                    created_at=existing_chat.created_at,
                )

    # Создаём новый чат
    chat = Chat(is_group=False)
    db.add(chat)
    await db.flush()

    # Инициатор видит чат сразу; получатель — только после первого сообщения
    db.add(ChatMember(chat_id=chat.id, user_id=current_user.id, is_visible=True))
    db.add(ChatMember(chat_id=chat.id, user_id=data.user_id, is_visible=False))
    await db.commit()
    await db.refresh(chat)

    user_result = await db.execute(select(User).where(User.id == data.user_id))
    other_user = user_result.scalar_one_or_none()

    return ChatResponse(
        id=chat.id,
        is_group=False,
        name=None,
        other_user=UserResponse.model_validate(other_user) if other_user else None,
        created_at=chat.created_at,
    )


@router.get("/chats/favorites", response_model=ChatResponse)
async def get_or_create_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    my_chats = await db.execute(
        select(ChatMember.chat_id).where(ChatMember.user_id == current_user.id)
    )
    my_chat_ids = [row[0] for row in my_chats.all()]

    for chat_id in my_chat_ids:
        chat_result = await db.execute(select(Chat).where(and_(Chat.id == chat_id, Chat.name == 'Избранное')))
        chat = chat_result.scalar_one_or_none()
        if chat:
            last_msg_result = await db.execute(
                select(Message).where(Message.chat_id == chat.id).order_by(desc(Message.created_at)).limit(1)
            )
            last_msg = last_msg_result.scalar_one_or_none()
            return ChatResponse(
                id=chat.id, is_group=False, name='Избранное', other_user=None,
                last_message=_last_msg_preview(last_msg),
                last_message_time=last_msg.created_at if last_msg else None,
                unread_count=0, created_at=chat.created_at,
            )

    chat = Chat(is_group=False, name='Избранное')
    db.add(chat)
    await db.flush()
    db.add(ChatMember(chat_id=chat.id, user_id=current_user.id))
    await db.commit()
    await db.refresh(chat)
    return ChatResponse(id=chat.id, is_group=False, name='Избранное', other_user=None,
                        unread_count=0, created_at=chat.created_at)


# \u0421\u043f\u0438\u0441\u043e\u043a \u0432\u0441\u0435\u0445 \u043e\u0442\u0434\u0435\u043b\u043e\u0432 (\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u043b\u044e\u0431\u043e\u043c\u0443 \u0430\u0443\u0442\u0435\u043d\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e)
@router.get("/chats/departments", response_model=List[ChatResponse])
async def get_all_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chat).where(Chat.is_department == True).order_by(Chat.name)
    )
    depts = result.scalars().all()
    return [ChatResponse(
        id=d.id, is_group=True, is_department=True,
        admin_id=d.admin_id, name=d.name, other_user=None,
        unread_count=0, created_at=d.created_at,
    ) for d in depts]


# ---- Группы и отделы ----
@router.post("/chats/group", response_model=ChatResponse)
async def create_group(
    data: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.is_department and not (current_user.is_admin or current_user.is_team_lead):
        raise HTTPException(status_code=403, detail="Только тимлиды и админы могут создавать отделы")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Название не может быть пустым")
    chat = Chat(is_group=True, is_department=data.is_department, name=data.name.strip(), admin_id=current_user.id)
    db.add(chat)
    await db.flush()
    member_ids = list({current_user.id, *data.member_ids})
    for uid in member_ids:
        db.add(ChatMember(chat_id=chat.id, user_id=uid))
    await db.commit()
    await db.refresh(chat)
    return ChatResponse(
        id=chat.id, is_group=True, is_department=chat.is_department or False,
        admin_id=chat.admin_id, name=chat.name, other_user=None,
        unread_count=0, created_at=chat.created_at,
    )


@router.get("/chats/{chat_id}/members", response_model=List[UserResponse])
async def get_chat_members(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # \u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043e\u0442\u0434\u0435\u043b\u0430 \u0432\u0438\u0434\u043d\u044b \u0432\u0441\u0435\u043c; \u0434\u043b\u044f \u043e\u0431\u044b\u0447\u043d\u044b\u0445 \u0433\u0440\u0443\u043f\u043f \u2014 \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u043b\u0435\u043d\u0430\u043c
    chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = chat_result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="\u0427\u0430\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d")
    if not chat.is_department:
        member_check = await db.execute(
            select(ChatMember).where(and_(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.id))
        )
        if not member_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430")
    result = await db.execute(
        select(User).join(ChatMember, ChatMember.user_id == User.id).where(ChatMember.chat_id == chat_id).order_by(User.display_name)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("/chats/{chat_id}/members")
async def add_chat_member(
    chat_id: int,
    data: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = chat_result.scalar_one_or_none()
    if not chat or not chat.is_group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if chat.admin_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Только администратор группы может добавлять участников")
    existing = await db.execute(
        select(ChatMember).where(and_(ChatMember.chat_id == chat_id, ChatMember.user_id == data.user_id))
    )
    if not existing.scalar_one_or_none():
        db.add(ChatMember(chat_id=chat_id, user_id=data.user_id))
        await db.commit()
    return {"ok": True}


@router.delete("/chats/{chat_id}/members/{user_id}")
async def remove_chat_member(
    chat_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = chat_result.scalar_one_or_none()
    if not chat or not chat.is_group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if chat.admin_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Только администратор группы может удалять участников")
    if user_id == chat.admin_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить администратора группы")
    await db.execute(
        sql_delete(ChatMember).where(and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id))
    )
    await db.commit()
    return {"ok": True}


# Удаление группы/отдела (только создатель или глобальный администратор)
@router.delete("/chats/{chat_id}")
async def delete_group_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = chat_result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    if not chat.is_group:
        raise HTTPException(status_code=400, detail="Нельзя удалить личный чат")
    if chat.admin_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Только создатель может удалить группу")
    # Используем SQL DELETE чтобы сработал ON DELETE CASCADE в БД
    await db.execute(sql_delete(Chat).where(Chat.id == chat_id))
    await db.commit()
    return {"ok": True}


# ---- Сообщения и пагинация ----
@router.get("/chats/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: int,
    before: Optional[int] = None,
    limit: int = 75,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Отделы — публичны для чтения; обычные чаты — только для участников
    chat_res = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat_obj = chat_res.scalar_one_or_none()
    if not chat_obj:
        raise HTTPException(status_code=404, detail="Чат не найден")
    if not chat_obj.is_department:
        result = await db.execute(
            select(ChatMember).where(
                and_(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.id)
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")

    query = select(Message).where(Message.chat_id == chat_id)
    if before is not None:
        query = query.where(Message.id < before)
    query = query.order_by(Message.id.desc()).limit(limit)

    messages_result = await db.execute(query)
    messages = list(reversed(messages_result.scalars().all()))

    reply_ids = [m.reply_to_id for m in messages if m.reply_to_id]
    reply_lookup = {}
    if reply_ids:
        rt_result = await db.execute(select(Message).where(Message.id.in_(reply_ids)))
        for rm in rt_result.scalars().all():
            reply_lookup[rm.id] = rm

    return [
        MessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender_id=msg.sender_id,
            content=msg.content,
            created_at=msg.created_at,
            read=True,
            file_url=msg.file_url,
            file_name=msg.file_name,
            file_size=msg.file_size,
            file_type=msg.file_type,
            is_file_attachment=msg.is_file_attachment or False,
            files=msg.files,
            reply_to_id=msg.reply_to_id,
            reply_to={
                "id": reply_lookup[msg.reply_to_id].id,
                "content": reply_lookup[msg.reply_to_id].content,
                "sender_id": reply_lookup[msg.reply_to_id].sender_id,
                "file_name": reply_lookup[msg.reply_to_id].file_name,
                "file_type": reply_lookup[msg.reply_to_id].file_type,
            } if msg.reply_to_id and msg.reply_to_id in reply_lookup else None,
            edited_at=msg.edited_at,
            is_deleted=msg.is_deleted or False,
        )
        for msg in messages
    ]


@router.post("/chats/{chat_id}/read")
async def mark_as_read(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMember).where(
            and_(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.id)
        )
    )
    membership = result.scalar_one_or_none()
    if membership:
        max_ts_result = await db.execute(
            select(func.max(Message.created_at)).where(Message.chat_id == chat_id)
        )
        max_ts = max_ts_result.scalar()
        membership.last_read_at = max_ts if max_ts else func.now()
        await db.commit()
    return {"ok": True}


# Медиафайлы чата (фото и документы)
@router.get("/chats/{chat_id}/media")
async def get_chat_media(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_result = await db.execute(
        select(ChatMember).where(
            and_(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.id)
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403)

    result = await db.execute(
        select(Message).where(
            and_(
                Message.chat_id == chat_id,
                Message.is_deleted == False,
                or_(Message.file_url.isnot(None), Message.files.isnot(None))
            )
        ).order_by(desc(Message.created_at))
    )
    messages = result.scalars().all()

    photos, files = [], []
    for m in messages:
        if m.file_url:
            item = {
                "url": m.file_url, "name": m.file_name,
                "type": m.file_type, "size": m.file_size,
                "is_attach": m.is_file_attachment or False,
            }
            if m.file_type and m.file_type.startswith("image/") and not m.is_file_attachment:
                photos.append(item)
            else:
                files.append(item)
        if m.files:
            for f in (m.files if isinstance(m.files, list) else []):
                ftype = f.get("type", "")
                item = {"url": f.get("url"), "name": f.get("name"), "type": ftype, "size": f.get("size"), "is_attach": False}
                if ftype.startswith("image/"):
                    photos.append(item)
                else:
                    files.append(item)

    return {"photos": photos, "files": files}
