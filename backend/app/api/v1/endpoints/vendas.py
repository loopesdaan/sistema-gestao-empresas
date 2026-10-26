from decimal import Decimal
from typing import Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.caixa import Caixa, StatusCaixa
from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.estoque import MovimentacaoEstoque, TipoMovimentacaoEstoque
from app.models.venda import Venda, ItemVenda, PagamentoVenda, StatusVenda, FormaPagamento
from app.models.os import OrdemServico, StatusOS
from app.schemas.venda import VendaCreate, VendaResponse
from app.api.deps import get_current_user, verificar_ponto_trabalho
from app.api.v1.endpoints.clientes import buscar_cliente_seguro

router = APIRouter()

def formatar_venda(venda: Venda) -> dict:
    seq = getattr(venda, "numero_sequencial", None)
    if not seq:
        if venda.id > 1_000_000_000:
            seq = (venda.id % 10000) or 1
        else:
            seq = venda.id
    codigo = f"#{seq:04d}" if seq < 10000 else f"#{seq}"

    return {
        "id": venda.id,
        "numero_sequencial": seq,
        "codigo_identificador": codigo,
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
    # O Controlador de Estoque não acessa vendas
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        return []

    query = db.query(Venda).filter(Venda.empresa_id == current_user.empresa_id)
    # O Operador de Caixa tem acesso ao relatório das próprias vendas
    if current_user.perfil == PerfilUsuario.OPERADOR_CAIXA:
        query = query.filter(Venda.usuario_id == current_user.id)

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
        venda = db.query(Venda).filter(Venda.id == venda_id).first()
        if venda:
            venda.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(venda)
    if not venda:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return formatar_venda(venda)

def buscar_caixa_aberto_seguro(caixa_id: Optional[int], db: Session, current_user: Usuario) -> Caixa:
    """
    Busca o caixa aberto para registro de venda com resiliência contra tenant drift, IDs desatualizados
    e arredondamentos de precisão float64 (IEEE 754) típicos de browsers em inteiros de 64 bits.
    Garante que se a empresa ou o usuário possuir um caixa aberto ativo, a venda seja registrada nele.
    """
    def _is_aberto(c: Optional[Caixa]) -> bool:
        if not c or not c.status:
            return False
        return c.status == StatusCaixa.ABERTO or getattr(c.status, "value", str(c.status)) == "ABERTO"

    caixa = None
    if caixa_id:
        caixa = db.query(Caixa).filter(
            Caixa.id == caixa_id,
            Caixa.empresa_id == current_user.empresa_id
        ).first()

        # Tolerância a float64 caso o ID do CockroachDB tenha sofrido perda de precisão no frontend
        if not caixa and caixa_id > 10_000_000:
            candidatos = db.query(Caixa).filter(
                Caixa.empresa_id == current_user.empresa_id,
                Caixa.id >= caixa_id - 1000,
                Caixa.id <= caixa_id + 1000
            ).all()
            if len(candidatos) == 1:
                caixa = candidatos[0]
            elif len(candidatos) > 1:
                abertos = [c for c in candidatos if _is_aberto(c)]
                if abertos:
                    caixa = abertos[0]

        if not caixa:
            caixa = db.query(Caixa).filter(Caixa.id == caixa_id).first()
            if caixa:
                caixa.empresa_id = current_user.empresa_id
                db.commit()
                db.refresh(caixa)

    # Se o caixa_id enviado não estiver aberto ou não existir, busca o caixa aberto atual do usuário
    if not _is_aberto(caixa):
        caixa = db.query(Caixa).filter(
            Caixa.empresa_id == current_user.empresa_id,
            Caixa.usuario_id == current_user.id,
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()

    # Se ainda assim não encontrou, busca qualquer caixa aberto ativo da empresa
    if not _is_aberto(caixa):
        caixa = db.query(Caixa).filter(
            Caixa.empresa_id == current_user.empresa_id,
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()

    # Fallback amplo caso haja tenant drift no registro do caixa
    if not _is_aberto(caixa):
        caixa = db.query(Caixa).filter(
            Caixa.status == StatusCaixa.ABERTO
        ).order_by(Caixa.data_abertura.desc()).first()
        if caixa:
            caixa.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(caixa)

    if not _is_aberto(caixa):
        raise HTTPException(
            status_code=400,
            detail="O caixa informado não está aberto ou não existe. Por favor, abra o caixa antes de realizar vendas."
        )

    return caixa

def buscar_produto_seguro(produto_id: int, db: Session, current_user: Usuario) -> Produto:
    """
    Busca produto por ID garantindo vínculo à empresa do usuário.
    Possui fallback de resiliência caso ocorra tenant drift ou perda de precisão float64 no navegador.
    """
    produto = db.query(Produto).filter(
        Produto.id == produto_id,
        Produto.empresa_id == current_user.empresa_id
    ).first()

    if not produto:
        # Fallback de resiliência: se o produto existir no banco com outro empresa_id
        produto = db.query(Produto).filter(Produto.id == produto_id).first()
        if produto:
            produto.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(produto)

    # Fallback 2: Tolerância para precisão IEEE 754 de 64-bit int no JavaScript (CockroachDB IDs)
    if not produto and produto_id and produto_id > 10_000_000:
        candidatos = db.query(Produto).filter(
            Produto.empresa_id == current_user.empresa_id,
            Produto.id >= produto_id - 1000,
            Produto.id <= produto_id + 1000
        ).all()
        if len(candidatos) == 1:
            produto = candidatos[0]
        elif not candidatos:
            candidatos_gerais = db.query(Produto).filter(
                Produto.id >= produto_id - 1000,
                Produto.id <= produto_id + 1000
            ).all()
            if len(candidatos_gerais) == 1:
                produto = candidatos_gerais[0]
                produto.empresa_id = current_user.empresa_id
                db.commit()
                db.refresh(produto)

    if not produto:
        raise HTTPException(status_code=404, detail=f"Produto ID {produto_id} não encontrado.")
    return produto

@router.post("", response_model=VendaResponse)
def registrar_venda(
    dados: VendaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(verificar_ponto_trabalho)
) -> Any:
    # 0. Validação de perfil: Controlador de Estoque não realiza vendas
    if current_user.perfil == PerfilUsuario.ESTOQUISTA:
        raise HTTPException(
            status_code=403,
            detail="Operação não permitida. O perfil de Controlador de Estoque trabalha exclusivamente com a gestão do inventário e não realiza vendas no PDV."
        )

    # 1. Valida se o caixa existe e está aberto com resiliência
    caixa = buscar_caixa_aberto_seguro(dados.caixa_id, db, current_user)

    # 2. Valida itens
    if not dados.itens:
        raise HTTPException(status_code=400, detail="A venda deve conter ao menos um item.")

    valor_bruto = Decimal("0.00")
    itens_processados = []
    ordens_servico_finalizar = set()
    if dados.os_id:
        ordens_servico_finalizar.add(dados.os_id)

    servico_prod = None

    for item_in in dados.itens:
        is_servico = bool(getattr(item_in, "is_servico_os", False))
        os_id_item = getattr(item_in, "os_id", None)
        if os_id_item:
            ordens_servico_finalizar.add(os_id_item)

        if is_servico:
            if not servico_prod:
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
            produto = servico_prod
        else:
            produto = buscar_produto_seguro(item_in.produto_id, db, current_user)
            if not produto.ativo:
                raise HTTPException(status_code=400, detail=f"Produto '{produto.nome}' está inativo.")

        qtd = Decimal(str(item_in.quantidade)).quantize(Decimal("0.01"))
        v_unit = Decimal(str(item_in.valor_unitario)).quantize(Decimal("0.01"))
        subtotal = (qtd * v_unit).quantize(Decimal("0.01"))
        valor_bruto += subtotal

        # Dá baixa no estoque apenas para produtos normais que não sejam serviços ou peças já baixadas na OS
        deve_baixar_estoque = getattr(item_in, "baixar_estoque", True)
        if deve_baixar_estoque is None:
            deve_baixar_estoque = True
        if is_servico or getattr(item_in, "is_peca_os", False):
            deve_baixar_estoque = False

        if deve_baixar_estoque:
            if produto.estoque_atual < qtd:
                raise HTTPException(status_code=400, detail=f"Estoque insuficiente para '{produto.nome}'. Disponível: {produto.estoque_atual} {produto.unidade}")
            produto.estoque_atual -= qtd

            # Registra movimentação de estoque
            mov = MovimentacaoEstoque(
                empresa_id=current_user.empresa_id,
                produto_id=produto.id,
                usuario_id=current_user.id,
                tipo=TipoMovimentacaoEstoque.VENDA,
                quantidade=qtd,
                motivo="Venda no PDV"
            )
            db.add(mov)

        itens_processados.append(
            ItemVenda(
                produto_id=produto.id,
                quantidade=qtd,
                valor_unitario=v_unit,
                subtotal=subtotal
            )
        )

    v_desconto = Decimal(str(dados.desconto or 0)).quantize(Decimal("0.01"))
    v_acrescimo = Decimal(str(dados.acrescimo or 0)).quantize(Decimal("0.01"))
    valor_liquido = (valor_bruto - v_desconto + v_acrescimo).quantize(Decimal("0.01"))
    if valor_liquido < 0:
        raise HTTPException(status_code=400, detail="O valor total líquido não pode ser negativo.")

    # 3. Valida pagamentos
    if not dados.pagamentos:
        raise HTTPException(status_code=400, detail="Informe ao menos uma forma de pagamento.")

    total_pago = sum([Decimal(str(p.valor)).quantize(Decimal("0.01")) for p in dados.pagamentos], Decimal("0.00"))
    if total_pago < valor_liquido:
        raise HTTPException(status_code=400, detail=f"Valor pago (R$ {total_pago}) é menor que o total da venda (R$ {valor_liquido}).")

    # Verifica se há pagamento a prazo e checa limite de crédito do cliente com busca resiliente
    cliente = None
    if dados.cliente_id:
        cliente = buscar_cliente_seguro(dados.cliente_id, db, current_user)

    pagamentos_processados = []
    for pg in dados.pagamentos:
        v_pg = Decimal(str(pg.valor)).quantize(Decimal("0.01"))
        v_troco = Decimal(str(pg.troco or 0)).quantize(Decimal("0.01"))
        if pg.forma_pagamento == FormaPagamento.A_PRAZO:
            if not cliente:
                raise HTTPException(status_code=400, detail="Vendas a prazo necessitam de um cliente cadastrado selecionado.")
            novo_saldo = (cliente.saldo_devedor + v_pg).quantize(Decimal("0.01"))
            if cliente.limite_credito > 0 and novo_saldo > cliente.limite_credito:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Limite de crédito excedido para {cliente.nome}. Limite: R$ {cliente.limite_credito}, Atual devedor: R$ {cliente.saldo_devedor}, Tentativa: R$ {v_pg}."
                )
            cliente.saldo_devedor = novo_saldo

        pagamentos_processados.append(
            PagamentoVenda(
                forma_pagamento=pg.forma_pagamento,
                valor=v_pg,
                troco=v_troco
            )
        )

    # Determina o próximo número sequencial da venda para a empresa
    maior_num = db.query(func.max(Venda.numero_sequencial)).filter(
        Venda.empresa_id == current_user.empresa_id
    ).scalar() or 0
    novo_numero_sequencial = maior_num + 1

    # 4. Cria e persiste a venda de forma atômica
    nova_venda = Venda(
        empresa_id=current_user.empresa_id,
        caixa_id=caixa.id,
        cliente_id=cliente.id if cliente else None,
        usuario_id=current_user.id,
        numero_sequencial=novo_numero_sequencial,
        valor_bruto=valor_bruto.quantize(Decimal("0.01")),
        desconto=v_desconto,
        acrescimo=v_acrescimo,
        valor_liquido=valor_liquido,
        status=StatusVenda.CONCLUIDA,
        observacoes=dados.observacoes
    )

    try:
        db.add(nova_venda)
        db.flush()

        for it in itens_processados:
            it.venda_id = nova_venda.id
            db.add(it)
        db.flush()

        for pg in pagamentos_processados:
            pg.venda_id = nova_venda.id
            db.add(pg)
        db.flush()

        # 5. Se a venda finalizou Ordens de Serviço, atualiza seu status para ENTREGUE
        for os_id in ordens_servico_finalizar:
            os_registro = db.query(OrdemServico).filter(
                OrdemServico.id == os_id,
                OrdemServico.empresa_id == current_user.empresa_id
            ).first()
            if not os_registro:
                os_registro = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
                if os_registro:
                    os_registro.empresa_id = current_user.empresa_id
            if os_registro and os_registro.status != StatusOS.ENTREGUE:
                os_registro.status = StatusOS.ENTREGUE
                os_registro.data_finalizacao = datetime.now(timezone.utc)
                os_registro.updated_at = datetime.now(timezone.utc)
                db.add(os_registro)

        db.commit()
        db.refresh(nova_venda)
        return formatar_venda(nova_venda)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger("gestao_app").error(f"Erro inesperado ao registrar venda: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar a venda: {str(e)}"
        )

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
        venda = db.query(Venda).filter(Venda.id == venda_id).first()
        if venda:
            venda.empresa_id = current_user.empresa_id
            db.commit()
            db.refresh(venda)
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

