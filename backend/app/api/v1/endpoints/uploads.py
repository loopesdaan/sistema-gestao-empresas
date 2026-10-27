import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.api.deps import get_current_user
from app.models.usuario import Usuario
from app.services.storage import upload_file_r2_or_local, ALLOWED_EXTENSIONS

router = APIRouter()

@router.post("/imagem")
async def upload_imagem(
    file: UploadFile = File(...),
    tipo: str = Form("geral"),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """
    Faz upload seguro de imagens (logo da empresa, comprovantes ou foto de usuário).
    Em produção com credenciais Cloudflare R2, envia para o bucket sistema-gestao-prd.
    Caso contrário, gera Data URI (base64) / gravação local para persistência garantida.
    """
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de imagem não suportado ({ext}). Utilize PNG, JPG, WEBP, SVG ou PDF."
        )

    try:
        conteudo = await file.read()
        if len(conteudo) > 10 * 1024 * 1024:  # Limite de 10MB
            raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 10MB.")

        url_final, data_uri = upload_file_r2_or_local(conteudo, file.filename or "upload.png", tipo)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {e}")

    return {
        "ok": True,
        "url": url_final,
        "data_url": data_uri or url_final,
        "tipo": tipo
    }

