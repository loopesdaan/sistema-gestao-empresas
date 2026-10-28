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

@router.get("/arquivo/{filename}")
def obter_arquivo_upload(filename: str) -> Any:
    """
    Retorna o arquivo de upload diretamente (Cloudflare R2 ou armazenamento local).
    Garante que links para imagens e comprovantes funcionem em qualquer aba ou contexto.
    """
    from fastapi.responses import Response, FileResponse
    from app.core.config import settings
    from app.services.storage import UPLOAD_DIR, get_mime_type

    # 1. Se credenciais R2 configuradas, busca do Cloudflare R2
    if settings.CLOUDFLARE_R2_ACCESS_KEY_ID and settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY:
        try:
            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT_URL,
                aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
                region_name="auto",
                config=Config(signature_version="s3v4")
            )
            obj = s3.get_object(Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME, Key=filename)
            conteudo = obj["Body"].read()
            mime = obj.get("ContentType") or get_mime_type(os.path.splitext(filename)[1])
            return Response(content=conteudo, media_type=mime)
        except Exception:
            pass

    # 2. Busca do disco local
    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(filepath):
        mime = get_mime_type(os.path.splitext(filename)[1])
        return FileResponse(filepath, media_type=mime)

    raise HTTPException(status_code=404, detail="Arquivo não encontrado")

