from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.usuario import Usuario
from app.models.notificacao import Notificacao, StatusNotificacao

router = APIRouter()

@router.get("")
def listar_notificacoes(
    status_filtro: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista notificações da empresa. Admins vêem todas; funcionários vêem as suas e as globais.
    """
    query = db.query(Notificacao).filter(Notificacao.empresa_id == current_user.empresa_id)
    
    if current_user.papel != "ADMIN":
        query = query.filter((Notificacao.usuario_id == current_user.id) | (Notificacao.usuario_id == None))
        
    if status_filtro:
        query = query.filter(Notificacao.status == status_filtro)
        
    notificacoes = query.order_by(Notificacao.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": n.id,
            "titulo": n.titulo,
            "mensagem": n.mensagem,
            "tipo": n.tipo,
            "referencia_tipo": n.referencia_tipo,
            "referencia_id": n.referencia_id,
            "valor_pendente": float(n.valor_pendente) if n.valor_pendente is not None else None,
            "status": n.status,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "resolvido_em": n.resolvido_em.isoformat() if n.resolvido_em else None
        }
        for n in notificacoes
    ]

@router.put("/{notificacao_id}/resolver")
def resolver_notificacao(
    notificacao_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Marca notificação pendente como RESOLVIDA (ex: quitação de crediário/fiado ou regularização de caixa).
    """
    notif = db.query(Notificacao).filter(
        Notificacao.id == notificacao_id,
        Notificacao.empresa_id == current_user.empresa_id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")
        
    notif.status = StatusNotificacao.RESOLVIDA.value
    notif.resolvido_em = datetime.now(timezone.utc)
    notif.resolvido_por_id = current_user.id
    db.commit()
    db.refresh(notif)
    
    return {"message": "Notificação resolvida com sucesso.", "status": notif.status}
