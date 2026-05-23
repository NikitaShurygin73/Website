from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Message, ChatMember
from ..schemas import EditMessageRequest
from ..auth import get_current_user
from ..websocket import manager

router = APIRouter(prefix="/api", tags=["messages"])


@router.put("/messages/{message_id}")
async def edit_message(
    message_id: int,
    data: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Нельзя редактировать чужие сообщения")
    if msg.is_deleted:
        raise HTTPException(400, "Нельзя редактировать удалённое сообщение")

    msg.content = data.content
    msg.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    members_result = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == msg.chat_id)
    )
    members = members_result.scalars().all()
    payload = {
        "type": "message_edited",
        "chat_id": msg.chat_id,
        "message_id": msg.id,
        "content": msg.content,
        "edited_at": msg.edited_at.isoformat(),
    }
    for member in members:
        await manager.send_personal(member.user_id, payload)

    return {"ok": True}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Нельзя удалять чужие сообщения")

    msg.is_deleted = True
    msg.content = ""
    msg.deleted_at = datetime.now(timezone.utc)
    await db.commit()

    members_result = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == msg.chat_id)
    )
    members = members_result.scalars().all()
    payload = {
        "type": "message_deleted",
        "chat_id": msg.chat_id,
        "message_id": msg.id,
    }
    for member in members:
        await manager.send_personal(member.user_id, payload)

    return {"ok": True}
