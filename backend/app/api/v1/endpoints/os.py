from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.caixa import Caixa, StatusCaixa
from app.models.venda import Venda, ItemVenda, PagamentoVenda, StatusVenda, FormaPagamento
from app.models.estoque import MovimentacaoEstoque, TipoMovimentacaoEstoque
from app.models.os import OrdemServico, ItemOS, StatusOS
from app.schemas.os import OSCreate, OSUpdate, OSResponse, OSFaturarRequest, OSFaturarResponse, OSCancelarRequest
from app.api.deps import get_current_user
from app.api.v1.endpoints.vendas import buscar_caixa_aberto_seguro
from app.services.produtos import buscar_produto_seguro

router = APIRouter()

# Regras estritas de transição de status para Ordens de Serviço
TRANSIÇÕES_VALIDAS = {
    StatusOS.ABERTA: [StatusOS.EM_ANDAMENTO, StatusOS.AGUARDANDO_PECAS, StatusOS.CONCLUIDA, StatusOS.CANCELADA],
    StatusOS.AGUARDANDO_PECAS: [StatusOS.EM_ANDAMENTO, StatusOS.CONCLUIDA, StatusOS.CANCELADA],
    StatusOS.EM_ANDAMENTO: [StatusOS.AGUARDANDO_PECAS, StatusOS.CONCLUIDA, StatusOS.CANCELADA],
    StatusOS.CONCLUIDA: [StatusOS.EM_ANDAMENTO, StatusOS.ENTREGUE, StatusOS.CANCELADA],
    StatusOS.ENTREGUE: [],    # Estado final: faturada e entregue, não retrocede
    StatusOS.CANCELADA: []    # Estado final: cancelada, não retrocede
}

def formatar_os(os: OrdemServico) -> dict:
    seq = getattr(os, "numero_sequencial", None)
    if not seq:
        if os.id > 1_000_000_000:
            seq = (os.id % 10000) or 1
        else:
            seq = os.id
    codigo = f"#OS-{seq:04d}" if seq < 10000 else f"#OS-{seq}"

    return {
        "id": os.id,
        "numero_sequencial": seq,
        "codigo_identificador": codigo,
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
        "motivo_cancelamento": os.motivo_cancelamento,
        "data_cancelamento": os.data_cancelamento,
        "usuario_cancelamento_id": os.usuario_cancelamento_id,
        "usuario_cancelamento_nome": os.usuario_cancelamento.nome if getattr(os, "usuario_cancelamento", None) else "",
        "foto_antes_url": getattr(os, "foto_antes_url", None),
        "foto_depois_url": getattr(os, "foto_depois_url", None),
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

@router.get("/relatorios/cancelamentos")
def relatorio_cancelamentos_os(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Relatório gerencial de Ordens de Serviço canceladas com motivos para auditoria"""
    query = db.query(OrdemServico).filter(
        OrdemServico.empresa_id == current_user.empresa_id,
        OrdemServico.status == StatusOS.CANCELADA
    )
    if data_inicio:
        try:
            dt_ini = datetime.fromisoformat(data_inicio)
            query = query.filter(OrdemServico.data_cancelamento >= dt_ini)
        except Exception:
            pass
    if data_fim:
        try:
            dt_fim = datetime.fromisoformat(data_fim)
            query = query.filter(OrdemServico.data_cancelamento <= dt_fim)
        except Exception:
            pass

    ordens_canceladas = query.order_by(OrdemServico.data_cancelamento.desc(), OrdemServico.id.desc()).all()

    total_servicos = sum([o.valor_servicos for o in ordens_canceladas], Decimal("0.00"))
    total_pecas = sum([o.valor_pecas for o in ordens_canceladas], Decimal("0.00"))
    total_geral = sum([o.valor_total for o in ordens_canceladas], Decimal("0.00"))

    return {
        "total_ordens_canceladas": len(ordens_canceladas),
        "total_servicos_cancelados": float(total_servicos),
        "total_pecas_canceladas": float(total_pecas),
        "total_valor_cancelado": float(total_geral),
        "ordens": [formatar_os(o) for o in ordens_canceladas]
    }

def buscar_os_seguro(os_id: int, db: Session, current_user: Usuario) -> OrdemServico:
    """
    Busca Ordem de Serviço garantindo isolamento estrito por empresa.
    Possui resiliência contra:
    1. Arredondamento IEEE 754 float64 no JavaScript (CockroachDB IDs com até 19 dígitos).
    2. Referência alternativa por número sequencial (#1, #2) da empresa.
    3. Resgate seguro de registros legados órfãos (empresa_id IS NULL).
    """
    # 1. Busca exata por ID e empresa
    os_reg = db.query(OrdemServico).filter(
        OrdemServico.id == os_id,
        OrdemServico.empresa_id == current_user.empresa_id
    ).first()
    if os_reg:
        return os_reg

    # 2. Tolerância float64 (+- 1000) para IDs de 64-bit do CockroachDB na MESMA empresa
    if os_id and os_id > 10_000_000:
        candidatos = db.query(OrdemServico).filter(
            OrdemServico.empresa_id == current_user.empresa_id,
            OrdemServico.id >= os_id - 1000,
            OrdemServico.id <= os_id + 1000
        ).all()
        if len(candidatos) == 1:
            return candidatos[0]
        elif len(candidatos) > 1:
            candidatos.sort(key=lambda x: x.id, reverse=True)
            return candidatos[0]

    # 3. Busca por numero_sequencial na mesma empresa
    if os_id and os_id < 10_000_000:
        os_seq = db.query(OrdemServico).filter(
            OrdemServico.numero_sequencial == os_id,
            OrdemServico.empresa_id == current_user.empresa_id
        ).first()
        if os_seq:
            return os_seq

    # 4. Resgate apenas para registros legados órfãos (empresa_id IS NULL)
    os_orfao = db.query(OrdemServico).filter(
        OrdemServico.id == os_id,
        OrdemServico.empresa_id.is_(None)
    ).first()
    if os_orfao:
        os_orfao.empresa_id = current_user.empresa_id
        db.commit()
        db.refresh(os_orfao)
        return os_orfao

    raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")

@router.get("/{os_id}", response_model=OSResponse)
def obter_os(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    os = buscar_os_seguro(os_id, db, current_user)
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
    if not cliente and dados.cliente_id and dados.cliente_id > 10_000_000:
        cliente = db.query(Cliente).filter(
            Cliente.empresa_id == current_user.empresa_id,
            Cliente.id.between(dados.cliente_id - 1000, dados.cliente_id + 1000)
        ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    valor_pecas = Decimal("0.00")
    itens_processados = []

    for item_in in dados.itens:
        produto = buscar_produto_seguro(item_in.produto_id, db, current_user)
        if not produto:
            raise HTTPException(status_code=404, detail=f"Peça/Produto ID {item_in.produto_id} não encontrado")

        q_item = Decimal(str(item_in.quantidade)).quantize(Decimal("0.01"))
        v_item = Decimal(str(item_in.valor_unitario)).quantize(Decimal("0.01"))
        subtotal = (q_item * v_item).quantize(Decimal("0.01"))
        valor_pecas += subtotal

        # Baixa do estoque
        produto.estoque_atual -= q_item
        mov = MovimentacaoEstoque(
            empresa_id=current_user.empresa_id,
            produto_id=produto.id,
            usuario_id=current_user.id,
            tipo=TipoMovimentacaoEstoque.OS,
            quantidade=q_item,
            motivo=f"Item vinculado em Ordem de Serviço"
        )
        db.add(mov)

        itens_processados.append(
            ItemOS(
                produto_id=produto.id,
                quantidade=q_item,
                valor_unitario=v_item,
                subtotal=subtotal
            )
        )

    valor_total = dados.valor_servicos + valor_pecas

    maior_num = db.query(func.max(OrdemServico.numero_sequencial)).filter(
        OrdemServico.empresa_id == current_user.empresa_id
    ).scalar() or 0
    novo_numero_sequencial = maior_num + 1

    nova_os = OrdemServico(
        empresa_id=current_user.empresa_id,
        cliente_id=cliente.id,
        usuario_id=current_user.id,
        numero_sequencial=novo_numero_sequencial,
        titulo=dados.titulo,
        equipamento=dados.equipamento,
        defeito_relatado=dados.defeito_relatado,
        laudo_tecnico=dados.laudo_tecnico,
        status=StatusOS.ABERTA,
        valor_servicos=dados.valor_servicos,
        valor_pecas=valor_pecas,
        valor_total=valor_total,
        previsao_entrega=dados.previsao_entrega,
        foto_antes_url=dados.foto_antes_url,
        foto_depois_url=dados.foto_depois_url,
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
    os = buscar_os_seguro(os_id, db, current_user)

    update_dict = dados.model_dump(exclude_unset=True)

    if "status" in update_dict and update_dict["status"]:
        novo_status = update_dict["status"]
        if os.status == StatusOS.ENTREGUE:
            raise HTTPException(
                status_code=400,
                detail="Esta ordem de serviço já foi faturada e entregue ao cliente. O status não pode mais ser alterado."
            )
        if os.status == StatusOS.CANCELADA:
            raise HTTPException(
                status_code=400,
                detail="Esta ordem de serviço está cancelada e seu status não pode ser reaberto diretamente."
            )
        if novo_status != os.status and novo_status not in TRANSIÇÕES_VALIDAS.get(os.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Transição de status inválida: Não é permitido alterar de '{os.status.value}' para '{novo_status.value}'."
            )
        if novo_status == StatusOS.CANCELADA:
            raise HTTPException(
                status_code=400,
                detail="Para cancelar a ordem de serviço, utilize a função Cancelar informando a justificativa obrigatória."
            )
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
    if "foto_antes_url" in update_dict:
        os.foto_antes_url = update_dict["foto_antes_url"]
    if "foto_depois_url" in update_dict:
        os.foto_depois_url = update_dict["foto_depois_url"]

    # Se novas peças forem adicionadas
    if dados.itens is not None:
        # Remove peças antigas e estorna
        for it in os.itens:
            prod = buscar_produto_seguro(it.produto_id, db, current_user)
            if prod:
                prod.estoque_atual += it.quantidade
            db.delete(it)

        valor_pecas = Decimal("0.00")
        novos_itens = []
        for item_in in dados.itens:
            produto = buscar_produto_seguro(item_in.produto_id, db, current_user)
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
    os = buscar_os_seguro(os_id, db, current_user)
    if os.status == StatusOS.ENTREGUE:
        raise HTTPException(status_code=400, detail="Esta ordem de serviço já foi faturada e entregue.")
    if os.status == StatusOS.CANCELADA:
        raise HTTPException(status_code=400, detail="Não é possível faturar uma ordem de serviço cancelada.")
    if os.status != StatusOS.CONCLUIDA:
        raise HTTPException(
            status_code=400,
            detail=f"Apenas ordens com status 'CONCLUIDA' podem ser cobradas e faturadas no caixa. O status atual desta OS é '{os.status.value}'. Conclua a execução do serviço antes de realizar a cobrança."
        )

    # 2. Valida o Caixa com resiliência
    caixa = buscar_caixa_aberto_seguro(dados.caixa_id, db, current_user)

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
    if not cliente and os.cliente_id and os.cliente_id > 10_000_000:
        cliente = db.query(Cliente).filter(
            Cliente.empresa_id == current_user.empresa_id,
            Cliente.id.between(os.cliente_id - 1000, os.cliente_id + 1000)
        ).first()

    pagamentos_processados = []
    for pg in dados.pagamentos:
        if pg.forma_pagamento == FormaPagamento.A_PRAZO:
            if not cliente:
                raise HTTPException(status_code=400, detail="Vendas a prazo necessitam de cliente cadastrado.")
            novo_saldo = cliente.saldo_devedor + pg.valor
            if cliente.limite_credito <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Venda a prazo não permitida: o cliente {cliente.nome} não possui limite de crédito cadastrado. Configure um limite em Clientes antes de vender a prazo."
                )
            if novo_saldo > cliente.limite_credito:
                raise HTTPException(
                    status_code=400,
                    detail=f"Limite de crédito excedido para {cliente.nome}. Limite: R$ {cliente.limite_credito:.2f}, Devedor atual: R$ {cliente.saldo_devedor:.2f}."
                )
            cliente.saldo_devedor = novo_saldo

        pagamentos_processados.append(
            PagamentoVenda(
                forma_pagamento=pg.forma_pagamento,
                valor=pg.valor,
                troco=pg.troco
            )
        )

    # 5. Prepara itens da venda garantindo tipos Decimal estritos
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

        v_serv = Decimal(str(os.valor_servicos)).quantize(Decimal("0.01"))
        itens_venda.append(
            ItemVenda(
                produto_id=servico_prod.id,
                quantidade=Decimal("1.00"),
                valor_unitario=v_serv,
                subtotal=v_serv
            )
        )

    for it in os.itens:
        q_item = Decimal(str(it.quantidade)).quantize(Decimal("0.01"))
        v_item = Decimal(str(it.valor_unitario)).quantize(Decimal("0.01"))
        sub_item = Decimal(str(it.subtotal)).quantize(Decimal("0.01"))
        itens_venda.append(
            ItemVenda(
                produto_id=it.produto_id,
                quantidade=q_item,
                valor_unitario=v_item,
                subtotal=sub_item
            )
        )

    # 6. Registra a Venda com número sequencial humanizado
    maior_venda_seq = db.query(func.max(Venda.numero_sequencial)).filter(
        Venda.empresa_id == current_user.empresa_id
    ).scalar() or 0

    nova_venda = Venda(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        cliente_id=os.cliente_id,
        usuario_id=current_user.id,
        numero_sequencial=maior_venda_seq + 1,
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

@router.post("/{os_id}/cancelar", response_model=OSResponse)
def cancelar_os(
    os_id: int,
    dados: OSCancelarRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Cancela uma Ordem de Serviço com justificativa obrigatória e estorna peças no estoque."""
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        raise HTTPException(
            status_code=403,
            detail="Operação não permitida. O Controlador de Estoque não possui autorização para cancelar Ordens de Serviço."
        )

    os = buscar_os_seguro(os_id, db, current_user)

    if os.status == StatusOS.ENTREGUE:
        raise HTTPException(
            status_code=400,
            detail="Esta ordem de serviço já foi faturada e entregue ao cliente. Não é possível cancelá-la diretamente sem cancelamento da venda vinculada."
        )
    if os.status == StatusOS.CANCELADA:
        raise HTTPException(status_code=400, detail="Esta ordem de serviço já se encontra cancelada.")

    motivo = dados.motivo.strip() if dados.motivo else ""
    if len(motivo) < 5:
        raise HTTPException(
            status_code=400,
            detail="Informe uma justificativa detalhada para o cancelamento (mínimo de 5 caracteres)."
        )

    # Estorna as peças da OS para o estoque
    for it in os.itens:
        prod = buscar_produto_seguro(it.produto_id, db, current_user)
        if prod:
            prod.estoque_atual += it.quantidade
            mov = MovimentacaoEstoque(
                empresa_id=current_user.empresa_id,
                produto_id=prod.id,
                usuario_id=current_user.id,
                tipo=TipoMovimentacaoEstoque.AJUSTE,
                quantidade=it.quantidade,
                motivo=f"Estorno por cancelamento da OS #{os.id}: {motivo}"
            )
            db.add(mov)

    os.status = StatusOS.CANCELADA
    os.motivo_cancelamento = motivo
    os.data_cancelamento = datetime.now(timezone.utc)
    os.usuario_cancelamento_id = current_user.id
    os.updated_at = datetime.now(timezone.utc)

    db.add(os)
    db.commit()
    db.refresh(os)

    return formatar_os(os)

@router.delete("/{os_id}")
def excluir_os(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Bloqueio explícito de exclusão de Ordens de Serviço por exigência fiscal e de auditoria."""
    raise HTTPException(
        status_code=400,
        detail="Ordens de serviço não podem ser excluídas por exigência de auditoria contábil e controle de estoque. Para encerrar sem cobrança, utilize o botão Cancelar informando o motivo."
    )


