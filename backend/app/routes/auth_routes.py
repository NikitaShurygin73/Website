from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, SupportTicket, SupportReply
from ..schemas import UserCreate, UserLogin, AuthResponse, UserResponse
from ..auth import hash_password, verify_password, create_access_token, get_current_user


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    user = User(
        username=data.username,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        if not data.display_name.strip():
            raise HTTPException(status_code=400, detail="Имя не может быть пустым")
        current_user.display_name = data.display_name.strip()
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url or None
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/me/password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Новый пароль должен быть не менее 6 символов")
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"ok": True}


class ChangeUsernameRequest(BaseModel):
    username: str


@router.put("/me/username", response_model=UserResponse)
async def change_username(
    data: ChangeUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    username = data.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Логин должен быть не менее 3 символов")
    if not all(c.isalnum() or c == '_' for c in username):
        raise HTTPException(status_code=400, detail="Логин может содержать только буквы, цифры и _")
    result = await db.execute(
        select(User).where(User.username == username)
    )
    existing = result.scalar_one_or_none()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Этот логин уже занят")
    current_user.username = username
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


class SupportTicketCreate(BaseModel):
    username: str
    message: str


class SupportReplyCreate(BaseModel):
    message: str


@router.post("/support")
async def create_support_ticket(data: SupportTicketCreate, db: AsyncSession = Depends(get_db)):
    if not data.username.strip() or not data.message.strip():
        raise HTTPException(status_code=400, detail="Заполните все поля")
    ticket = SupportTicket(username=data.username.strip(), message=data.message.strip())
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return {"ok": True, "ticket_id": ticket.id}


@router.get("/support/{ticket_id}/messages")
async def get_ticket_messages(ticket_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404)
    replies_result = await db.execute(
        select(SupportReply).where(SupportReply.ticket_id == ticket_id).order_by(SupportReply.created_at)
    )
    replies = replies_result.scalars().all()
    return {
        "ticket": {"username": ticket.username, "message": ticket.message, "created_at": ticket.created_at},
        "replies": [{"id": r.id, "message": r.message, "created_at": r.created_at} for r in replies],
    }


@router.post("/support/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    data: SupportReplyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403)
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404)
    reply = SupportReply(ticket_id=ticket_id, message=data.message.strip())
    db.add(reply)
    await db.commit()
    return {"ok": True}


@router.get("/support")
async def get_support_tickets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403)
    result = await db.execute(
        select(SupportTicket).order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    return [{"id": t.id, "username": t.username, "message": t.message,
             "is_resolved": t.is_resolved, "created_at": t.created_at} for t in tickets]


@router.delete("/support/{ticket_id}")
async def resolve_support_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403)
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404)
    await db.delete(ticket)
    await db.commit()
    return {"ok": True}
