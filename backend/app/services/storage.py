import os
import uuid
import base64
import logging
from typing import Optional, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".pdf"}

def get_mime_type(ext: str) -> str:
    ext = ext.lower()
    if ext in [".jpg", ".jpeg"]:
        return "image/jpeg"
    elif ext == ".png":
        return "image/png"
    elif ext == ".webp":
        return "image/webp"
    elif ext == ".svg":
        return "image/svg+xml"
    elif ext == ".pdf":
        return "application/pdf"
    return "application/octet-stream"

def upload_file_r2_or_local(
    conteudo: bytes,
    filename_orig: str,
    prefix: str = "geral"
) -> Tuple[str, Optional[str]]:
    """
    Realiza o upload seguro de arquivo para o bucket Cloudflare R2 (sistema-gestao-prd)
    utilizando a API compatível S3 (boto3). Caso as credenciais R2 não estejam configuradas
    no ambiente (ex: desenvolvimento local), realiza fallback para armazenamento em disco
    local com Data URI em base64.
    
    Retorna: (url_final, data_uri_base64)
    """
    ext = os.path.splitext(filename_orig)[1].lower() if filename_orig else ".png"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".png"

    filename = f"{prefix}_{uuid.uuid4().hex[:12]}{ext}"
    mime = get_mime_type(ext)

    # 1. Tenta upload no Cloudflare R2 se credenciais estiverem configuradas
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

            s3.put_object(
                Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
                Key=filename,
                Body=conteudo,
                ContentType=mime
            )

            if settings.CLOUDFLARE_R2_PUBLIC_URL:
                url_publica = f"{settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip('/')}/{filename}"
            else:
                url_publica = f"{settings.CLOUDFLARE_R2_ENDPOINT_URL.rstrip('/')}/{settings.CLOUDFLARE_R2_BUCKET_NAME}/{filename}"

            logger.info("Upload realizado com sucesso no Cloudflare R2: %s", url_publica)
            return url_publica, None
        except Exception as e:
            logger.warning("Falha ao enviar arquivo ao Cloudflare R2: %s. Realizando fallback...", e)

    # 2. Fallback: Gravação local + Data URI
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(conteudo)

    base64_str = base64.b64encode(conteudo).decode("utf-8")
    data_uri = f"data:{mime};base64,{base64_str}"

    is_prod = settings.ENVIRONMENT.lower() in ["production", "prod"]
    url_final = data_uri if is_prod else f"/static/uploads/{filename}"

    return url_final, data_uri
