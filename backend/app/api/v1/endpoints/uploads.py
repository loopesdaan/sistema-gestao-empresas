import os
import uuid
import base64
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.api.deps import get_current_user
from app.models.usuario import Usuario
from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}

@router.post("/imagem")
async def upload_imagem(
    file: UploadFile = File(...),
    tipo: str = Form("geral"),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """
    Faz upload seguro de imagens (logo da empresa ou foto de usuário).
    Em containers com disco efêmero (Render/Heroku/Koyeb), gera Data URI (base64)
    para persistência permanente nas colunas textuais do banco relacional PostgreSQL.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Valida extensão
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de imagem não suportado ({ext}). Utilize PNG, JPG, WEBP ou SVG."
        )

    # Gera nome único
    filename = f"{tipo}_{uuid.uuid4().hex[:12]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    try:
        conteudo = await file.read()
        if len(conteudo) > 5 * 1024 * 1024:  # Limite de 5MB
            raise HTTPException(status_code=400, detail="A imagem deve ter no máximo 5MB.")
            
        with open(filepath, "wb") as f:
            f.write(conteudo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {e}")

    # Determina o MIME type para Base64 persistente
    mime_type = "image/png"
    if ext in [".jpg", ".jpeg"]:
        mime_type = "image/jpeg"
    elif ext == ".webp":
        mime_type = "image/webp"
    elif ext == ".svg":
        mime_type = "image/svg+xml"

    base64_str = base64.b64encode(conteudo).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{base64_str}"

    # Em produção em nuvem efêmera (Render), usa o data_uri para nunca sumir
    is_prod = settings.ENVIRONMENT.lower() in ["production", "prod"]
    url_final = data_uri if is_prod else f"/static/uploads/{filename}"

    return {
        "ok": True,
        "url": url_final,
        "data_url": data_uri,
        "static_url": f"/static/uploads/{filename}",
        "filename": filename,
        "tipo": tipo
    }

