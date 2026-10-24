from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.caixa import Caixa, StatusCaixa
from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.estoque import MovimentacaoEstoque, TipoMovimentacaoEstoque
from app.models.venda import Venda, ItemVenda, PagamentoVenda, StatusVenda, FormaPagamento
from app.schemas.venda import VendaCreate, VendaResponse
from app.api.deps import get_current_user

router = APIRouter()

def formatar_venda(venda: Venda) -> dict:
    return {
        "id": venda.id,
        "empresa_id": venda.empresa_id,
        "caixa_id": venda.caixa_id,
        "cliente_id": venda.cliente_id,
        "cliente_nome": venda.cliente.nome if venda.cliente else "Consumidor Final",
        "usuario_id": venda.usuario_id,
        "usuario_nome": venda.usuario.nome if venda.usuario else "",
        "valor_bruto": venda.valor_bruto,
        "desconto": venda.desconto,
        "acrescimo": venda.acrescimo,
        "valor_liquido": venda.valor_liquido,
        "status": venda.status,
        "observacoes": venda.observacoes,
        "created_at": venda.created_at,
        "itens": [
            {
                "id": it.id,
                "produto_id": it.produto_id,
                "produto_nome": it.produto.nome if it.produto else "",
                "quantidade": it.quantidade,
                "valor_unitario": it.valor_unitario,
                "subtotal": it.subtotal
            }
            for it in venda.itens
        ],
        "pagamentos": [
            {
                "id": pg.id,
                "forma_pagamento": pg.forma_pagamento,
                "valor": pg.valor,
                "troco": pg.troco
            }
            for pg in venda.pagamentos
        ]
    }

@router.get("", response_model=List[VendaResponse])
def listar_vendas(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[StatusVenda] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(Venda).filter(Venda.empresa_id == current_user.empresa_id)
    if status:
        query = query.filter(Venda.status == status)
    vendas = query.order_by(Venda.created_at.desc()).limit(limit).all()
    return [formatar_venda(v) for v in vendas]

@router.get("/{venda_id}", response_model=VendaResponse)
def obter_venda(
    venda_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    venda = db.query(Venda).filter(
        Venda.id == venda_id,
        Venda.empresa_id == current_user.empresa_id
    ).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return formatar_venda(venda)

@router.post("", response_model=VendaResponse)
def registrar_venda(
    dados: VendaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    # 1. Valida se o caixa existe e está aberto
    caixa = db.query(Caixa).filter(
        Caixa.id == dados.caixa_id,
        Caixa.empresa_id == current_user.empresa_id
    ).first()
    if not caixa or caixa.status != StatusCaixa.ABERTO:
        raise HTTPException(status_code=400, detail="O caixa informado não está aberto ou não existe.")

    # 2. Valida itens
    if not dados.itens:
        raise HTTPException(status_code=400, detail="A venda deve conter ao menos um item.")

    valor_bruto = Decimal("0.00")
    itens_processados = []

    for item_in in dados.itens:
        produto = db.query(Produto).filter(
            Produto.id == item_in.produto_id,
            Produto.empresa_id == current_user.empresa_id
        ).first()
        if not produto:
            raise HTTPException(status_code=404, detail=f"Produto ID {item_in.produto_id} não encontrado.")
        if not produto.ativo:
            raise HTTPException(status_code=400, detail=f"Produto '{produto.nome}' está inativo.")

        subtotal = item_in.quantidade * item_in.valor_unitario
        valor_bruto += subtotal

        # Dá baixa no estoque
        if produto.estoque_atual < item_in.quantidade:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para '{produto.nome}'. Disponível: {produto.estoque_atual} {produto.unidade}")
        produto.estoque_atual -= item_in.quantidade

        # Registra movimentação de estoque
        mov = MovimentacaoEstoque(
            empresa_id=current_user.empresa_id,
            produto_id=produto.id,
            usuario_id=current_user.id,
            tipo=TipoMovimentacaoEstoque.VENDA,
            quantidade=item_in.quantidade,
            motivo="Venda no PDV"
        )
        db.add(mov)

        itens_processados.append(
            ItemVenda(
                produto_id=produto.id,
                quantidade=item_in.quantidade,
                valor_unitario=item_in.valor_unitario,
                subtotal=subtotal
            )
        )

    valor_liquido = valor_bruto - dados.desconto + dados.acrescimo
    if valor_liquido < 0:
        raise HTTPException(status_code=400, detail="O valor total líquido não pode ser negativo.")

    # 3. Valida pagamentos
    if not dados.pagamentos:
        raise HTTPException(status_code=400, detail="Informe ao menos uma forma de pagamento.")

    total_pago = sum([p.valor for p in dados.pagamentos], Decimal("0.00"))
    if total_pago < valor_liquido:
        raise HTTPException(status_code=400, detail=f"Valor pago (R$ {total_pago}) é menor que o total da venda (R$ {valor_liquido}).")

    # Verifica se há pagamento a prazo e checa limite de crédito do cliente
    cliente = None
    if dados.cliente_id:
        cliente = db.query(Cliente).filter(
            Cliente.id == dados.cliente_id,
            Cliente.empresa_id == current_user.empresa_id
        ).first()

    pagamentos_processados = []
    for pg in dados.pagamentos:
        if pg.forma_pagamento == FormaPagamento.A_PRAZO:
            if not cliente:
                raise HTTPException(status_code=400, detail="Vendas a prazo necessitam de um cliente cadastrado selecionado.")
            novo_saldo = cliente.saldo_devedor + pg.valor
            if cliente.limite_credito > 0 and novo_saldo > cliente.limite_credito:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Limite de crédito excedido para {cliente.nome}. Limite: R$ {cliente.limite_credito}, Atual devedor: R$ {cliente.saldo_devedor}, Tentativa: R$ {pg.valor}."
                )
            cliente.saldo_devedor = novo_saldo

        pagamentos_processados.append(
            PagamentoVenda(
                forma_pagamento=pg.forma_pagamento,
                valor=pg.valor,
                troco=pg.troco
            )
        )

    # 4. Cria e persiste a venda
    nova_venda = Venda(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        cliente_id=dados.cliente_id,
        usuario_id=current_user.id,
        valor_bruto=valor_bruto,
        desconto=dados.desconto,
        acrescimo=dados.acrescimo,
        valor_liquido=valor_liquido,
        status=StatusVenda.CONCLUIDA,
        observacoes=dados.observacoes,
        itens=itens_processados,
        pagamentos=pagamentos_processados
    )

    db.add(nova_venda)
    db.commit()
    db.refresh(nova_venda)

    return formatar_venda(nova_venda)

@router.post("/{venda_id}/cancelar", response_model=VendaResponse)
def cancelar_venda(
    venda_id: int,
    motivo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    venda = db.query(Venda).filter(
        Venda.id == venda_id,
        Venda.empresa_id == current_user.empresa_id
    ).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    if venda.status == StatusVenda.CANCELADA:
        raise HTTPException(status_code=400, detail="Esta venda já está cancelada")

    # Devolve itens ao estoque
    for it in venda.itens:
        produto = db.query(Produto).filter(Produto.id == it.produto_id).first()
        if produto:
            produto.estoque_atual += it.quantidade
            mov = MovimentacaoEstoque(
                empresa_id=current_user.empresa_id,
                produto_id=produto.id,
                usuario_id=current_user.id,
                tipo=TipoMovimentacaoEstoque.ENTRADA,
                quantidade=it.quantidade,
                motivo=f"Estorno por cancelamento da venda #{venda.id}"
            )
            db.add(mov)

    # Estorna crédito se teve a prazo
    if venda.cliente_id:
        for pg in venda.pagamentos:
            if pg.forma_pagamento == FormaPagamento.A_PRAZO and venda.cliente:
                venda.cliente.saldo_devedor = max(Decimal("0.00"), venda.cliente.saldo_devedor - pg.valor)

    venda.status = StatusVenda.CANCELADA
    if motivo:
        venda.observacoes = (venda.observacoes or "") + f"\nCancelamento: {motivo}"

    db.add(venda)
    db.commit()
    db.refresh(venda)

    return formatar_venda(venda)

