from typing import Any, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.empresa import Empresa
from app.models.produto import Produto
from app.models.cliente import Cliente
from app.schemas.empresa import EmpresaResponse, EmpresaUpdate
from app.api.deps import get_current_user, get_current_admin
router = APIRouter()

PRESETS_DEMO = {
    "lava_rapido": {
        "produtos": [
            {"nome": "Ducha Rápida + Pretinho nos Pneus", "categoria": "Lavagem", "unidade": "UN", "preco_custo": Decimal("5.00"), "preco_venda": Decimal("35.00"), "estoque_atual": Decimal("999"), "estoque_minimo": Decimal("0"), "codigo_barras": "LAV001"},
            {"nome": "Lavagem Completa c/ Cera Líquida", "categoria": "Lavagem", "unidade": "UN", "preco_custo": Decimal("10.00"), "preco_venda": Decimal("60.00"), "estoque_atual": Decimal("999"), "estoque_minimo": Decimal("0"), "codigo_barras": "LAV002"},
            {"nome": "Higienização Interna & Ar Condicionado", "categoria": "Estética", "unidade": "UN", "preco_custo": Decimal("25.00"), "preco_venda": Decimal("150.00"), "estoque_atual": Decimal("999"), "estoque_minimo": Decimal("0"), "codigo_barras": "EST001"},
            {"nome": "Polimento Técnico e Cristalização", "categoria": "Estética", "unidade": "UN", "preco_custo": Decimal("60.00"), "preco_venda": Decimal("380.00"), "estoque_atual": Decimal("999"), "estoque_minimo": Decimal("0"), "codigo_barras": "EST002"},
            {"nome": "Aromatizante Gel Automotivo Centrals", "categoria": "Acessórios", "unidade": "UN", "preco_custo": Decimal("6.00"), "preco_venda": Decimal("15.00"), "estoque_atual": Decimal("50"), "estoque_minimo": Decimal("10"), "codigo_barras": "789100000001"},
            {"nome": "Cera Líquida de Carnaúba 500ml", "categoria": "Insumos", "unidade": "UN", "preco_custo": Decimal("16.00"), "preco_venda": Decimal("32.00"), "estoque_atual": Decimal("24"), "estoque_minimo": Decimal("5"), "codigo_barras": "789100000002"},
        ],
        "clientes": [
            {"nome": "Carlos Eduardo Santos", "telefone": "(11) 98765-1122", "placa_veiculo": "BRA-2E19", "modelo_veiculo": "Honda Civic 2021 Preto", "endereco": "Av. Brasil, 450", "limite_credito": Decimal("0.00")},
            {"nome": "Mariana Souza Costa", "telefone": "(11) 99123-4455", "placa_veiculo": "ABC-1D23", "modelo_veiculo": "Jeep Compass 2022 Branco", "endereco": "Rua Augusta, 1200", "limite_credito": Decimal("0.00")},
            {"nome": "Roberto Alves Ribeiro", "telefone": "(11) 97788-9900", "placa_veiculo": "KXZ-8890", "modelo_veiculo": "Toyota Corolla 2020 Prata", "endereco": "Rua Oscar Freire, 80", "limite_credito": Decimal("0.00")},
        ]
    },
    "adega": {
        "produtos": [
            {"nome": "Cerveja Heineken 330ml Long Neck", "categoria": "Cervejas", "unidade": "UN", "preco_custo": Decimal("5.20"), "preco_venda": Decimal("8.50"), "estoque_atual": Decimal("120"), "estoque_minimo": Decimal("24"), "codigo_barras": "789100000101"},
            {"nome": "Fardo Cerveja Skol 350ml (12 un)", "categoria": "Fardos", "unidade": "FD", "preco_custo": Decimal("28.00"), "preco_venda": Decimal("39.90"), "estoque_atual": Decimal("45"), "estoque_minimo": Decimal("10"), "codigo_barras": "789100000102"},
            {"nome": "Vinho Chileno Tinto Cabernet 750ml", "categoria": "Vinhos", "unidade": "UN", "preco_custo": Decimal("28.00"), "preco_venda": Decimal("49.90"), "estoque_atual": Decimal("30"), "estoque_minimo": Decimal("6"), "codigo_barras": "789100000103"},
            {"nome": "Whisky Johnnie Walker Red Label 1L", "categoria": "Destilados", "unidade": "UN", "preco_custo": Decimal("65.00"), "preco_venda": Decimal("98.00"), "estoque_atual": Decimal("18"), "estoque_minimo": Decimal("4"), "codigo_barras": "789100000104"},
            {"nome": "Pacote de Gelo Filtrado 5kg", "categoria": "Gelo & Carvão", "unidade": "PCT", "preco_custo": Decimal("4.50"), "preco_venda": Decimal("12.00"), "estoque_atual": Decimal("60"), "estoque_minimo": Decimal("15"), "codigo_barras": "789100000105"},
            {"nome": "Energético Red Bull 250ml", "categoria": "Energéticos", "unidade": "UN", "preco_custo": Decimal("7.20"), "preco_venda": Decimal("11.50"), "estoque_atual": Decimal("80"), "estoque_minimo": Decimal("20"), "codigo_barras": "789100000106"},
            {"nome": "Carvão Vegetal Especial 3kg", "categoria": "Gelo & Carvão", "unidade": "SC", "preco_custo": Decimal("10.00"), "preco_venda": Decimal("18.00"), "estoque_atual": Decimal("35"), "estoque_minimo": Decimal("8"), "codigo_barras": "789100000107"},
        ],
        "clientes": [
            {"nome": "Lucas Ferreira (Churrasco Semanal)", "telefone": "(11) 98111-2233", "endereco": "Rua dos Pinheiros, 300", "limite_credito": Decimal("500.00"), "saldo_devedor": Decimal("85.00")},
            {"nome": "Bar do Zé (Revenda / Balcão)", "telefone": "(11) 99222-3344", "endereco": "Av. Rebouças, 150", "limite_credito": Decimal("1500.00"), "saldo_devedor": Decimal("0.00")},
        ]
    },
    "mecanica": {
        "produtos": [
            {"nome": "Óleo Motor Sintético 5W30 1L", "categoria": "Lubrificantes", "unidade": "UN", "preco_custo": Decimal("26.00"), "preco_venda": Decimal("48.00"), "estoque_atual": Decimal("40"), "estoque_minimo": Decimal("10"), "codigo_barras": "789100000201"},
            {"nome": "Pastilha de Freio Dianteira Cerâmica", "categoria": "Freios", "unidade": "JG", "preco_custo": Decimal("65.00"), "preco_venda": Decimal("130.00"), "estoque_atual": Decimal("14"), "estoque_minimo": Decimal("5"), "codigo_barras": "789100000202"},
            {"nome": "Filtro de Óleo Blindado Lubrificante", "categoria": "Filtros", "unidade": "UN", "preco_custo": Decimal("14.00"), "preco_venda": Decimal("32.00"), "estoque_atual": Decimal("25"), "estoque_minimo": Decimal("8"), "codigo_barras": "789100000203"},
            {"nome": "Aditivo de Radiador Concentrado 1L", "categoria": "Arrefecimento", "unidade": "UN", "preco_custo": Decimal("18.00"), "preco_venda": Decimal("38.00"), "estoque_atual": Decimal("22"), "estoque_minimo": Decimal("8"), "codigo_barras": "789100000204"},
            {"nome": "Lâmpada H7 Super Branca 55W", "categoria": "Iluminação", "unidade": "UN", "preco_custo": Decimal("12.00"), "preco_venda": Decimal("29.90"), "estoque_atual": Decimal("8"), "estoque_minimo": Decimal("5"), "codigo_barras": "789100000205"},
            {"nome": "Mão de Obra Revisão de Freios e Troca", "categoria": "Serviços", "unidade": "UN", "preco_custo": Decimal("0.00"), "preco_venda": Decimal("150.00"), "estoque_atual": Decimal("999"), "estoque_minimo": Decimal("0"), "codigo_barras": "SRV001"},
        ],
        "clientes": [
            {"nome": "Marcos Vinicius Pereira", "telefone": "(11) 98333-4455", "placa_veiculo": "FGH-4521", "modelo_veiculo": "VW Gol 1.6 2018 Cinza", "endereco": "Rua Domingos de Morais, 500", "limite_credito": Decimal("1000.00")},
            {"nome": "Transportadora Rápida LTDA", "telefone": "(11) 3344-5566", "placa_veiculo": "MNO-9012", "modelo_veiculo": "Fiat Fiorino 2021 Branca", "endereco": "Av. do Estado, 3200", "limite_credito": Decimal("3000.00")},
        ]
    },
    "material_construcao": {
        "produtos": [
            {"nome": "Cimento Votoran Todas as Obras CP II 50kg", "categoria": "Básicos", "unidade": "SC", "preco_custo": Decimal("26.00"), "preco_venda": Decimal("34.90"), "estoque_atual": Decimal("150"), "estoque_minimo": Decimal("30"), "codigo_barras": "789100000301"},
            {"nome": "Areia Média Lavada Ensacada 20kg", "categoria": "Agregados", "unidade": "SC", "preco_custo": Decimal("4.00"), "preco_venda": Decimal("8.50"), "estoque_atual": Decimal("80"), "estoque_minimo": Decimal("20"), "codigo_barras": "789100000302"},
            {"nome": "Tinta Acrílica Fosca Branca 18L", "categoria": "Pintura", "unidade": "LT", "preco_custo": Decimal("140.00"), "preco_venda": Decimal("219.00"), "estoque_atual": Decimal("20"), "estoque_minimo": Decimal("5"), "codigo_barras": "789100000303"},
            {"nome": "Tubo PVC Soldável 25mm 6m Água Fria", "categoria": "Hidráulica", "unidade": "UN", "preco_custo": Decimal("14.00"), "preco_venda": Decimal("24.50"), "estoque_atual": Decimal("50"), "estoque_minimo": Decimal("15"), "codigo_barras": "789100000304"},
            {"nome": "Argamassa AC-I Uso Interno 20kg", "categoria": "Básicos", "unidade": "SC", "preco_custo": Decimal("11.00"), "preco_venda": Decimal("17.90"), "estoque_atual": Decimal("70"), "estoque_minimo": Decimal("20"), "codigo_barras": "789100000305"},
        ],
        "clientes": [
            {"nome": "Construtora Silva & Filhos LTDA", "telefone": "(11) 97123-0000", "endereco": "Obra Residencial Flamboyant - Lote 42", "limite_credito": Decimal("5000.00"), "saldo_devedor": Decimal("1250.00")},
            {"nome": "Mestre de Obras Antonio Carlos", "telefone": "(11) 98888-7777", "endereco": "Rua Voluntários da Pátria, 800", "limite_credito": Decimal("2000.00")},
        ]
    },
    "loja_roupa": {
        "produtos": [
            {"nome": "Camiseta Algodão Básica Masculina M/G", "categoria": "Camisetas", "unidade": "UN", "preco_custo": Decimal("18.00"), "preco_venda": Decimal("49.90"), "estoque_atual": Decimal("60"), "estoque_minimo": Decimal("15"), "codigo_barras": "789100000401"},
            {"nome": "Calça Jeans Feminina Skinny Cigarrete", "categoria": "Calças", "unidade": "UN", "preco_custo": Decimal("52.00"), "preco_venda": Decimal("129.90"), "estoque_atual": Decimal("35"), "estoque_minimo": Decimal("10"), "codigo_barras": "789100000402"},
            {"nome": "Vestido Casual Estampado Midi", "categoria": "Vestidos", "unidade": "UN", "preco_custo": Decimal("60.00"), "preco_venda": Decimal("149.90"), "estoque_atual": Decimal("20"), "estoque_minimo": Decimal("5"), "codigo_barras": "789100000403"},
            {"nome": "Bermuda Jeans Destroyed Masculina", "categoria": "Bermudas", "unidade": "UN", "preco_custo": Decimal("38.00"), "preco_venda": Decimal("89.90"), "estoque_atual": Decimal("25"), "estoque_minimo": Decimal("8"), "codigo_barras": "789100000404"},
            {"nome": "Jaqueta Corta-Vento Esportiva Unissex", "categoria": "Casacos", "unidade": "UN", "preco_custo": Decimal("75.00"), "preco_venda": Decimal("179.90"), "estoque_atual": Decimal("15"), "estoque_minimo": Decimal("4"), "codigo_barras": "789100000405"},
        ],
        "clientes": [
            {"nome": "Camila Rocha Martins", "telefone": "(11) 99345-6789", "endereco": "Alameda Santos, 1100", "limite_credito": Decimal("800.00"), "saldo_devedor": Decimal("149.90")},
            {"nome": "Juliana Mendes Barbosa", "telefone": "(11) 98222-1100", "endereco": "Rua Bela Cintra, 900", "limite_credito": Decimal("1200.00")},
        ]
    }
}

def aplicar_preset_no_banco(empresa_id: int, perfil_negocio: str, db: Session):
    preset = PRESETS_DEMO.get(perfil_negocio)
    if not preset:
        return

    try:
        from app.models.venda import ItemVenda, Venda
        
        # Preserva produtos vinculados a vendas existentes para não quebrar integridade referencial
        itens_vinculados = db.query(ItemVenda.produto_id).distinct().all()
        ids_em_vendas = {row[0] for row in itens_vinculados if row[0]}
        
        produtos_para_deletar = db.query(Produto).filter(
            Produto.empresa_id == empresa_id,
            ~Produto.id.in_(ids_em_vendas) if ids_em_vendas else True
        ).all()
        for p in produtos_para_deletar:
            db.delete(p)

        codigos_existentes = {p[0] for p in db.query(Produto.codigo_barras).filter(Produto.empresa_id == empresa_id).all() if p[0]}
        for prod_data in preset["produtos"]:
            if prod_data.get("codigo_barras") not in codigos_existentes:
                p = Produto(empresa_id=empresa_id, **prod_data)
                db.add(p)

        # Preserva clientes vinculados a vendas existentes
        clientes_com_vendas = {row[0] for row in db.query(Venda.cliente_id).distinct().all() if row[0]}
        clientes_para_deletar = db.query(Cliente).filter(
            Cliente.empresa_id == empresa_id,
            ~Cliente.id.in_(clientes_com_vendas) if clientes_com_vendas else True
        ).all()
        for c in clientes_para_deletar:
            db.delete(c)

        for cli_data in preset["clientes"]:
            c = Cliente(empresa_id=empresa_id, **cli_data)
            db.add(c)

        db.commit()
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger(__name__).warning(f"Erro seguro ao aplicar preset de demonstração: {e}")

@router.get("", response_model=EmpresaResponse)
def get_empresa(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return empresa

@router.put("", response_model=EmpresaResponse)
def update_empresa(
    empresa_in: EmpresaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    for field, value in empresa_in.model_dump(exclude_unset=True).items():
        setattr(empresa, field, value)

    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return empresa

@router.put("/onboarding", response_model=EmpresaResponse)
def salvar_onboarding(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    import json
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if not empresa:
        empresa = db.query(Empresa).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    if "nome_fantasia" in data and data["nome_fantasia"]:
        empresa.nome_fantasia = data["nome_fantasia"]
    if "razao_social" in data and data["razao_social"]:
        empresa.razao_social = data["razao_social"]
    if "cnpj" in data:
        empresa.cnpj = data["cnpj"]
    if "telefone" in data:
        empresa.telefone = data["telefone"]
    if "email" in data:
        empresa.email = data["email"]
    if "endereco" in data:
        empresa.endereco = data["endereco"]
    if "cep" in data:
        empresa.cep = data["cep"]
    if "cor_primaria" in data:
        empresa.cor_primaria = data["cor_primaria"]
    if "perfil_negocio" in data and data["perfil_negocio"]:
        empresa.perfil_negocio = data["perfil_negocio"]
    if "modulos_ativos" in data:
        if isinstance(data["modulos_ativos"], (list, dict)):
            empresa.modulos_ativos = json.dumps(data["modulos_ativos"])
        else:
            empresa.modulos_ativos = str(data["modulos_ativos"])
    
    empresa.onboarding_concluido = True
    db.commit()
    db.refresh(empresa)

    # Se solicitado explicitamente (por exemplo na primeira inicialização com opção marcada)
    aplicar_demo = data.get("aplicar_dados_demo", False)
    if aplicar_demo and empresa.perfil_negocio in PRESETS_DEMO:
        qtd_produtos = db.query(Produto).filter(Produto.empresa_id == empresa.id).count()
        # Se for primeira vez ou se foi expressamente autorizado
        if qtd_produtos == 0 or data.get("forcar_substituicao_demo", False):
            aplicar_preset_no_banco(empresa.id, empresa.perfil_negocio, db)

    return empresa

@router.post("/aplicar-preset-segmento")
def aplicar_preset_segmento(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    perfil = data.get("perfil_negocio")
    if not perfil or perfil not in PRESETS_DEMO:
        raise HTTPException(status_code=400, detail="Segmento não suportado para predefinição de dados.")
    
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if not empresa:
        empresa = db.query(Empresa).first()

    nomes_segmentos = {
        "mecanica": ("Auto Mecânica & Peças", "amber"),
        "lava_rapido": ("Lava Rápido Levi Express", "cyan"),
        "adega": ("Adega Premier & Distribuidora", "purple"),
        "material_construcao": ("Material de Construção Silva", "orange"),
        "loja_roupa": ("Boutique & Moda Elegance", "rose"),
    }

    if empresa:
        empresa.perfil_negocio = perfil
        if perfil in nomes_segmentos:
            nome_sugerido, cor_sugerida = nomes_segmentos[perfil]
            # Preserva o nome fantasia se o usuário já tiver configurado um nome próprio
            if not empresa.nome_fantasia or empresa.nome_fantasia in ["Gestão PME", "Minha Empresa"]:
                empresa.nome_fantasia = nome_sugerido
            if not empresa.cor_primaria:
                empresa.cor_primaria = cor_sugerida
        db.commit()

    aplicar_preset_no_banco(current_user.empresa_id, perfil, db)
    return {
        "ok": True,
        "mensagem": f"Catálogo e clientes de exemplo para '{perfil}' carregados com sucesso.",
        "perfil_negocio": perfil,
        "nome_fantasia": empresa.nome_fantasia if empresa else None
    }


