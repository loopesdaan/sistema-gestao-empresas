from typing import Any, List, Optional
from datetime import datetime, timezone, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, get_current_user, get_current_admin_ou_financeiro
from app.models.usuario import Usuario, PerfilUsuario
from app.models.caixa import Caixa, StatusCaixa, MovimentacaoCaixa, TipoMovimentacaoCaixa
from app.models.venda import Venda, PagamentoVenda, StatusVenda, FormaPagamento
from app.models.financeiro import CofreCentral, MovimentacaoTesouraria, TipoMovimentacaoTesouraria
from app.schemas.financeiro import (
    AporteTesouraria,
    RetiradaTesouraria,
    MovimentacaoTesourariaResponse,
    StatusFinanceiroResponse
)

router = APIRouter()

def obter_ou_criar_cofre(db: Session, empresa_id: int, usuario_id: Optional[int] = None) -> CofreCentral:
    cofre = db.query(CofreCentral).filter(CofreCentral.empresa_id == empresa_id).first()
    if not cofre:
        cofre = CofreCentral(
            empresa_id=empresa_id,
            saldo=Decimal("1000.00")
        )
        db.add(cofre)
        db.flush()

        # Cria movimento inicial de auditoria
        mov = MovimentacaoTesouraria(
            empresa_id=empresa_id,
            cofre_id=cofre.id,
            usuario_id=usuario_id or 1,
            tipo=TipoMovimentacaoTesouraria.APORTE,
            valor=Decimal("1000.00"),
            saldo_anterior=Decimal("0.00"),
            saldo_posterior=Decimal("1000.00"),
            motivo="Fundo Inicial de Implantação da Tesouraria",
            created_at=datetime.now(timezone.utc)
        )
        db.add(mov)
        db.commit()
        db.refresh(cofre)
    return cofre

@router.get("/status", response_model=StatusFinanceiroResponse)
def status_financeiro(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_ou_financeiro)
) -> Any:
    """Retorna a visão executiva consolidada da Tesouraria da empresa"""
    cofre = obter_ou_criar_cofre(db, current_user.empresa_id, current_user.id)
    saldo_cofre = float(cofre.saldo)

    # 1. Caixas atualmente abertos e dinheiro nas gavetas
    caixas_abertos = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.status == StatusCaixa.ABERTO
    ).all()

    saldo_gavetas = 0.0
    for cx in caixas_abertos:
        # Fundo inicial
        cx_dinheiro = float(cx.saldo_inicial or 0)

        # Vendas em dinheiro neste caixa
        vendas_dinheiro = db.query(func.coalesce(func.sum(PagamentoVenda.valor), 0)).join(Venda).filter(
            Venda.caixa_id == cx.id,
            Venda.status == StatusVenda.CONCLUIDA,
            PagamentoVenda.forma_pagamento == FormaPagamento.DINHEIRO
        ).scalar()
        cx_dinheiro += float(vendas_dinheiro or 0)

        # Suprimentos (+) e Sangrias (-)
        movs = db.query(MovimentacaoCaixa).filter(MovimentacaoCaixa.caixa_id == cx.id).all()
        for m in movs:
            if m.tipo == TipoMovimentacaoCaixa.SUPRIMENTO:
                cx_dinheiro += float(m.valor)
            elif m.tipo == TipoMovimentacaoCaixa.SANGRIA:
                cx_dinheiro -= float(m.valor)

        saldo_gavetas += max(0.0, cx_dinheiro)

    # 2. Vendas do dia por forma de pagamento
    hoje = datetime.now(timezone.utc).date()
    hoje_inicio = datetime.combine(hoje, datetime.min.time()).replace(tzinfo=timezone.utc)

    pagamentos_hoje = db.query(
        PagamentoVenda.forma_pagamento,
        func.coalesce(func.sum(PagamentoVenda.valor), 0)
    ).join(Venda).filter(
        Venda.empresa_id == current_user.empresa_id,
        Venda.status == StatusVenda.CONCLUIDA,
        Venda.created_at >= hoje_inicio
    ).group_by(PagamentoVenda.forma_pagamento).all()

    vendas_dinheiro_hoje = 0.0
    vendas_pix_hoje = 0.0
    vendas_cartao_hoje = 0.0
    vendas_prazo_hoje = 0.0

    for forma, total in pagamentos_hoje:
        val = float(total or 0)
        if forma == FormaPagamento.DINHEIRO:
            vendas_dinheiro_hoje += val
        elif forma == FormaPagamento.PIX:
            vendas_pix_hoje += val
        elif forma in [FormaPagamento.CARTAO_CREDITO, FormaPagamento.CARTAO_DEBITO]:
            vendas_cartao_hoje += val
        elif forma == FormaPagamento.A_PRAZO:
            vendas_prazo_hoje += val

    total_geral_hoje = vendas_dinheiro_hoje + vendas_pix_hoje + vendas_cartao_hoje + vendas_prazo_hoje

    return StatusFinanceiroResponse(
        saldo_cofre_central=round(saldo_cofre, 2),
        saldo_gavetas_ativas=round(saldo_gavetas, 2),
        saldo_consolidado_dinheiro=round(saldo_cofre + saldo_gavetas, 2),
        total_vendas_hoje_dinheiro=round(vendas_dinheiro_hoje, 2),
        total_vendas_hoje_pix=round(vendas_pix_hoje, 2),
        total_vendas_hoje_cartao=round(vendas_cartao_hoje, 2),
        total_vendas_hoje_prazo=round(vendas_prazo_hoje, 2),
        total_vendas_hoje_geral=round(total_geral_hoje, 2),
        qtd_caixas_abertos=len(caixas_abertos)
    )

@router.post("/aporte", response_model=MovimentacaoTesourariaResponse)
def realizar_aporte(
    dados: AporteTesouraria,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_ou_financeiro)
) -> Any:
    """Registra entrada de capital no cofre central"""
    cofre = obter_ou_criar_cofre(db, current_user.empresa_id, current_user.id)
    
    saldo_ant = cofre.saldo
    novo_saldo = saldo_ant + Decimal(str(dados.valor))
    cofre.saldo = novo_saldo

    mov = MovimentacaoTesouraria(
        empresa_id=current_user.empresa_id,
        cofre_id=cofre.id,
        usuario_id=current_user.id,
        tipo=TipoMovimentacaoTesouraria.APORTE,
        valor=Decimal(str(dados.valor)),
        saldo_anterior=saldo_ant,
        saldo_posterior=novo_saldo,
        motivo=dados.motivo or "Aporte de Capital / Entrada no Cofre",
        created_at=datetime.now(timezone.utc)
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)

    return MovimentacaoTesourariaResponse(
        id=mov.id,
        cofre_id=mov.cofre_id,
        usuario_id=mov.usuario_id,
        usuario_nome=current_user.nome,
        caixa_id=mov.caixa_id,
        tipo=mov.tipo,
        valor=float(mov.valor),
        saldo_anterior=float(mov.saldo_anterior),
        saldo_posterior=float(mov.saldo_posterior),
        motivo=mov.motivo,
        comprovante_url=mov.comprovante_url,
        created_at=mov.created_at
    )

@router.post("/retirada", response_model=MovimentacaoTesourariaResponse)
def realizar_retirada(
    dados: RetiradaTesouraria,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_ou_financeiro)
) -> Any:
    """Registra retirada do cofre central para depósito no banco ou despesa"""
    cofre = obter_ou_criar_cofre(db, current_user.empresa_id, current_user.id)
    
    val_dec = Decimal(str(dados.valor))
    if cofre.saldo < val_dec:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente no cofre central. Disponível: R$ {float(cofre.saldo):.2f}"
        )

    saldo_ant = cofre.saldo
    novo_saldo = saldo_ant - val_dec
    cofre.saldo = novo_saldo

    mov = MovimentacaoTesouraria(
        empresa_id=current_user.empresa_id,
        cofre_id=cofre.id,
        usuario_id=current_user.id,
        tipo=TipoMovimentacaoTesouraria.RETIRADA,
        valor=val_dec,
        saldo_anterior=saldo_ant,
        saldo_posterior=novo_saldo,
        motivo=dados.motivo or "Retirada para Depósito Bancário / Despesa",
        created_at=datetime.now(timezone.utc)
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)

    return MovimentacaoTesourariaResponse(
        id=mov.id,
        cofre_id=mov.cofre_id,
        usuario_id=mov.usuario_id,
        usuario_nome=current_user.nome,
        caixa_id=mov.caixa_id,
        tipo=mov.tipo,
        valor=float(mov.valor),
        saldo_anterior=float(mov.saldo_anterior),
        saldo_posterior=float(mov.saldo_posterior),
        motivo=mov.motivo,
        comprovante_url=mov.comprovante_url,
        created_at=mov.created_at
    )

@router.get("/extrato", response_model=List[MovimentacaoTesourariaResponse])
def extrato_tesouraria(
    tipo: Optional[TipoMovimentacaoTesouraria] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_ou_financeiro)
) -> Any:
    """Retorna o extrato cronológico das movimentações do Cofre Central"""
    cofre = obter_ou_criar_cofre(db, current_user.empresa_id, current_user.id)
    
    query = db.query(MovimentacaoTesouraria).filter(
        MovimentacaoTesouraria.empresa_id == current_user.empresa_id,
        MovimentacaoTesouraria.cofre_id == cofre.id
    )
    if tipo:
        query = query.filter(MovimentacaoTesouraria.tipo == tipo)

    movs = query.order_by(MovimentacaoTesouraria.created_at.desc()).limit(limit).all()

    resultados = []
    for m in movs:
        resultados.append(MovimentacaoTesourariaResponse(
            id=m.id,
            cofre_id=m.cofre_id,
            usuario_id=m.usuario_id,
            usuario_nome=m.usuario.nome if m.usuario else "Sistema",
            caixa_id=m.caixa_id,
            tipo=m.tipo,
            valor=float(m.valor),
            saldo_anterior=float(m.saldo_anterior),
            saldo_posterior=float(m.saldo_posterior),
            motivo=m.motivo,
            comprovante_url=m.comprovante_url,
            created_at=m.created_at
        ))
    return resultados
