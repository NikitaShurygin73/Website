import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from ..auth import get_current_user
from ..models import User

router = APIRouter(prefix="/api", tags=["files"])

UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024  # 3 GB


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix if file.filename else ""
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = UPLOADS_DIR / unique_name

    size = 0
    try:
        with open(file_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    out.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 3 ГБ)")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении файла: {str(e)}")

    return {
        "url": f"/uploads/{unique_name}",
        "name": file.filename or unique_name,
        "size": size,
        "type": file.content_type or "application/octet-stream",
    }
