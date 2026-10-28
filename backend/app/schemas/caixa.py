from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.caixa import StatusCaixa, TipoMovimentacaoCaixa

class AberturaCaixa(BaseModel):
    saldo_inicial: Decimal = Decimal("0.00")
    observacoes: Optional[str] = None

class FechamentoCaixa(BaseModel):
    saldo_final_informado: Decimal
    observacoes: Optional[str] = None

class MovimentacaoCaixaCreate(BaseModel):
    tipo: TipoMovimentacaoCaixa
    valor: Decimal
    motivo: str
    caixa_id: Optional[int] = None

class MovimentacaoCaixaResponse(BaseModel):
    id: int
    caixa_id: int
    usuario_id: int
    tipo: TipoMovimentacaoCaixa
    valor: Decimal
    motivo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CaixaResponse(BaseModel):
    id: int
    empresa_id: int
    usuario_id: Optional[int] = None
    usuario_nome: Optional[str] = None
    usuario_email: Optional[str] = None
    usuario_perfil: Optional[str] = None
    usuario_foto: Optional[str] = None
    data_abertura: Optional[datetime] = None
    data_fechamento: Optional[datetime] = None
    saldo_inicial: Decimal
    saldo_final_informado: Optional[Decimal] = None
    saldo_final_calculado: Optional[Decimal] = None
    diferenca: Optional[Decimal] = None
    status: StatusCaixa
    observacoes: Optional[str] = None

    class Config:
        from_attributes = True

class ResumoCaixaResponse(BaseModel):
    caixa: CaixaResponse
    saldo_inicial: Decimal
    total_vendas_dinheiro: Decimal
    total_vendas_pix: Decimal
    total_vendas_cartao_credito: Decimal
    total_vendas_cartao_debito: Decimal
    total_vendas_a_prazo: Decimal
    total_suprimentos: Decimal
    total_sangrias: Decimal
    saldo_esperado_dinheiro: Decimal
    diferenca: Optional[Decimal] = None
    quantidade_vendas: Optional[int] = 0

