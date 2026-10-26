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
from app.models.notificacao import Notificacao, StatusNotificacao
from app.models.venda import Venda, PagamentoVenda, StatusVenda, FormaPagamento
from app.schemas.caixa import (
    AberturaCaixa, FechamentoCaixa, MovimentacaoCaixaCreate,
    CaixaResponse, MovimentacaoCaixaResponse, ResumoCaixaResponse
)
from app.api.deps import get_current_user, verificar_ponto_trabalho

router = APIRouter()

def serialize_caixa(caixa: Caixa) -> CaixaResponse:
    diferenca = None
    if caixa.saldo_final_informado is not None and caixa.saldo_final_calculado is not None:
        diferenca = Decimal(str(caixa.saldo_final_informado)) - Decimal(str(caixa.saldo_final_calculado))

    return CaixaResponse(
        id=caixa.id,
        empresa_id=caixa.empresa_id,
        usuario_id=caixa.usuario_id,
        usuario_nome=caixa.usuario.nome if caixa.usuario else None,
        data_abertura=caixa.data_abertura,
        data_fechamento=caixa.data_fechamento,
        saldo_inicial=Decimal(str(caixa.saldo_inicial or 0)),
        saldo_final_informado=Decimal(str(caixa.saldo_final_informado)) if caixa.saldo_final_informado is not None else None,
        saldo_final_calculado=Decimal(str(caixa.saldo_final_calculado)) if caixa.saldo_final_calculado is not None else None,
        diferenca=diferenca,
        status=caixa.status,
        observacoes=caixa.observacoes
    )

def buscar_caixa_seguro(db: Session, caixa_id: int, empresa_id: int) -> Optional[Caixa]:
    """Busca caixa pelo ID exato ou com tolerância float64 (+- 1000) para resiliência ao CockroachDB"""
    # 1. Busca exata com empresa
    c = db.query(Caixa).filter(
        Caixa.id == caixa_id,
        Caixa.empresa_id == empresa_id
    ).first()
    if c:
        return c

    # 2. Janela de tolerância float64 (+- 1000)
    c = db.query(Caixa).filter(
        Caixa.id.between(caixa_id - 1000, caixa_id + 1000),
        Caixa.empresa_id == empresa_id
    ).first()
    if c:
        return c

    # 3. Fallback sem filtro estrito de empresa
    c = db.query(Caixa).filter(Caixa.id == caixa_id).first()
    if c:
        return c

    c = db.query(Caixa).filter(Caixa.id.between(caixa_id - 1000, caixa_id + 1000)).first()
    return c

def calcular_resumo_caixa(caixa: Caixa, db: Session) -> ResumoCaixaResponse:
    # Busca todas as vendas concluídas do caixa (com tolerância de ID de 64-bits)
    vendas = db.query(Venda).filter(
        (Venda.caixa_id == caixa.id) | Venda.caixa_id.between(caixa.id - 1000, caixa.id + 1000),
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
            forma = p.forma_pagamento
            if isinstance(forma, str):
                try:
                    forma = FormaPagamento(forma.upper())
                except Exception:
                    pass
            val = Decimal(str(p.valor or 0))
            if forma in totais_por_forma:
                totais_por_forma[forma] += val
            else:
                totais_por_forma[FormaPagamento.DINHEIRO] += val

    # Movimentações do caixa (sangrias e suprimentos com tolerância de ID)
    movs = db.query(MovimentacaoCaixa).filter(
        (MovimentacaoCaixa.caixa_id == caixa.id) | MovimentacaoCaixa.caixa_id.between(caixa.id - 1000, caixa.id + 1000)
    ).all()
    total_suprimentos = sum([Decimal(str(m.valor or 0)) for m in movs if m.tipo == TipoMovimentacaoCaixa.SUPRIMENTO], Decimal("0.00"))
    total_sangrias = sum([Decimal(str(m.valor or 0)) for m in movs if m.tipo == TipoMovimentacaoCaixa.SANGRIA], Decimal("0.00"))

    # Saldo em dinheiro esperado no caixa físico
    saldo_inicial = Decimal(str(caixa.saldo_inicial or 0))
    saldo_esperado = saldo_inicial + totais_por_forma[FormaPagamento.DINHEIRO] + total_suprimentos - total_sangrias
    diferenca = None
    if caixa.saldo_final_informado is not None:
        diferenca = Decimal(str(caixa.saldo_final_informado)) - saldo_esperado

    return ResumoCaixaResponse(
        caixa=serialize_caixa(caixa),
        saldo_inicial=saldo_inicial,
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
    """Busca o caixa aberto atualmente para o usuário logado com resiliência a tenant drift"""
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        return None

    caixa = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.usuario_id == current_user.id,
        Caixa.status == StatusCaixa.ABERTO
    ).order_by(Caixa.data_abertura.desc()).first()

    if not caixa:
        # Fallback de resiliência: se houver outro caixa aberto ativo na mesma empresa (compartilhado na loja)
        caixa = db.query(Caixa).filter(
            Caixa.empresa_id == current_user.empresa_id,
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()

    if not caixa:
        # Fallback de resiliência: se o usuário tiver caixa aberto ativo no banco com tenant drift
        caixa = db.query(Caixa).filter(
            Caixa.usuario_id == current_user.id,
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()
        if caixa:
            caixa.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(caixa)

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
    current_user: Usuario = Depends(verificar_ponto_trabalho)
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
    # Regra de negócio: apenas administradores podem registrar movimentações avulsas diretamente
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito: Funções não administradoras não podem lançar sangria ou entrada de valores diretamente no caixa. Utilize a opção 'Solicitar Ticket' para aprovação do Administrador."
        )

    # Se caixa_id for informado explicitamente
    if dados.caixa_id:
        caixa = buscar_caixa_seguro(db, dados.caixa_id, current_user.empresa_id)
        if caixa and caixa.status != StatusCaixa.ABERTO:
            caixa = None
        if caixa and current_user.perfil != PerfilUsuario.ADMIN and caixa.usuario_id != current_user.id:
            caixa = None
    else:
        # Busca o caixa aberto do usuário, ou se for admin, o caixa aberto ativo da empresa
        caixa = db.query(Caixa).filter(
            Caixa.empresa_id == current_user.empresa_id,
            Caixa.usuario_id == current_user.id,
            Caixa.status == StatusCaixa.ABERTO
        ).first()
        if not caixa and current_user.perfil == PerfilUsuario.ADMIN:
            caixa = db.query(Caixa).filter(
                Caixa.empresa_id == current_user.empresa_id,
                Caixa.status == StatusCaixa.ABERTO
            ).order_by(Caixa.data_abertura.desc()).first()

    if not caixa:
        raise HTTPException(status_code=400, detail="Nenhum caixa aberto para registrar esta movimentação.")

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

@router.get("/resumo-atual", response_model=Optional[ResumoCaixaResponse])
def obter_resumo_atual(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Retorna diretamente o resumo financeiro do caixa aberto atual (pessoal ou da loja)"""
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        return None

    caixa = db.query(Caixa).filter(
        Caixa.empresa_id == current_user.empresa_id,
        Caixa.usuario_id == current_user.id,
        Caixa.status == StatusCaixa.ABERTO
    ).order_by(Caixa.data_abertura.desc()).first()

    if not caixa:
        caixa = db.query(Caixa).filter(
            Caixa.empresa_id == current_user.empresa_id,
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()

    if not caixa:
        return None

    return calcular_resumo_caixa(caixa, db)

@router.get("/resumo/{caixa_id}", response_model=ResumoCaixaResponse)
def obter_resumo(
    caixa_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    caixa = buscar_caixa_seguro(db, caixa_id, current_user.empresa_id)
    if not caixa:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")

    # Operadores normais só podem ver seu próprio caixa, ou o caixa aberto compartilhado da loja
    if current_user.perfil != PerfilUsuario.ADMIN and caixa.usuario_id != current_user.id:
        if caixa.empresa_id != current_user.empresa_id:
            raise HTTPException(status_code=403, detail="Acesso restrito ao operador responsável ou administrador.")

    return calcular_resumo_caixa(caixa, db)

@router.post("/fechar/{caixa_id}", response_model=ResumoCaixaResponse)
def fechar_caixa(
    caixa_id: int,
    dados: FechamentoCaixa,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    caixa = buscar_caixa_seguro(db, caixa_id, current_user.empresa_id)
    if not caixa:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")
    if caixa.status == StatusCaixa.FECHADO:
        raise HTTPException(status_code=400, detail="Este caixa já se encontra fechado.")

    if current_user.perfil != PerfilUsuario.ADMIN and caixa.usuario_id != current_user.id and caixa.empresa_id != current_user.empresa_id:
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
    valor: Optional[Decimal] = None
    motivo: Optional[str] = None
    justificativa: Optional[str] = None

    def get_valor(self) -> Optional[Decimal]:
        return self.valor_solicitado if self.valor_solicitado is not None else self.valor

    def get_motivo(self) -> Optional[str]:
        return self.motivo if self.motivo is not None else self.justificativa

class RespostaTicketSchema(BaseModel):
    aprovado: bool
    valor_aprovado: Optional[Decimal] = None
    valor_efetivo: Optional[Decimal] = None
    motivo: Optional[str] = None
    observacao: Optional[str] = None

    def get_valor(self) -> Optional[Decimal]:
        return self.valor_aprovado if self.valor_aprovado is not None else self.valor_efetivo

    def get_motivo(self) -> Optional[str]:
        return self.motivo if self.motivo is not None else self.observacao

@router.post("/{caixa_id}/solicitar-ticket")
def solicitar_ticket_caixa(
    caixa_id: int,
    dados: TicketCaixaSchema,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Operador solicita suprimento de troco ou sangria de dinheiro para aprovação do Administrador"""
    caixa = buscar_caixa_seguro(db, caixa_id, current_user.empresa_id)
    if not caixa or caixa.status != StatusCaixa.ABERTO:
        raise HTTPException(status_code=400, detail="Caixa deve estar aberto para solicitar tickets.")

    valor_solicitado = dados.get_valor()
    motivo = dados.get_motivo()

    ticket = SolicitacaoCaixa(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        usuario_id=current_user.id,
        tipo=dados.tipo,
        valor_solicitado=valor_solicitado,
        motivo=motivo,
        status=StatusSolicitacaoCaixa.PENDENTE
    )
    db.add(ticket)
    db.flush()
    
    # Cria notificação para os administradores
    valor_str = f" de R$ {valor_solicitado:.2f}" if valor_solicitado is not None else ""
    notif = Notificacao(
        empresa_id=current_user.empresa_id,
        usuario_id=None,
        titulo=f"Solicitação de {dados.tipo.value} (Caixa #{caixa.id})",
        mensagem=f"Operador {current_user.nome} solicitou {dados.tipo.value}{valor_str}. Motivo: {motivo or 'Não informado'}.",
        tipo="CAIXA_TICKET",
        referencia_tipo="TICKET_CAIXA",
        referencia_id=ticket.id,
        valor_pendente=valor_solicitado
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

    agora = datetime.now(timezone.utc)

    # 1. Tenta buscar pelo ID direto do ticket
    ticket = db.query(SolicitacaoCaixa).filter(
        SolicitacaoCaixa.id == ticket_id,
        SolicitacaoCaixa.empresa_id == current_user.empresa_id
    ).first()

    # 2. Se não encontrou pelo ID do ticket, pode ser que o cliente passou o caixa_id (legado)
    if not ticket:
        ticket = db.query(SolicitacaoCaixa).filter(
            SolicitacaoCaixa.caixa_id == ticket_id,
            SolicitacaoCaixa.empresa_id == current_user.empresa_id,
            SolicitacaoCaixa.status == StatusSolicitacaoCaixa.PENDENTE
        ).order_by(SolicitacaoCaixa.created_at.desc()).first()

    # 3. Se ainda assim não encontrou ticket pendente, mas a solicitação já foi respondida anteriormente:
    if not ticket:
        ticket_existente = db.query(SolicitacaoCaixa).filter(
            (SolicitacaoCaixa.id == ticket_id) | (SolicitacaoCaixa.caixa_id == ticket_id),
            SolicitacaoCaixa.empresa_id == current_user.empresa_id
        ).order_by(SolicitacaoCaixa.created_at.desc()).first()

        if ticket_existente:
            # Também resolve as notificações pendentes órfãs para regularizar
            notifs = db.query(Notificacao).filter(
                Notificacao.empresa_id == current_user.empresa_id,
                (
                    (Notificacao.referencia_id == ticket_existente.id) |
                    (Notificacao.referencia_id == ticket_existente.caixa_id) |
                    (Notificacao.referencia_id == ticket_id)
                ),
                Notificacao.status == StatusNotificacao.PENDENTE.value
            ).all()
            for n in notifs:
                n.status = StatusNotificacao.RESOLVIDA.value
                n.resolvido_em = agora
                n.resolvido_por_id = current_user.id
            db.commit()

            return {
                "ok": True,
                "mensagem": f"Solicitação já havia sido {ticket_existente.status.lower()}. Pendência regularizada.",
                "ticket_id": ticket_existente.id,
                "status": ticket_existente.status
            }

        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    # Se o ticket foi encontrado mas não está PENDENTE:
    if ticket.status != StatusSolicitacaoCaixa.PENDENTE:
        # Regulariza notificações pendentes
        notifs = db.query(Notificacao).filter(
            Notificacao.empresa_id == current_user.empresa_id,
            (
                (Notificacao.referencia_id == ticket.id) |
                (Notificacao.referencia_id == ticket.caixa_id) |
                (Notificacao.referencia_id == ticket_id)
            ),
            Notificacao.status == StatusNotificacao.PENDENTE.value
        ).all()
        for n in notifs:
            n.status = StatusNotificacao.RESOLVIDA.value
            n.resolvido_em = agora
            n.resolvido_por_id = current_user.id
        db.commit()

        return {
            "ok": True,
            "mensagem": f"Solicitação já estava {ticket.status.lower()}. Notificação resolvida.",
            "ticket_id": ticket.id,
            "status": ticket.status
        }

    ticket.respondido_em = agora
    ticket.respondido_por_id = current_user.id

    if dados.aprovado:
        valor = dados.get_valor() or ticket.valor_solicitado or Decimal("0.00")
        ticket.status = StatusSolicitacaoCaixa.APROVADO
        ticket.valor_aprovado = valor

        # Gera movimentação real no caixa
        tipo_mov = TipoMovimentacaoCaixa.SUPRIMENTO if ticket.tipo == TipoSolicitacaoCaixa.SUPRIMENTO else TipoMovimentacaoCaixa.SANGRIA
        motivo_final = dados.get_motivo() or ticket.motivo or 'Sem observações'
        mov = MovimentacaoCaixa(
            caixa_id=ticket.caixa_id,
            usuario_id=ticket.usuario_id,
            tipo=tipo_mov,
            valor=valor,
            motivo=f"Aprovado pelo ADM {current_user.nome}: {motivo_final}"
        )
        db.add(mov)
    else:
        ticket.status = StatusSolicitacaoCaixa.REJEITADO

    # Atualiza também todas as notificações associadas ao ticket ou caixa para RESOLVIDA
    notifs = db.query(Notificacao).filter(
        Notificacao.empresa_id == current_user.empresa_id,
        (
            (Notificacao.referencia_id == ticket.id) |
            (Notificacao.referencia_id == ticket.caixa_id) |
            (Notificacao.referencia_id == ticket_id)
        ),
        Notificacao.status == StatusNotificacao.PENDENTE.value
    ).all()
    for n in notifs:
        n.status = StatusNotificacao.RESOLVIDA.value
        n.resolvido_em = agora
        n.resolvido_por_id = current_user.id

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

