from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.produto import Produto
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoResponse
from app.api.deps import get_current_user

router = APIRouter()

def serialize_produto(prod: Produto) -> dict:
    return {
        "id": prod.id,
        "empresa_id": prod.empresa_id,
        "nome": prod.nome,
        "codigo_barras": prod.codigo_barras,
        "categoria": prod.categoria,
        "unidade": prod.unidade,
        "preco_custo": prod.preco_custo,
        "preco_venda": prod.preco_venda,
        "estoque_atual": prod.estoque_atual,
        "estoque_minimo": prod.estoque_minimo,
        "ativo": prod.ativo,
        "created_at": prod.created_at,
        "estoque_baixo": bool(prod.estoque_atual <= prod.estoque_minimo and prod.estoque_minimo > 0)
    }

@router.get("", response_model=List[ProdutoResponse])
def listar_produtos(
    q: Optional[str] = Query(None, description="Busca por nome, categoria ou código de barras"),
    apenas_estoque_baixo: bool = False,
    apenas_ativos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(Produto).filter(Produto.empresa_id == current_user.empresa_id)
    if apenas_ativos:
        query = query.filter(Produto.ativo == True)
    if apenas_estoque_baixo:
        query = query.filter(Produto.estoque_atual <= Produto.estoque_minimo, Produto.estoque_minimo > 0)
    if q:
        termo = f"%{q}%"
        query = query.filter(
            or_(
                Produto.nome.ilike(termo),
                Produto.codigo_barras.ilike(termo),
                Produto.categoria.ilike(termo)
            )
        )
    produtos = query.order_by(Produto.nome.asc()).all()
    return [serialize_produto(p) for p in produtos]

@router.get("/codigo-barras/{codigo}", response_model=ProdutoResponse)
def buscar_por_codigo_barras(
    codigo: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    produto = db.query(Produto).filter(
        Produto.codigo_barras == codigo,
        Produto.empresa_id == current_user.empresa_id,
        Produto.ativo == True
    ).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado com este código de barras")
    return serialize_produto(produto)

@router.get("/{produto_id}", response_model=ProdutoResponse)
def obter_produto(
    produto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    produto = db.query(Produto).filter(
        Produto.id == produto_id,
        Produto.empresa_id == current_user.empresa_id
    ).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return serialize_produto(produto)

@router.post("", response_model=ProdutoResponse)
def criar_produto(
    produto_in: ProdutoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil not in [PerfilUsuario.ADMIN, PerfilUsuario.ESTOQUISTA]:
        raise HTTPException(status_code=403, detail="Apenas Administradores e Estoquistas podem cadastrar produtos.")

    # Unidades discretas devem ser números inteiros
    if produto_in.unidade in ["UN", "CX", "PC", "PAR"] and produto_in.estoque_atual % 1 != 0:
        raise HTTPException(status_code=400, detail=f"Itens com unidade '{produto_in.unidade}' devem ter estoque com quantidade inteira.")

    produto = Produto(
        empresa_id=current_user.empresa_id,
        **produto_in.model_dump()
    )
    db.add(produto)
    db.commit()
    db.refresh(produto)
    return serialize_produto(produto)

@router.put("/{produto_id}", response_model=ProdutoResponse)
def atualizar_produto(
    produto_id: int,
    produto_in: ProdutoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil not in [PerfilUsuario.ADMIN, PerfilUsuario.ESTOQUISTA]:
        raise HTTPException(status_code=403, detail="Apenas Administradores e Estoquistas podem alterar produtos e estoque.")

    produto = db.query(Produto).filter(
        Produto.id == produto_id,
        Produto.empresa_id == current_user.empresa_id
    ).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    # Unidades discretas devem ser números inteiros
    unidade_verificar = produto_in.unidade or produto.unidade
    if produto_in.estoque_atual is not None and unidade_verificar in ["UN", "CX", "PC", "PAR"] and produto_in.estoque_atual % 1 != 0:
        raise HTTPException(status_code=400, detail=f"Itens com unidade '{unidade_verificar}' devem ter estoque com quantidade inteira.")

    for field, value in produto_in.model_dump(exclude_unset=True).items():
        setattr(produto, field, value)

    db.add(produto)
    db.commit()
    db.refresh(produto)
    return serialize_produto(produto)

