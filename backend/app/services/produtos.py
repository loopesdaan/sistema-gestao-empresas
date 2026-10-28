from typing import Optional
from sqlalchemy.orm import Session
from app.models.produto import Produto
from app.models.usuario import Usuario

def buscar_produto_seguro(produto_id: int, db: Session, current_user: Usuario) -> Optional[Produto]:
    """
    Busca produto com isolamento multi-tenant resiliente contra:
    1. Arredondamento IEEE 754 float64 no JavaScript (CockroachDB IDs de 64-bit com até 19 dígitos).
    2. Resgate seguro de registros legados órfãos (empresa_id IS NULL).
    """
    if not produto_id:
        return None

    # 1. Busca exata por ID e empresa
    prod = db.query(Produto).filter(
        Produto.id == produto_id,
        Produto.empresa_id == current_user.empresa_id
    ).first()
    if prod:
        return prod

    # 2. Tolerância para IDs de 64-bit do CockroachDB (arredondamento no JS +- 1000) na MESMA empresa
    if produto_id > 10_000_000:
        candidatos = db.query(Produto).filter(
            Produto.empresa_id == current_user.empresa_id,
            Produto.id >= produto_id - 1000,
            Produto.id <= produto_id + 1000
        ).all()
        if len(candidatos) == 1:
            return candidatos[0]
        elif len(candidatos) > 1:
            candidatos.sort(key=lambda x: abs(x.id - produto_id))
            return candidatos[0]

    # 3. Resgate seguro para produtos legados órfãos (empresa_id IS NULL)
    prod_orfao = db.query(Produto).filter(
        Produto.id == produto_id,
        Produto.empresa_id.is_(None)
    ).first()
    if prod_orfao:
        prod_orfao.empresa_id = current_user.empresa_id
        db.commit()
        db.refresh(prod_orfao)
        return prod_orfao

    if produto_id > 10_000_000:
        candidatos_orfaos = db.query(Produto).filter(
            Produto.empresa_id.is_(None),
            Produto.id >= produto_id - 1000,
            Produto.id <= produto_id + 1000
        ).all()
        if candidatos_orfaos:
            candidatos_orfaos.sort(key=lambda x: abs(x.id - produto_id))
            eleito = candidatos_orfaos[0]
            eleito.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(eleito)
            return eleito

    return None
