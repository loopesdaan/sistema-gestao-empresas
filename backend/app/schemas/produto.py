from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

class ProdutoBase(BaseModel):
    nome: str
    codigo_barras: Optional[str] = None
    categoria: Optional[str] = None
    unidade: str = "UN"
    preco_custo: Decimal = Decimal("0.00")
    preco_venda: Decimal = Decimal("0.00")
    estoque_atual: Decimal = Decimal("0.00")
    estoque_minimo: Decimal = Decimal("0.00")
    ativo: bool = True

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    codigo_barras: Optional[str] = None
    categoria: Optional[str] = None
    unidade: Optional[str] = None
    preco_custo: Optional[Decimal] = None
    preco_venda: Optional[Decimal] = None
    estoque_atual: Optional[Decimal] = None
    estoque_minimo: Optional[Decimal] = None
    ativo: Optional[bool] = None

class ProdutoResponse(ProdutoBase):
    id: int
    empresa_id: int
    created_at: datetime
    estoque_baixo: bool = False

    class Config:
        from_attributes = True

