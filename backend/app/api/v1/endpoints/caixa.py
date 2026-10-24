from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.caixa import Caixa, MovimentacaoCaixa, StatusCaixa, TipoMovimentacaoCaixa, SolicitacaoCaixa, TipoSolicitacaoCaixa, StatusSolicitacaoCaixa
from app.models.notificacao import Notificacao
from app.models.venda import Venda, PagamentoVenda, StatusVenda, FormaPagamento
from app.schemas.caixa import (
    AberturaCaixa, FechamentoCaixa, MovimentacaoCaixaCreate,
    CaixaResponse, MovimentacaoCaixaResponse, ResumoCaixaResponse
)
from app.api.deps import get_current_user

router = APIRouter()

def serialize_caixa(caixa: Caixa) -> CaixaResponse:
    diferenca = None
    if caixa.saldo_final_informado is not None and caixa.saldo_final_calculado is not None:
        diferenca = caixa.saldo_final_informado - caixa.saldo_final_calculado

    return CaixaResponse(
        id=caixa.id,
        empresa_id=caixa.empresa_id,
        usuario_id=caixa.usuario_id,
        usuario_nome=caixa.usuario.nome if caixa.usuario else None,
        data_abertura=caixa.data_abertura,
        data_fechamento=caixa.data_fechamento,
        saldo_inicial=caixa.saldo_inicial,
        saldo_final_informado=caixa.saldo_final_informado,
        saldo_final_calculado=caixa.saldo_final_calculado,
        diferenca=diferenca,
        status=caixa.status,
        observacoes=caixa.observacoes
    )

def calcular_resumo_caixa(caixa: Caixa, db: Session) -> ResumoCaixaResponse:
    # Busca todas as vendas concluídas do caixa
    vendas = db.query(Venda).filter(
        Venda.caixa_id == caixa.id,
        Venda.status == StatusVenda.CONCLUIDA
    ).all()
    venda_ids = [v.id for v in vendas]

    totais_por_forma = {
        FormaPagamento.DINHEIRO: Decimal("0.00"),
        FormaPagamento.PIX: Decimal("0.00"),
        FormaPagamento.CARTAO_CREDITO: Decimal("0.00"),
        FormaPagamento.CARTAO_DEBITO: Decimal("0.00"),
        FormaPagamento.A_PRAZO: Decimal("0.00")
    }

    if venda_ids:
        pagamentos = db.query(PagamentoVenda).filter(PagamentoVenda.venda_id.in_(venda_ids)).all()
        for p in pagamentos:
            # Para dinheiro, desconta o troco
            valor_efetivo = p.valor - (p.troco if p.forma_pagamento == FormaPagamento.DINHEIRO else Decimal("0.00"))
            totais_por_forma[p.forma_pagamento] += valor_efetivo

    # Movimentações do caixa (sangrias e suprimentos)
    movs = db.query(MovimentacaoCaixa).filter(MovimentacaoCaixa.caixa_id == caixa.id).all()
    total_suprimentos = sum([m.valor for m in movs if m.tipo == TipoMovimentacaoCaixa.SUPRIMENTO], Decimal("0.00"))
    total_sangrias = sum([m.valor for m in movs if m.tipo == TipoMovimentacaoCaixa.SANGRIA], Decimal("0.00"))

    # Saldo em dinheiro esperado no caixa físico
    saldo_esperado = caixa.saldo_inicial + totais_por_forma[FormaPagamento.DINHEIRO] + total_suprimentos - total_sangrias
    diferenca = None
    if caixa.saldo_final_informado is not None:
        diferenca = caixa.saldo_final_informado - saldo_esperado

    return ResumoCaixaResponse(
        caixa=serialize_caixa(caixa),
        saldo_inicial=caixa.saldo_inicial,
        total_vendas_dinheiro=totais_por_forma[FormaPagamento.DINHEIRO],
        total_vendas_pix=totais_por_forma[FormaPagamento.PIX],
        total_vendas_cartao_credito=totais_por_forma[FormaPagamento.CARTAO_CREDITO],
        total_vendas_cartao_debito=totais_por_forma[FormaPagamento.CARTAO_DEBITO],
        total_vendas_a_prazo=totais_por_forma[FormaPagamento.A_PRAZO],
        total_suprimentos=total_suprimentos,
        total_sangrias=total_sangrias,
        saldo_esperado_dinheiro=saldo_esperado,
        diferenca=diferenca,
        quantidade_vendas=len(vendas)
    )

@router.get("/atual", response_model=Optional[CaixaResponse])
def obter_caixa_atual(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Busca o caixa aberto atualmente para o usuário logado"""
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        return None

    caixa = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.usuario_id == current_user.id,
        Caixa.status == StatusCaixa.ABERTO
    ).order_by(Caixa.data_abertura.desc()).first()
    return serialize_caixa(caixa) if caixa else None

@router.get("/abertos", response_model=List[CaixaResponse])
def listar_caixas_abertos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Visão de Gestor/Admin: Lista todos os caixas atualmente abertos na empresa"""
    caixas = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.status == StatusCaixa.ABERTO
    ).order_by(Caixa.data_abertura.desc()).all()
    return [serialize_caixa(c) for c in caixas]

@router.post("/abrir", response_model=CaixaResponse)
def abrir_caixa(
    dados: AberturaCaixa,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        raise HTTPException(
            status_code=403,
            detail="O Controlador de Estoque trabalha exclusivamente com gestão de inventário e não opera caixas."
        )

    # Verifica se já existe caixa aberto para esse operador
    caixa_aberto = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.usuario_id == current_user.id,
        Caixa.status == StatusCaixa.ABERTO
    ).first()
    if caixa_aberto:
        raise HTTPException(status_code=400, detail="Você já possui um caixa em aberto.")

    novo_caixa = Caixa(
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        saldo_inicial=dados.saldo_inicial,
        observacoes=dados.observacoes,
        status=StatusCaixa.ABERTO
    )
    db.add(novo_caixa)
    db.commit()
    db.refresh(novo_caixa)
    return serialize_caixa(novo_caixa)

@router.post("/movimentacao", response_model=MovimentacaoCaixaResponse)
def lancar_movimentacao(
    dados: MovimentacaoCaixaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    caixa = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.usuario_id == current_user.id,
        Caixa.status == StatusCaixa.ABERTO
    ).first()
    if not caixa:
        raise HTTPException(status_code=400, detail="Nenhum caixa aberto para este operador.")

    mov = MovimentacaoCaixa(
        caixa_id=caixa.id,
        usuario_id=current_user.id,
        tipo=dados.tipo,
        valor=dados.valor,
        motivo=dados.motivo
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov

@router.get("/resumo/{caixa_id}", response_model=ResumoCaixaResponse)
def obter_resumo(
    caixa_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    caixa = db.query(Caixa).filter(
        Caixa.id == caixa_id,
        Caixa.empresa_id == current_user.empresa_id
    ).first()
    if not caixa:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")

    # Operadores normais só podem ver seu próprio caixa, admins podem ver qualquer um
    if current_user.perfil != PerfilUsuario.ADMIN and caixa.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso restrito ao operador responsável ou administrador.")

    return calcular_resumo_caixa(caixa, db)

@router.post("/fechar/{caixa_id}", response_model=ResumoCaixaResponse)
def fechar_caixa(
    caixa_id: int,
    dados: FechamentoCaixa,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    caixa = db.query(Caixa).filter(
        Caixa.id == caixa_id,
        Caixa.empresa_id == current_user.empresa_id
    ).first()
    if not caixa:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")
    if caixa.status == StatusCaixa.FECHADO:
        raise HTTPException(status_code=400, detail="Este caixa já se encontra fechado.")

    if current_user.perfil != PerfilUsuario.ADMIN and caixa.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você só pode fechar o seu próprio caixa.")

    resumo = calcular_resumo_caixa(caixa, db)
    caixa.status = StatusCaixa.FECHADO
    caixa.data_fechamento = datetime.now(timezone.utc)
    caixa.saldo_final_informado = dados.saldo_final_informado
    caixa.saldo_final_calculado = resumo.saldo_esperado_dinheiro
    if dados.observacoes:
        caixa.observacoes = (caixa.observacoes or "") + ("\nFechamento: " + dados.observacoes)

    db.add(caixa)
    db.commit()
    db.refresh(caixa)

    return calcular_resumo_caixa(caixa, db)

@router.get("/historico", response_model=List[CaixaResponse])
def historico_caixas(
    status: Optional[StatusCaixa] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(Caixa).filter(Caixa.empresa_id == current_user.empresa_id)
    if status:
        query = query.filter(Caixa.status == status)
    # Se não for admin, vê apenas o seu histórico
    if current_user.perfil != PerfilUsuario.ADMIN:
        query = query.filter(Caixa.usuario_id == current_user.id)
    caixas = query.order_by(Caixa.data_abertura.desc()).limit(100).all()
    return [serialize_caixa(c) for c in caixas]

class TicketCaixaSchema(BaseModel):
    tipo: TipoSolicitacaoCaixa
    valor_solicitado: Optional[Decimal] = None
    motivo: Optional[str] = None

class RespostaTicketSchema(BaseModel):
    aprovado: bool
    valor_aprovado: Optional[Decimal] = None
    motivo: Optional[str] = None

@router.post("/{caixa_id}/solicitar-ticket")
def solicitar_ticket_caixa(
    caixa_id: int,
    dados: TicketCaixaSchema,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Operador solicita suprimento de troco ou sangria de dinheiro para aprovação do Administrador"""
    caixa = db.query(Caixa).filter(
        Caixa.id == caixa_id,
        Caixa.empresa_id == current_user.empresa_id
    ).first()
    if not caixa or caixa.status != StatusCaixa.ABERTO:
        raise HTTPException(status_code=400, detail="Caixa deve estar aberto para solicitar tickets.")

    ticket = SolicitacaoCaixa(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        usuario_id=current_user.id,
        tipo=dados.tipo,
        valor_solicitado=dados.valor_solicitado,
        motivo=dados.motivo,
        status=StatusSolicitacaoCaixa.PENDENTE
    )
    db.add(ticket)
    
    # Cria notificação para os administradores
    notif = Notificacao(
        empresa_id=current_user.empresa_id,
        usuario_id=None,
        titulo=f"Solicitação de {dados.tipo.value} (Caixa #{caixa.id})",
        mensagem=f"Operador {current_user.nome} solicitou {dados.tipo.value} {f'de R$ {dados.valor_solicitado}' if dados.valor_solicitado else ''}. Motivo: {dados.motivo or 'Não informado'}.",
        tipo="CAIXA_TICKET",
        referencia_tipo="CAIXA",
        referencia_id=caixa.id
    )
    db.add(notif)
    db.commit()
    db.refresh(ticket)

    return {
        "ok": True,
        "mensagem": "Solicitação enviada com sucesso ao administrador.",
        "ticket_id": ticket.id,
        "status": ticket.status
    }

@router.get("/solicitacoes/pendentes")
def listar_solicitacoes_pendentes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Lista solicitações de suprimento e sangria pendentes de resposta"""
    query = db.query(SolicitacaoCaixa).filter(
        SolicitacaoCaixa.empresa_id == current_user.empresa_id,
        SolicitacaoCaixa.status == StatusSolicitacaoCaixa.PENDENTE
    )
    if current_user.perfil != PerfilUsuario.ADMIN:
        query = query.filter(SolicitacaoCaixa.usuario_id == current_user.id)
        
    tickets = query.order_by(SolicitacaoCaixa.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "caixa_id": t.caixa_id,
            "usuario_id": t.usuario_id,
            "usuario_nome": t.caixa.usuario.nome if t.caixa and t.caixa.usuario else "",
            "tipo": t.tipo,
            "valor_solicitado": t.valor_solicitado,
            "motivo": t.motivo,
            "status": t.status,
            "created_at": t.created_at
        }
        for t in tickets
    ]

@router.post("/solicitacoes/{ticket_id}/responder")
def responder_ticket_caixa(
    ticket_id: int,
    dados: RespostaTicketSchema,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Administrador autoriza ou recusa solicitação de suprimento/sangria, gerando movimentação automática"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem responder tickets de caixa.")

    ticket = db.query(SolicitacaoCaixa).filter(
        SolicitacaoCaixa.id == ticket_id,
        SolicitacaoCaixa.empresa_id == current_user.empresa_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if ticket.status != StatusSolicitacaoCaixa.PENDENTE:
        raise HTTPException(status_code=400, detail="Esta solicitação já foi respondida.")

    agora = datetime.now(timezone.utc)
    ticket.respondido_em = agora
    ticket.respondido_por_id = current_user.id

    if dados.aprovado:
        valor = dados.valor_aprovado or ticket.valor_solicitado or Decimal("0.00")
        ticket.status = StatusSolicitacaoCaixa.APROVADO
        ticket.valor_aprovado = valor

        # Gera movimentação real no caixa
        tipo_mov = TipoMovimentacaoCaixa.SUPRIMENTO if ticket.tipo == TipoSolicitacaoCaixa.SUPRIMENTO else TipoMovimentacaoCaixa.SANGRIA
        mov = MovimentacaoCaixa(
            caixa_id=ticket.caixa_id,
            usuario_id=ticket.usuario_id,
            tipo=tipo_mov,
            valor=valor,
            motivo=f"Aprovado pelo ADM {current_user.nome}: {dados.motivo or ticket.motivo or 'Sem observações'}"
        )
        db.add(mov)
    else:
        ticket.status = StatusSolicitacaoCaixa.REJEITADO

    db.commit()
    db.refresh(ticket)

    return {
        "ok": True,
        "mensagem": f"Solicitação {'aprovada com sucesso' if dados.aprovado else 'rejeitada'}.",
        "ticket_id": ticket.id,
        "status": ticket.status
    }

@router.get("/monitor-tempo-real")
def monitor_tempo_real(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Painel do Administrador com caixas operando, disponíveis e alertas de limite de gaveta"""
    caixas_abertos = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.status == StatusCaixa.ABERTO
    ).all()

    caixas_pendentes_fechamento = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.status == StatusCaixa.PENDENTE_APROVACAO
    ).all()

    total_usuarios_caixa = db.query(Usuario).filter(
        Usuario.empresa_id == current_user.empresa_id,
        Usuario.ativo == True
    ).count()

    operando = []
    agora = datetime.now(timezone.utc)

    for c in caixas_abertos:
        resumo = calcular_resumo_caixa(c, db)
        limite = c.limite_gaveta or Decimal("1000.00")
        saldo_dinheiro = resumo.saldo_esperado_dinheiro
        alerta_limite = saldo_dinheiro >= limite

        if c.data_abertura.tzinfo is not None:
            duracao_segundos = max(0, (agora - c.data_abertura).total_seconds())
        else:
            duracao_segundos = max(0, (agora - c.data_abertura.replace(tzinfo=timezone.utc)).total_seconds())

        horas = int(duracao_segundos // 3600)
        minutos = int((duracao_segundos % 3600) // 60)

        total_vendas = getattr(resumo, "quantidade_vendas", 0) or len(c.vendas or [])

        operando.append({
            "caixa_id": c.id,
            "usuario_id": c.usuario_id,
            "usuario_nome": c.usuario.nome if c.usuario else "",
            "data_abertura": c.data_abertura,
            "tempo_aberto_formatado": f"{horas}h {minutos:02d}m",
            "saldo_dinheiro": float(saldo_dinheiro),
            "limite_gaveta": float(limite),
            "alerta_limite_excedido": alerta_limite,
            "total_vendas": total_vendas
        })

    return {
        "total_operando": len(caixas_abertos),
        "total_pendentes_aprovacao": len(caixas_pendentes_fechamento),
        "caixas_disponiveis_estimados": max(0, total_usuarios_caixa - len(caixas_abertos)),
        "caixas_operando": operando
    }

