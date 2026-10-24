from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.estoque import TipoMovimentacaoEstoque

class MovimentacaoEstoqueCreate(BaseModel):
    produto_id: int
    tipo: TipoMovimentacaoEstoque
    quantidade: Decimal
    motivo: Optional[str] = None

class MovimentacaoEstoqueResponse(BaseModel):
    id: int
    empresa_id: int
    produto_id: int
    usuario_id: Optional[int] = None
    tipo: TipoMovimentacaoEstoque
    quantidade: Decimal
    motivo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ImportacaoExcelResponse(BaseModel):
    sucesso: bool
    total_processados: int
    total_criados: int
    total_atualizados: int
    erros: list[str] = []

