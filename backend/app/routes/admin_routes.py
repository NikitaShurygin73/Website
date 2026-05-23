from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from ..database import get_db
from ..models import User, Department, DepartmentMember
from ..schemas import UserResponse, AdminUserCreate, AdminUserUpdate, DepartmentCreate, DepartmentResponse
from ..auth import get_admin_user, hash_password

router = APIRouter(prefix="/api", tags=["admin"])


@router.get("/admin/users", response_model=List[UserResponse])
async def admin_get_users(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/admin/users", response_model=UserResponse)
async def admin_create_user(
    data: AdminUserCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    user = User(
        username=data.username,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        is_admin=data.is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.patch("/admin/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if data.display_name is not None:
        user.display_name = data.display_name
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_team_lead is not None:
        user.is_team_lead = data.is_team_lead
    if data.password is not None and data.password.strip():
        user.password_hash = hash_password(data.password.strip())

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    await db.delete(user)
    await db.commit()
    return {"ok": True}


@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).order_by(Department.name))
    departments = result.scalars().all()

    dept_list = []
    for dept in departments:
        count_result = await db.execute(
            select(func.count(DepartmentMember.id)).where(DepartmentMember.department_id == dept.id)
        )
        member_count = count_result.scalar() or 0
        dept_list.append(DepartmentResponse(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            member_count=member_count,
            created_at=dept.created_at,
        ))

    return dept_list


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    data: DepartmentCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Отдел с таким названием уже существует")

    dept = Department(name=data.name, description=data.description)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        member_count=0,
        created_at=dept.created_at,
    )


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")

    await db.delete(dept)
    await db.commit()
    return {"ok": True}
