from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.venda import StatusVenda, FormaPagamento

class ItemVendaCreate(BaseModel):
    produto_id: int
    quantidade: Decimal
    valor_unitario: Decimal

class PagamentoVendaCreate(BaseModel):
    forma_pagamento: FormaPagamento
    valor: Decimal
    troco: Decimal = Decimal("0.00")

class VendaCreate(BaseModel):
    caixa_id: int
    cliente_id: Optional[int] = None
    desconto: Decimal = Decimal("0.00")
    acrescimo: Decimal = Decimal("0.00")
    itens: List[ItemVendaCreate]
    pagamentos: List[PagamentoVendaCreate]
    observacoes: Optional[str] = None

class ItemVendaResponse(BaseModel):
    id: int
    produto_id: int
    quantidade: Decimal
    valor_unitario: Decimal
    subtotal: Decimal
    produto_nome: Optional[str] = None

    class Config:
        from_attributes = True

class PagamentoVendaResponse(BaseModel):
    id: int
    forma_pagamento: FormaPagamento
    valor: Decimal
    troco: Decimal

    class Config:
        from_attributes = True

class VendaResponse(BaseModel):
    id: int
    empresa_id: int
    caixa_id: int
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = None
    usuario_id: int
    usuario_nome: Optional[str] = None
    valor_bruto: Decimal
    desconto: Decimal
    acrescimo: Decimal
    valor_liquido: Decimal
    status: StatusVenda
    observacoes: Optional[str] = None
    created_at: datetime
    itens: List[ItemVendaResponse] = []
    pagamentos: List[PagamentoVendaResponse] = []

    class Config:
        from_attributes = True

