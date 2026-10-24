from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.caixa import Caixa, StatusCaixa
from app.models.venda import Venda, ItemVenda, PagamentoVenda, StatusVenda, FormaPagamento
from app.models.estoque import MovimentacaoEstoque, TipoMovimentacaoEstoque
from app.models.os import OrdemServico, ItemOS, StatusOS
from app.schemas.os import OSCreate, OSUpdate, OSResponse, OSFaturarRequest, OSFaturarResponse
from app.api.deps import get_current_user

router = APIRouter()

def formatar_os(os: OrdemServico) -> dict:
    return {
        "id": os.id,
        "empresa_id": os.empresa_id,
        "cliente_id": os.cliente_id,
        "cliente_nome": os.cliente.nome if os.cliente else "",
        "cliente_telefone": os.cliente.telefone if os.cliente else "",
        "usuario_id": os.usuario_id,
        "usuario_nome": os.usuario.nome if os.usuario else "",
        "titulo": os.titulo,
        "equipamento": os.equipamento,
        "defeito_relatado": os.defeito_relatado,
        "laudo_tecnico": os.laudo_tecnico,
        "status": os.status,
        "valor_servicos": os.valor_servicos,
        "valor_pecas": os.valor_pecas,
        "valor_total": os.valor_total,
        "previsao_entrega": os.previsao_entrega,
        "data_finalizacao": os.data_finalizacao,
        "created_at": os.created_at,
        "updated_at": os.updated_at,
        "itens": [
            {
                "id": it.id,
                "produto_id": it.produto_id,
                "produto_nome": it.produto.nome if it.produto else "",
                "quantidade": it.quantidade,
                "valor_unitario": it.valor_unitario,
                "subtotal": it.subtotal
            }
            for it in os.itens
        ]
    }

@router.get("", response_model=List[OSResponse])
def listar_os(
    status: Optional[StatusOS] = None,
    cliente_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    query = db.query(OrdemServico).filter(OrdemServico.empresa_id == current_user.empresa_id)
    if status:
        query = query.filter(OrdemServico.status == status)
    if cliente_id:
        query = query.filter(OrdemServico.cliente_id == cliente_id)
    ordens = query.order_by(OrdemServico.created_at.desc()).all()
    return [formatar_os(o) for o in ordens]

@router.get("/{os_id}", response_model=OSResponse)
def obter_os(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    os = db.query(OrdemServico).filter(
        OrdemServico.id == os_id,
        OrdemServico.empresa_id == current_user.empresa_id
    ).first()
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return formatar_os(os)

@router.post("", response_model=OSResponse)
def criar_os(
    dados: OSCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        raise HTTPException(
            status_code=403,
            detail="Operação não permitida. O Controlador de Estoque não possui autorização para abrir Ordens de Serviço."
        )

    cliente = db.query(Cliente).filter(
        Cliente.id == dados.cliente_id,
        Cliente.empresa_id == current_user.empresa_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    valor_pecas = Decimal("0.00")
    itens_processados = []

    for item_in in dados.itens:
        produto = db.query(Produto).filter(
            Produto.id == item_in.produto_id,
            Produto.empresa_id == current_user.empresa_id
        ).first()
        if not produto:
            raise HTTPException(status_code=404, detail=f"Peça/Produto ID {item_in.produto_id} não encontrado")

        subtotal = item_in.quantidade * item_in.valor_unitario
        valor_pecas += subtotal

        # Baixa do estoque
        produto.estoque_atual -= item_in.quantidade
        mov = MovimentacaoEstoque(
            empresa_id=current_user.empresa_id,
            produto_id=produto.id,
            usuario_id=current_user.id,
            tipo=TipoMovimentacaoEstoque.OS,
            quantidade=item_in.quantidade,
            motivo=f"Peça utilizada em OS inicial"
        )
        db.add(mov)

        itens_processados.append(
            ItemOS(
                produto_id=produto.id,
                quantidade=item_in.quantidade,
                valor_unitario=item_in.valor_unitario,
                subtotal=subtotal
            )
        )

    valor_total = dados.valor_servicos + valor_pecas

    nova_os = OrdemServico(
        empresa_id=current_user.empresa_id,
        cliente_id=cliente.id,
        usuario_id=current_user.id,
        titulo=dados.titulo,
        equipamento=dados.equipamento,
        defeito_relatado=dados.defeito_relatado,
        laudo_tecnico=dados.laudo_tecnico,
        status=StatusOS.ABERTA,
        valor_servicos=dados.valor_servicos,
        valor_pecas=valor_pecas,
        valor_total=valor_total,
        previsao_entrega=dados.previsao_entrega,
        itens=itens_processados
    )

    db.add(nova_os)
    db.commit()
    db.refresh(nova_os)

    return formatar_os(nova_os)

@router.put("/{os_id}", response_model=OSResponse)
def atualizar_os(
    os_id: int,
    dados: OSUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    os = db.query(OrdemServico).filter(
        OrdemServico.id == os_id,
        OrdemServico.empresa_id == current_user.empresa_id
    ).first()
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")

    update_dict = dados.model_dump(exclude_unset=True)

    if "status" in update_dict and update_dict["status"]:
        novo_status = update_dict["status"]
        if novo_status in [StatusOS.CONCLUIDA, StatusOS.ENTREGUE] and not os.data_finalizacao:
            os.data_finalizacao = datetime.now(timezone.utc)
        os.status = novo_status

    if "titulo" in update_dict:
        os.titulo = update_dict["titulo"]
    if "equipamento" in update_dict:
        os.equipamento = update_dict["equipamento"]
    if "defeito_relatado" in update_dict:
        os.defeito_relatado = update_dict["defeito_relatado"]
    if "laudo_tecnico" in update_dict:
        os.laudo_tecnico = update_dict["laudo_tecnico"]
    if "previsao_entrega" in update_dict:
        os.previsao_entrega = update_dict["previsao_entrega"]

    if "valor_servicos" in update_dict and update_dict["valor_servicos"] is not None:
        os.valor_servicos = update_dict["valor_servicos"]

    # Se novas peças forem adicionadas
    if dados.itens is not None:
        # Remove peças antigas e estorna
        for it in os.itens:
            prod = db.query(Produto).filter(Produto.id == it.produto_id).first()
            if prod:
                prod.estoque_atual += it.quantidade
            db.delete(it)

        valor_pecas = Decimal("0.00")
        novos_itens = []
        for item_in in dados.itens:
            produto = db.query(Produto).filter(
                Produto.id == item_in.produto_id,
                Produto.empresa_id == current_user.empresa_id
            ).first()
            if not produto:
                raise HTTPException(status_code=404, detail=f"Peça ID {item_in.produto_id} não encontrada")

            subtotal = item_in.quantidade * item_in.valor_unitario
            valor_pecas += subtotal
            produto.estoque_atual -= item_in.quantidade

            novos_itens.append(
                ItemOS(
                    os_id=os.id,
                    produto_id=produto.id,
                    quantidade=item_in.quantidade,
                    valor_unitario=item_in.valor_unitario,
                    subtotal=subtotal
                )
            )
        os.valor_pecas = valor_pecas
        os.itens = novos_itens

    os.valor_total = os.valor_servicos + os.valor_pecas
    os.updated_at = datetime.now(timezone.utc)

    db.add(os)
    db.commit()
    db.refresh(os)

    return formatar_os(os)

@router.post("/{os_id}/faturar", response_model=OSFaturarResponse)
def faturar_os(
    os_id: int,
    dados: OSFaturarRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        raise HTTPException(
            status_code=403,
            detail="Operação não permitida. O Controlador de Estoque não realiza faturamento de Ordens de Serviço."
        )

    # 1. Busca a OS
    os = db.query(OrdemServico).filter(
        OrdemServico.id == os_id,
        OrdemServico.empresa_id == current_user.empresa_id
    ).first()
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    if os.status == StatusOS.ENTREGUE:
        raise HTTPException(status_code=400, detail="Esta ordem de serviço já foi faturada e entregue.")

    # 2. Valida o Caixa
    caixa = db.query(Caixa).filter(
        Caixa.id == dados.caixa_id,
        Caixa.empresa_id == current_user.empresa_id
    ).first()
    if not caixa or caixa.status != StatusCaixa.ABERTO:
        raise HTTPException(status_code=400, detail="O caixa informado não está aberto ou não existe.")

    # 3. Calcula valores
    valor_bruto = os.valor_total
    desconto = dados.desconto or Decimal("0.00")
    valor_liquido = max(valor_bruto - desconto, Decimal("0.00"))

    if not dados.pagamentos:
        raise HTTPException(status_code=400, detail="Informe ao menos uma forma de pagamento.")

    total_pago = sum([p.valor for p in dados.pagamentos], Decimal("0.00"))
    if total_pago < valor_liquido:
        raise HTTPException(
            status_code=400,
            detail=f"Valor pago (R$ {total_pago:.2f}) é menor que o total líquido da OS (R$ {valor_liquido:.2f})."
        )

    # 4. Processa pagamentos e valida crediário se houver
    cliente = db.query(Cliente).filter(
        Cliente.id == os.cliente_id,
        Cliente.empresa_id == current_user.empresa_id
    ).first()

    pagamentos_processados = []
    for pg in dados.pagamentos:
        if pg.forma_pagamento == FormaPagamento.A_PRAZO:
            if not cliente:
                raise HTTPException(status_code=400, detail="Vendas a prazo necessitam de cliente cadastrado.")
            novo_saldo = cliente.saldo_devedor + pg.valor
            if cliente.limite_credito > 0 and novo_saldo > cliente.limite_credito:
                raise HTTPException(
                    status_code=400,
                    detail=f"Limite de crédito excedido para {cliente.nome}. Limite: R$ {cliente.limite_credito:.2f}, Devedor: R$ {cliente.saldo_devedor:.2f}."
                )
            cliente.saldo_devedor = novo_saldo

        pagamentos_processados.append(
            PagamentoVenda(
                forma_pagamento=pg.forma_pagamento,
                valor=pg.valor,
                troco=pg.troco
            )
        )

    # 5. Prepara itens da venda
    itens_venda = []
    if os.valor_servicos > 0:
        servico_prod = db.query(Produto).filter(
            Produto.empresa_id == current_user.empresa_id,
            Produto.codigo_barras == "SERV_GERAL"
        ).first()
        if not servico_prod:
            servico_prod = Produto(
                empresa_id=current_user.empresa_id,
                nome="Mão de Obra / Serviços Executados",
                codigo_barras="SERV_GERAL",
                preco_custo=Decimal("0.00"),
                preco_venda=Decimal("0.00"),
                estoque_atual=Decimal("9999.00"),
                estoque_minimo=Decimal("0.00"),
                ativo=True
            )
            db.add(servico_prod)
            db.flush()

        itens_venda.append(
            ItemVenda(
                produto_id=servico_prod.id,
                quantidade=Decimal("1.00"),
                valor_unitario=os.valor_servicos,
                subtotal=os.valor_servicos
            )
        )

    for it in os.itens:
        itens_venda.append(
            ItemVenda(
                produto_id=it.produto_id,
                quantidade=it.quantidade,
                valor_unitario=it.valor_unitario,
                subtotal=it.subtotal
            )
        )

    # 6. Registra a Venda
    nova_venda = Venda(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        cliente_id=os.cliente_id,
        usuario_id=current_user.id,
        valor_bruto=valor_bruto,
        desconto=desconto,
        acrescimo=Decimal("0.00"),
        valor_liquido=valor_liquido,
        status=StatusVenda.CONCLUIDA,
        observacoes=dados.observacoes or f"Faturamento Ordem de Serviço #{os.id} - {os.titulo}",
        itens=itens_venda,
        pagamentos=pagamentos_processados
    )
    db.add(nova_venda)
    db.flush()

    # 7. Atualiza status da OS para ENTREGUE
    os.status = StatusOS.ENTREGUE
    os.data_finalizacao = datetime.now(timezone.utc)
    os.updated_at = datetime.now(timezone.utc)
    db.add(os)

    db.commit()
    db.refresh(os)

    return {
        "mensagem": f"Ordem de Serviço #{os.id} recebida e faturada com sucesso!",
        "os": formatar_os(os),
        "venda_id": nova_venda.id,
        "valor_pago": total_pago
    }


