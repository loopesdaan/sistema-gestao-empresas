from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel

class TopProduto(BaseModel):
    produto_id: int
    nome: str
    total_vendido: Decimal
    valor_total: Decimal

class VendaDiaria(BaseModel):
    data: str
    total: Decimal
    quantidade_vendas: int

class ResumoDashboard(BaseModel):
    faturamento_hoje: Decimal
    faturamento_mes: Decimal
    quantidade_vendas_hoje: int
    quantidade_vendas_mes: int
    ordens_servico_abertas: int
    produtos_estoque_baixo: int
    ticket_medio: Decimal
    top_produtos: List[TopProduto] = []
    vendas_ultimos_dias: List[VendaDiaria] = []

