from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.financeiro import TipoMovimentacaoTesouraria

class AporteTesouraria(BaseModel):
    valor: float = Field(..., gt=0, description="Valor do aporte financeiro em reais")
    motivo: Optional[str] = Field("Aporte de Capital / Dinheiro Físico", description="Justificativa do aporte")
    comprovante_url: Optional[str] = Field(None, description="URL ou foto/comprovante do aporte no R2")

class RetiradaTesouraria(BaseModel):
    valor: float = Field(..., gt=0, description="Valor da retirada em reais")
    motivo: Optional[str] = Field("Retirada para Depósito Bancário / Despesa", description="Justificativa da retirada")
    comprovante_url: Optional[str] = Field(None, description="URL ou foto do comprovante de depósito bancário no R2")

class MovimentacaoTesourariaResponse(BaseModel):
    id: int
    cofre_id: int
    usuario_id: int
    usuario_nome: Optional[str] = None
    caixa_id: Optional[int] = None
    tipo: TipoMovimentacaoTesouraria
    valor: float
    saldo_anterior: float
    saldo_posterior: float
    motivo: Optional[str] = None
    comprovante_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class StatusFinanceiroResponse(BaseModel):
    saldo_cofre_central: float
    saldo_gavetas_ativas: float
    saldo_consolidado_dinheiro: float
    total_vendas_hoje_dinheiro: float
    total_vendas_hoje_pix: float
    total_vendas_hoje_cartao: float
    total_vendas_hoje_prazo: float
    total_vendas_hoje_geral: float
    qtd_caixas_abertos: int
