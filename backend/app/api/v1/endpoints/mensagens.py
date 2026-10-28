from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.usuario import Usuario
from app.models.mensagem import MensagemInterna

router = APIRouter()

class MensagemCreate(BaseModel):
    conteudo: str = Field(..., min_length=1, max_length=1000, description="Texto da mensagem")

@router.get("")
def listar_mensagens(
    limit: int = 60,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista as mensagens mais recentes do comunicador interno da empresa.
    """
    # Busca as últimas N mensagens e ordena de forma cronológica (ASC)
    mensagens = (
        db.query(MensagemInterna)
        .filter(MensagemInterna.empresa_id == current_user.empresa_id)
        .order_by(MensagemInterna.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )

    # Inverte para ordem cronológica de leitura do chat
    mensagens_ordenadas = list(reversed(mensagens))

    return [
        {
            "id": m.id,
            "usuario_id": m.usuario_id,
            "usuario_nome": m.usuario_nome,
            "usuario_perfil": m.usuario_perfil,
            "usuario_foto_url": m.usuario_foto_url,
            "conteudo": m.conteudo,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "eh_meu": m.usuario_id == current_user.id
        }
        for m in mensagens_ordenadas
    ]

@router.post("")
def enviar_mensagem(
    payload: MensagemCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Envia uma mensagem no canal interno de bate-papo da empresa.
    """
    texto = payload.conteudo.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="O conteúdo da mensagem não pode ser vazio.")

    perfil_str = current_user.perfil.value if hasattr(current_user.perfil, 'value') else str(current_user.perfil)

    nova_mensagem = MensagemInterna(
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        usuario_nome=current_user.nome,
        usuario_perfil=perfil_str,
        usuario_foto_url=current_user.foto_url,
        conteudo=texto,
        created_at=datetime.now(timezone.utc)
    )

    db.add(nova_mensagem)
    db.commit()
    db.refresh(nova_mensagem)

    return {
        "id": nova_mensagem.id,
        "usuario_id": nova_mensagem.usuario_id,
        "usuario_nome": nova_mensagem.usuario_nome,
        "usuario_perfil": nova_mensagem.usuario_perfil,
        "usuario_foto_url": nova_mensagem.usuario_foto_url,
        "conteudo": nova_mensagem.conteudo,
        "created_at": nova_mensagem.created_at.isoformat(),
        "eh_meu": True
    }

