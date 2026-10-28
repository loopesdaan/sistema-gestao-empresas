from decimal import Decimal
from typing import Any, List
from io import BytesIO
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.produto import Produto
from app.models.notificacao import Notificacao
from app.models.estoque import MovimentacaoEstoque, TipoMovimentacaoEstoque
from app.schemas.estoque import MovimentacaoEstoqueCreate, MovimentacaoEstoqueResponse, ImportacaoExcelResponse
from app.api.deps import get_current_user
from app.services.produtos import buscar_produto_seguro

router = APIRouter()

@router.post("/movimentar", response_model=MovimentacaoEstoqueResponse)
def movimentar_estoque(
    mov_in: MovimentacaoEstoqueCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    if current_user.perfil not in [PerfilUsuario.ADMIN, PerfilUsuario.ESTOQUISTA]:
        raise HTTPException(status_code=403, detail="Apenas Administradores e Estoquistas podem movimentar estoque.")

    produto = buscar_produto_seguro(mov_in.produto_id, db, current_user)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    qtd = Decimal(str(mov_in.quantidade))
    if qtd <= 0:
        raise HTTPException(status_code=400, detail="A quantidade deve ser maior que zero")

    if produto.unidade in ["UN", "CX", "PC", "PAR"] and qtd % 1 != 0:
        raise HTTPException(status_code=400, detail=f"Itens com unidade '{produto.unidade}' devem ter movimentação com quantidade inteira.")

    if mov_in.tipo == TipoMovimentacaoEstoque.ENTRADA:
        produto.estoque_atual += qtd
    elif mov_in.tipo == TipoMovimentacaoEstoque.SAIDA:
        produto.estoque_atual -= qtd
    elif mov_in.tipo == TipoMovimentacaoEstoque.AJUSTE:
        produto.estoque_atual = qtd

    mov = MovimentacaoEstoque(
        empresa_id=current_user.empresa_id,
        produto_id=produto.id,
        usuario_id=current_user.id,
        tipo=mov_in.tipo,
        quantidade=qtd,
        motivo=mov_in.motivo
    )
    db.add(mov)
    db.add(produto)

    # Notificação imediata para o Gerente
    tipo_desc = {
        TipoMovimentacaoEstoque.ENTRADA: "Entrada de Estoque",
        TipoMovimentacaoEstoque.SAIDA: "Saída Manual",
        TipoMovimentacaoEstoque.AJUSTE: "Ajuste de Balanço",
        TipoMovimentacaoEstoque.VENDA: "Baixa de Venda",
        TipoMovimentacaoEstoque.ESTORNO: "Estorno de Venda",
        TipoMovimentacaoEstoque.OS: "Uso em OS"
    }.get(mov_in.tipo, str(mov_in.tipo))

    notif = Notificacao(
        empresa_id=current_user.empresa_id,
        titulo=f"Movimentação de Estoque: {produto.nome}",
        mensagem=f"{current_user.nome} ({'Controlador de Estoque' if current_user.perfil == PerfilUsuario.ESTOQUISTA else 'Gerente'}) realizou {tipo_desc} de {qtd} un. Motivo: {mov_in.motivo or 'Ajuste manual'}. Saldo atual: {produto.estoque_atual} {produto.unidade}.",
        tipo="ALERTA",
        referencia_tipo="ESTOQUE",
        referencia_id=produto.id
    )
    db.add(notif)

    db.commit()
    db.refresh(mov)
    return mov

@router.get("/todas-movimentacoes")
def todas_movimentacoes(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Retorna histórico completo de movimentações de estoque para o Gerente e Controlador de Estoque"""
    movs = db.query(MovimentacaoEstoque).filter(
        MovimentacaoEstoque.empresa_id == current_user.empresa_id
    ).order_by(MovimentacaoEstoque.created_at.desc()).limit(limit).all()

    resultado = []
    for m in movs:
        resultado.append({
            "id": m.id,
            "produto_id": m.produto_id,
            "produto_nome": m.produto.nome if m.produto else f"Produto #{m.produto_id}",
            "categoria": m.produto.categoria if m.produto else "-",
            "usuario_id": m.usuario_id,
            "usuario_nome": m.usuario.nome if m.usuario else "Sistema",
            "tipo": m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo),
            "quantidade": float(m.quantidade),
            "motivo": m.motivo,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return resultado

@router.get("/dashboard-metricas")
def dashboard_estoque_metricas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Dashboard especializado de inteligência de estoque para o Controlador de Estoque e Gerente"""
    produtos = db.query(Produto).filter(
        Produto.empresa_id == current_user.empresa_id,
        Produto.ativo == True
    ).all()

    total_itens = len(produtos)
    quantidade_unidades = sum(float(p.estoque_atual or 0) for p in produtos)
    valor_custo_total = sum(float(p.estoque_atual or 0) * float(p.preco_custo or 0) for p in produtos)
    valor_venda_total = sum(float(p.estoque_atual or 0) * float(p.preco_venda or 0) for p in produtos)
    lucro_projetado = max(0.0, valor_venda_total - valor_custo_total)
    margem_media = ((lucro_projetado / valor_venda_total) * 100) if valor_venda_total > 0 else 0.0

    itens_zerados = [p for p in produtos if float(p.estoque_atual or 0) <= 0]
    itens_alerta = [p for p in produtos if 0 < float(p.estoque_atual or 0) <= float(p.estoque_minimo or 0)]

    movs = db.query(MovimentacaoEstoque).filter(
        MovimentacaoEstoque.empresa_id == current_user.empresa_id
    ).order_by(MovimentacaoEstoque.created_at.desc()).limit(10).all()

    return {
        "total_itens_cadastrados": total_itens,
        "quantidade_total_unidades": round(quantidade_unidades, 2),
        "patrimonio_custo_total": round(valor_custo_total, 2),
        "valor_potencial_venda": round(valor_venda_total, 2),
        "lucro_bruto_projetado": round(lucro_projetado, 2),
        "margem_media_percentual": round(margem_media, 1),
        "qtd_itens_zerados": len(itens_zerados),
        "qtd_itens_alerta": len(itens_alerta),
        "produtos_criticos": [
            {
                "id": p.id,
                "nome": p.nome,
                "categoria": p.categoria,
                "estoque_atual": float(p.estoque_atual),
                "estoque_minimo": float(p.estoque_minimo),
                "unidade": p.unidade,
                "preco_venda": float(p.preco_venda),
                "status": "ZERADO" if float(p.estoque_atual) <= 0 else "ALERTA"
            }
            for p in (itens_zerados + itens_alerta)[:15]
        ],
        "ultimas_movimentacoes": [
            {
                "id": m.id,
                "produto_nome": m.produto.nome if m.produto else f"Item #{m.produto_id}",
                "usuario_nome": m.usuario.nome if m.usuario else "Sistema",
                "tipo": m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo),
                "quantidade": float(m.quantidade),
                "motivo": m.motivo,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in movs
        ]
    }

@router.get("/historico/{produto_id}", response_model=List[MovimentacaoEstoqueResponse])
def historico_produto(
    produto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    produto = buscar_produto_seguro(produto_id, db, current_user)
    pid = produto.id if produto else produto_id
    return db.query(MovimentacaoEstoque).filter(
        MovimentacaoEstoque.produto_id == pid,
        MovimentacaoEstoque.empresa_id == current_user.empresa_id
    ).order_by(MovimentacaoEstoque.created_at.desc()).all()

@router.post("/importar-planilha", response_model=ImportacaoExcelResponse)
async def importar_planilha(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Importa produtos a partir de arquivo Excel (.xlsx).
    Colunas esperadas (cabeçalho flexível):
    Nome | Codigo_Barras | Categoria | Preco_Custo | Preco_Venda | Estoque_Atual | Estoque_Minimo
    """
    if current_user.perfil not in [PerfilUsuario.ADMIN, PerfilUsuario.ESTOQUISTA]:
        raise HTTPException(status_code=403, detail="Apenas Administradores e Estoquistas podem movimentar estoque.")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Envie um arquivo Excel no formato .xlsx")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(BytesIO(contents), data_only=True)
        sheet = wb.active
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao abrir arquivo Excel: {str(e)}")

    rows = list(sheet.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        raise HTTPException(status_code=400, detail="A planilha está vazia ou sem dados além do cabeçalho.")

    header = [str(col).strip().lower() if col is not None else "" for col in rows[0]]
    
    # Identifica índices de colunas
    col_map = {}
    for idx, col in enumerate(header):
        if "nome" in col or "produto" in col or "descricao" in col:
            col_map["nome"] = idx
        elif "codigo" in col or "barras" in col or "ean" in col:
            col_map["codigo_barras"] = idx
        elif "categoria" in col:
            col_map["categoria"] = idx
        elif "custo" in col:
            col_map["preco_custo"] = idx
        elif "venda" in col or "preco" in col or "valor" in col:
            col_map["preco_venda"] = idx
        elif "estoque" in col and "min" not in col:
            col_map["estoque_atual"] = idx
        elif "min" in col:
            col_map["estoque_minimo"] = idx

    if "nome" not in col_map:
        raise HTTPException(status_code=400, detail="Coluna obrigatória 'Nome' ou 'Produto' não identificada no cabeçalho.")

    total_criados = 0
    total_atualizados = 0
    erros = []

    for row_idx, row in enumerate(rows[1:], start=2):
        nome_val = row[col_map["nome"]] if "nome" in col_map and col_map["nome"] < len(row) else None
        if not nome_val or str(nome_val).strip() == "":
            continue

        nome = str(nome_val).strip()
        cod_barras = str(row[col_map["codigo_barras"]]).strip() if "codigo_barras" in col_map and row[col_map["codigo_barras"]] else None
        categoria = str(row[col_map["categoria"]]).strip() if "categoria" in col_map and row[col_map["categoria"]] else None

        def safe_decimal(val, default="0.00"):
            if val is None or val == "":
                return Decimal(default)
            try:
                # Trata formatações como R$ 1.500,00 ou 1500.00
                cleaned = str(val).replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
                return Decimal(cleaned)
            except Exception:
                try:
                    return Decimal(str(val))
                except Exception:
                    return Decimal(default)

        custo = safe_decimal(row[col_map["preco_custo"]]) if "preco_custo" in col_map else Decimal("0.00")
        venda = safe_decimal(row[col_map["preco_venda"]]) if "preco_venda" in col_map else Decimal("0.00")
        est_atual = safe_decimal(row[col_map["estoque_atual"]]) if "estoque_atual" in col_map else Decimal("0.00")
        est_min = safe_decimal(row[col_map["estoque_minimo"]]) if "estoque_minimo" in col_map else Decimal("0.00")

        # Verifica se já existe por código de barras ou por nome
        prod_existente = None
        if cod_barras:
            prod_existente = db.query(Produto).filter(
                Produto.codigo_barras == cod_barras,
                Produto.empresa_id == current_user.empresa_id
            ).first()
        if not prod_existente:
            prod_existente = db.query(Produto).filter(
                Produto.nome == nome,
                Produto.empresa_id == current_user.empresa_id
            ).first()

        if prod_existente:
            prod_existente.preco_custo = custo if custo > 0 else prod_existente.preco_custo
            prod_existente.preco_venda = venda if venda > 0 else prod_existente.preco_venda
            prod_existente.estoque_atual = est_atual
            prod_existente.estoque_minimo = est_min
            if categoria:
                prod_existente.categoria = categoria
            total_atualizados += 1
        else:
            novo_prod = Produto(
                empresa_id=current_user.empresa_id,
                nome=nome,
                codigo_barras=cod_barras,
                categoria=categoria,
                preco_custo=custo,
                preco_venda=venda,
                estoque_atual=est_atual,
                estoque_minimo=est_min
            )
            db.add(novo_prod)
            total_criados += 1

    db.commit()

    return {
        "sucesso": True,
        "total_processados": len(rows) - 1,
        "total_criados": total_criados,
        "total_atualizados": total_atualizados,
        "erros": erros
    }

