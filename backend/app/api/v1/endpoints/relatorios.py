from decimal import Decimal
from typing import Any
from datetime import datetime, date, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.produto import Produto
from app.models.venda import Venda, ItemVenda, StatusVenda
from app.models.os import OrdemServico, StatusOS
from app.schemas.dashboard import ResumoDashboard, TopProduto, VendaDiaria
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/dashboard", response_model=ResumoDashboard)
def obter_dashboard(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    agora = datetime.now(timezone.utc)
    inicio_hoje = datetime(agora.year, agora.month, agora.day)
    inicio_mes = datetime(agora.year, agora.month, 1)

    # Vendas de Hoje
    vendas_hoje = db.query(Venda).filter(
        Venda.empresa_id == current_user.empresa_id,
        Venda.status == StatusVenda.CONCLUIDA,
        Venda.created_at >= inicio_hoje
    ).all()
    faturamento_hoje = sum([v.valor_liquido for v in vendas_hoje], Decimal("0.00"))
    qtd_vendas_hoje = len(vendas_hoje)

    # Vendas do Mês
    vendas_mes = db.query(Venda).filter(
        Venda.empresa_id == current_user.empresa_id,
        Venda.status == StatusVenda.CONCLUIDA,
        Venda.created_at >= inicio_mes
    ).all()
    faturamento_mes = sum([v.valor_liquido for v in vendas_mes], Decimal("0.00"))
    qtd_vendas_mes = len(vendas_mes)

    ticket_medio = (faturamento_mes / qtd_vendas_mes) if qtd_vendas_mes > 0 else Decimal("0.00")

    # Ordens de Serviço abertas
    os_abertas = db.query(OrdemServico).filter(
        OrdemServico.empresa_id == current_user.empresa_id,
        OrdemServico.status.in_([StatusOS.ABERTA, StatusOS.EM_ANDAMENTO, StatusOS.AGUARDANDO_PECAS])
    ).count()

    # Produtos com estoque baixo
    produtos_alerta = db.query(Produto).filter(
        Produto.empresa_id == current_user.empresa_id,
        Produto.ativo == True,
        Produto.estoque_atual <= Produto.estoque_minimo,
        Produto.estoque_minimo > 0
    ).count()

    # Top 5 produtos mais vendidos
    top_query = (
        db.query(
            Produto.id,
            Produto.nome,
            func.sum(ItemVenda.quantidade).label("total_qtd"),
            func.sum(ItemVenda.subtotal).label("total_val")
        )
        .join(ItemVenda, ItemVenda.produto_id == Produto.id)
        .join(Venda, Venda.id == ItemVenda.venda_id)
        .filter(
            Venda.empresa_id == current_user.empresa_id,
            Venda.status == StatusVenda.CONCLUIDA
        )
        .group_by(Produto.id, Produto.nome)
        .order_by(desc("total_qtd"))
        .limit(5)
        .all()
    )

    top_produtos = [
        TopProduto(
            produto_id=r[0],
            nome=r[1],
            total_vendido=r[2] or Decimal("0.00"),
            valor_total=r[3] or Decimal("0.00")
        )
        for r in top_query
    ]

    # Histórico dos últimos 7 dias
    vendas_dias = []
    for i in range(6, -1, -1):
        dia_dt = agora.date() - timedelta(days=i)
        dia_inicio = datetime(dia_dt.year, dia_dt.month, dia_dt.day)
        dia_fim = dia_inicio + timedelta(days=1)

        v_dia = db.query(Venda).filter(
            Venda.empresa_id == current_user.empresa_id,
            Venda.status == StatusVenda.CONCLUIDA,
            Venda.created_at >= dia_inicio,
            Venda.created_at < dia_fim
        ).all()
        tot_dia = sum([v.valor_liquido for v in v_dia], Decimal("0.00"))
        vendas_dias.append(
            VendaDiaria(
                data=dia_dt.strftime("%d/%m"),
                total=tot_dia,
                quantidade_vendas=len(v_dia)
            )
        )

    return ResumoDashboard(
        faturamento_hoje=faturamento_hoje,
        faturamento_mes=faturamento_mes,
        quantidade_vendas_hoje=qtd_vendas_hoje,
        quantidade_vendas_mes=qtd_vendas_mes,
        ordens_servico_abertas=os_abertas,
        produtos_estoque_baixo=produtos_alerta,
        ticket_medio=ticket_medio,
        top_produtos=top_produtos,
        vendas_ultimos_dias=vendas_dias
    )

