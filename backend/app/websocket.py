import json
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select, and_
from .database import async_session
from .models import User, Chat, ChatMember, Message
from .auth import decode_token


# Менеджер активных WS-соединений: одно соединение на пользователя
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        await self.broadcast_online_status(user_id, True)
        await self.send_online_users(websocket)

    async def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            await self.broadcast_online_status(user_id, False)

    async def send_personal(self, user_id: int, data: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(data, default=str))
            except Exception:
                pass

    async def broadcast_online_status(self, user_id: int, online: bool):
        message = {"type": "online_status", "user_id": user_id, "online": online}
        for uid, ws in self.active_connections.items():
            if uid != user_id:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass

    async def send_online_users(self, websocket: WebSocket):
        online_ids = list(self.active_connections.keys())
        await websocket.send_text(json.dumps({"type": "online_users", "user_ids": online_ids}))

    def get_online_user_ids(self) -> Set[int]:
        return set(self.active_connections.keys())


manager = ConnectionManager()


# Основной WebSocket-эндпойнт
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = int(payload.get("sub"))

    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "message":
                chat_id = message_data.get("chat_id")
                content = message_data.get("content", "").strip()
                file_url = message_data.get("file_url")
                file_name = message_data.get("file_name")
                file_size = message_data.get("file_size")
                file_type = message_data.get("file_type")
                is_file_attachment = message_data.get("is_file_attachment", False)
                files = message_data.get("files")
                reply_to_id = message_data.get("reply_to_id")

                if not chat_id or (not content and not file_url and not files):
                    continue

                async with async_session() as db:
                    # Проверяем членство в чате
                    result = await db.execute(
                        select(ChatMember).where(
                            and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
                        )
                    )
                    if not result.scalar_one_or_none():
                        continue

                    # Сохраняем сообщение в БД
                    msg = Message(
                        chat_id=chat_id,
                        sender_id=user_id,
                        content=content or "",
                        file_url=file_url,
                        file_name=file_name,
                        file_size=file_size,
                        file_type=file_type,
                        is_file_attachment=is_file_attachment,
                        files=files,
                        reply_to_id=reply_to_id,
                    )
                    # Загружаем данные цитируемого сообщения
                    reply_to_data = None
                    if reply_to_id:
                        rt_result = await db.execute(select(Message).where(Message.id == reply_to_id))
                        rt_msg = rt_result.scalar_one_or_none()
                        if rt_msg:
                            reply_to_data = {
                                "id": rt_msg.id,
                                "content": rt_msg.content,
                                "sender_id": rt_msg.sender_id,
                                "file_name": rt_msg.file_name,
                                "file_type": rt_msg.file_type,
                            }
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)

                    # Получаем всех участников чата
                    members_result = await db.execute(
                        select(ChatMember).where(ChatMember.chat_id == chat_id)
                    )
                    members = members_result.scalars().all()

                    # Если личный чат — разоблокируем чат у получателя при первом сообщении
                    chat_result = await db.execute(select(Chat).where(Chat.id == chat_id))
                    chat_obj = chat_result.scalar_one_or_none()
                    if chat_obj and not chat_obj.is_group:
                        for m in members:
                            if m.user_id != user_id and not m.is_visible:
                                m.is_visible = True
                                await db.commit()
                                # Отправляем событие new_chat чтобы фронтенд добавил чат в список
                                sender_result = await db.execute(select(User).where(User.id == user_id))
                                sender = sender_result.scalar_one_or_none()
                                await manager.send_personal(m.user_id, {
                                    "type": "new_chat",
                                    "chat": {
                                        "id": chat_id,
                                        "is_group": False,
                                        "is_department": False,
                                        "name": None,
                                        "other_user": {
                                            "id": sender.id,
                                            "username": sender.username,
                                            "display_name": sender.display_name,
                                            "avatar_url": sender.avatar_url,
                                            "is_admin": sender.is_admin,
                                            "is_team_lead": sender.is_team_lead,
                                        } if sender else None,
                                        "unread_count": 1,
                                    }
                                })

                    # Рассылаем сообщение всем участникам
                    msg_payload = {
                        "type": "message",
                        "chat_id": chat_id,
                        "message": {
                            "id": msg.id,
                            "chat_id": msg.chat_id,
                            "sender_id": msg.sender_id,
                            "content": msg.content,
                            "created_at": msg.created_at.isoformat(),
                            "read": False,
                            "file_url": msg.file_url,
                            "file_name": msg.file_name,
                            "file_size": msg.file_size,
                            "file_type": msg.file_type,
                            "is_file_attachment": msg.is_file_attachment,
                            "files": msg.files,
                            "reply_to_id": msg.reply_to_id,
                            "reply_to": reply_to_data,
                            "edited_at": None,
                            "is_deleted": False,
                        },
                    }

                    for member in members:
                        await manager.send_personal(member.user_id, msg_payload)

    except WebSocketDisconnect:
        await manager.disconnect(user_id)
    except Exception:
        await manager.disconnect(user_id)
