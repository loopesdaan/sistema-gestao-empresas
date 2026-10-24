from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[ClienteResponse])
def listar_clientes(
    q: Optional[str] = Query(None, description="Busca por nome, CPF/CNPJ ou telefone"),
    apenas_ativos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(Cliente).filter(Cliente.empresa_id == current_user.empresa_id)
    if apenas_ativos:
        query = query.filter(Cliente.ativo == True)
    if q:
        termo = f"%{q}%"
        query = query.filter(
            or_(
                Cliente.nome.ilike(termo),
                Cliente.cpf_cnpj.ilike(termo),
                Cliente.telefone.ilike(termo),
                Cliente.placa_veiculo.ilike(termo),
                Cliente.modelo_veiculo.ilike(termo)
            )
        )
    return query.order_by(Cliente.nome.asc()).all()

@router.get("/{cliente_id}", response_model=ClienteResponse)
def obter_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.empresa_id == current_user.empresa_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente

@router.post("", response_model=ClienteResponse)
def criar_cliente(
    cliente_in: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = Cliente(
        empresa_id=current_user.empresa_id,
        **cliente_in.model_dump()
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.put("/{cliente_id}", response_model=ClienteResponse)
def atualizar_cliente(
    cliente_id: int,
    cliente_in: ClienteUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.empresa_id == current_user.empresa_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    for field, value in cliente_in.model_dump(exclude_unset=True).items():
        setattr(cliente, field, value)

    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

