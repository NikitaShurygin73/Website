from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    display_name: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    is_active: bool
    is_team_lead: bool = False
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: Optional[int] = None
    content: str
    created_at: datetime
    read: bool = False
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    is_file_attachment: bool = False
    files: Optional[list] = None
    reply_to_id: Optional[int] = None
    reply_to: Optional[dict] = None
    edited_at: Optional[datetime] = None
    is_deleted: bool = False

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    id: int
    is_group: bool
    name: Optional[str] = None
    other_user: Optional[UserResponse] = None
    admin_id: Optional[int] = None
    is_department: bool = False
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EditMessageRequest(BaseModel):
    content: str


class CreateChatRequest(BaseModel):
    user_id: int


class AdminUserCreate(BaseModel):
    username: str
    display_name: str
    password: str
    is_admin: bool = False


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    is_team_lead: Optional[bool] = None
    password: Optional[str] = None


class CreateGroupRequest(BaseModel):
    name: str
    member_ids: List[int]
    is_department: bool = False


class AddMemberRequest(BaseModel):
    user_id: int


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    member_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
