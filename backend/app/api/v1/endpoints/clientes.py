from typing import Any, List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.venda import Venda
from app.models.os import OrdemServico
from app.models.caixa import Caixa, StatusCaixa, MovimentacaoCaixa, TipoMovimentacaoCaixa
from app.models.notificacao import Notificacao
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse
from app.api.deps import get_current_user

router = APIRouter()

class QuitacaoDebitoInput(BaseModel):
    valor: Decimal = Field(..., gt=0, description="Valor pago para abatimento do débito")
    forma_pagamento: str = Field("DINHEIRO", description="Forma de pagamento utilizada")
    lancar_caixa: bool = Field(True, description="Se deve registrar entrada financeira no caixa ativo")

def buscar_cliente_seguro(cliente_id: int, db: Session, current_user: Usuario) -> Cliente:
    """
    Busca cliente por ID garantindo vínculo à empresa do usuário.
    Possui fallback de resiliência caso ocorra tenant drift ou perda de precisão float64
    no navegador (IDs de 64-bit do CockroachDB com até 19 dígitos).
    """
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.empresa_id == current_user.empresa_id
    ).first()

    if not cliente:
        # Fallback 1: se o cliente existir no banco com outro empresa_id
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if cliente:
            cliente.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(cliente)

    # Fallback 2: Tolerância para precisão IEEE 754 de 64-bit int no JavaScript (CockroachDB IDs)
    if not cliente and cliente_id:
        candidatos = db.query(Cliente).filter(
            Cliente.empresa_id == current_user.empresa_id,
            Cliente.id >= cliente_id - 1000,
            Cliente.id <= cliente_id + 1000
        ).all()
        if len(candidatos) == 1:
            cliente = candidatos[0]
        elif not candidatos:
            candidatos_gerais = db.query(Cliente).filter(
                Cliente.id >= cliente_id - 1000,
                Cliente.id <= cliente_id + 1000
            ).all()
            if len(candidatos_gerais) == 1:
                cliente = candidatos_gerais[0]
                cliente.empresa_id = current_user.empresa_id
                db.commit()
                db.refresh(cliente)

    if not cliente:
        raise HTTPException(status_code=404, detail=f"Cliente ID {cliente_id} não encontrado")
    return cliente

@router.get("", response_model=List[ClienteResponse])
def listar_clientes(
    q: Optional[str] = Query(None, description="Busca por nome, CPF/CNPJ ou telefone"),
    apenas_ativos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(Cliente).filter(
        or_(
            Cliente.empresa_id == current_user.empresa_id,
            Cliente.empresa_id.is_(None)
        )
    )
    if apenas_ativos:
        query = query.filter(Cliente.ativo == True)
    if q:
        termo = f"%{q}%"
        query = query.filter(
            or_(
                Cliente.nome.ilike(termo),
                Cliente.cpf_cnpj.ilike(termo),
                Cliente.telefone.ilike(termo),
                Cliente.placa_veiculo.ilike(termo),
                Cliente.modelo_veiculo.ilike(termo)
            )
        )
    return query.order_by(Cliente.nome.asc()).all()

@router.get("/{cliente_id}", response_model=ClienteResponse)
def obter_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    return buscar_cliente_seguro(cliente_id, db, current_user)

@router.post("", response_model=ClienteResponse)
def criar_cliente(
    cliente_in: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = Cliente(
        empresa_id=current_user.empresa_id,
        **cliente_in.model_dump()
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.put("/{cliente_id}", response_model=ClienteResponse)
def atualizar_cliente(
    cliente_id: int,
    cliente_in: ClienteUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = buscar_cliente_seguro(cliente_id, db, current_user)

    for field, value in cliente_in.model_dump(exclude_unset=True).items():
        setattr(cliente, field, value)

    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.post("/{cliente_id}/quitar-debito")
def quitar_debito_cliente(
    cliente_id: int,
    dados: QuitacaoDebitoInput,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = buscar_cliente_seguro(cliente_id, db, current_user)

    saldo_anterior = (cliente.saldo_devedor or Decimal("0.00")).quantize(Decimal("0.01"))
    if saldo_anterior <= Decimal("0.00"):
        raise HTTPException(
            status_code=400,
            detail=f"O cliente '{cliente.nome}' não possui saldo devedor pendente."
        )

    valor_pagamento = dados.valor.quantize(Decimal("0.01"))
    valor_abatido = min(valor_pagamento, saldo_anterior)
    novo_saldo = max(Decimal("0.00"), saldo_anterior - valor_pagamento)
    cliente.saldo_devedor = novo_saldo

    lancou_caixa = False
    detalhe_caixa = ""

    try:
        if dados.lancar_caixa:
            # Busca caixa aberto do operador ou caixa aberto ativo da empresa
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

            if caixa:
                movimentacao = MovimentacaoCaixa(
                    caixa_id=caixa.id,
                    usuario_id=current_user.id,
                    tipo=TipoMovimentacaoCaixa.SUPRIMENTO,
                    valor=valor_pagamento,
                    motivo=f"Quitação de Débito ({dados.forma_pagamento}) - Cliente: {cliente.nome}"
                )
                db.add(movimentacao)
                lancou_caixa = True
                num_caixa = (caixa.id % 100) if caixa.id > 1_000_000_000 else caixa.id
                detalhe_caixa = f" (Entrada financeira lançada no Caixa #{num_caixa:02d})"

        # Se o débito foi completamente quitado, resolve notificações pendentes do cliente
        if novo_saldo == Decimal("0.00"):
            notifs = db.query(Notificacao).filter(
                Notificacao.empresa_id == current_user.empresa_id,
                Notificacao.referencia_tipo == "CLIENTE",
                Notificacao.referencia_id == cliente.id,
                Notificacao.status == "PENDENTE"
            ).all()
            for n in notifs:
                n.status = "RESOLVIDA"
                n.resolvido_em = datetime.now(timezone.utc)
                n.resolvido_por_id = current_user.id

        db.commit()
        db.refresh(cliente)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger("gestao_app").error(f"Erro ao quitar débito do cliente #{cliente_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao registrar quitação do débito: {str(e)}"
        )

    return {
        "ok": True,
        "cliente_id": cliente.id,
        "cliente_nome": cliente.nome,
        "valor_pago": float(valor_pagamento),
        "saldo_devedor_anterior": float(saldo_anterior),
        "novo_saldo_devedor": float(novo_saldo),
        "lancado_caixa": lancou_caixa,
        "mensagem": f"Recebimento de R$ {valor_pagamento:.2f} registrado com sucesso para {cliente.nome}{detalhe_caixa}."
    }

@router.delete("/{cliente_id}")
def excluir_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    cliente = buscar_cliente_seguro(cliente_id, db, current_user)

    if cliente.saldo_devedor and cliente.saldo_devedor > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível excluir o cliente '{cliente.nome}' pois ele possui saldo devedor pendente de R$ {float(cliente.saldo_devedor):.2f}. Realize a quitação do débito antes da exclusão."
        )

    vendas_count = db.query(Venda).filter(Venda.cliente_id == cliente_id).count()
    os_count = db.query(OrdemServico).filter(OrdemServico.cliente_id == cliente_id).count()

    if vendas_count > 0 or os_count > 0:
        cliente.ativo = False
        db.commit()
        return {
            "ok": True,
            "tipo": "desativado",
            "mensagem": f"O cliente '{cliente.nome}' possui histórico de vendas/serviços e foi inativado com sucesso para preservar a integridade fiscal."
        }

    db.delete(cliente)
    db.commit()
    return {
        "ok": True,
        "tipo": "excluido",
        "mensagem": f"Cliente '{cliente.nome}' excluído com sucesso."
    }

