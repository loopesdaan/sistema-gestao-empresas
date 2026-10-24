from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.os import StatusOS
from app.models.venda import FormaPagamento

class ItemOSCreate(BaseModel):
    produto_id: int
    quantidade: Decimal
    valor_unitario: Decimal

class ItemOSResponse(BaseModel):
    id: int
    produto_id: int
    quantidade: Decimal
    valor_unitario: Decimal
    subtotal: Decimal
    produto_nome: Optional[str] = None

    class Config:
        from_attributes = True

class OSCreate(BaseModel):
    cliente_id: int
    titulo: str
    equipamento: Optional[str] = None
    defeito_relatado: Optional[str] = None
    laudo_tecnico: Optional[str] = None
    valor_servicos: Decimal = Decimal("0.00")
    previsao_entrega: Optional[datetime] = None
    itens: List[ItemOSCreate] = []

class OSUpdate(BaseModel):
    titulo: Optional[str] = None
    equipamento: Optional[str] = None
    defeito_relatado: Optional[str] = None
    laudo_tecnico: Optional[str] = None
    status: Optional[StatusOS] = None
    valor_servicos: Optional[Decimal] = None
    previsao_entrega: Optional[datetime] = None
    itens: Optional[List[ItemOSCreate]] = None

class OSResponse(BaseModel):
    id: int
    empresa_id: int
    cliente_id: int
    cliente_nome: Optional[str] = None
    cliente_telefone: Optional[str] = None
    usuario_id: int
    usuario_nome: Optional[str] = None
    titulo: str
    equipamento: Optional[str] = None
    defeito_relatado: Optional[str] = None
    laudo_tecnico: Optional[str] = None
    status: StatusOS
    valor_servicos: Decimal
    valor_pecas: Decimal
    valor_total: Decimal
    previsao_entrega: Optional[datetime] = None
    data_finalizacao: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    itens: List[ItemOSResponse] = []

    class Config:
        from_attributes = True

class OSPagamentoItem(BaseModel):
    forma_pagamento: FormaPagamento
    valor: Decimal
    troco: Decimal = Decimal("0.00")

class OSFaturarRequest(BaseModel):
    caixa_id: int
    pagamentos: List[OSPagamentoItem]
    desconto: Decimal = Decimal("0.00")
    observacoes: Optional[str] = None

class OSFaturarResponse(BaseModel):
    mensagem: str
    os: OSResponse
    venda_id: int
    valor_pago: Decimal


