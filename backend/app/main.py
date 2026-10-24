import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Empresa, Usuario, PerfilUsuario, Produto, Cliente
from app.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gestao_app")

def migrar_colunas():
    """Garante que novas colunas adicionadas aos modelos existam no banco de dados"""
    try:
        inspector = inspect(engine)
        if "empresas" in inspector.get_table_names():
            empresa_cols = [c["name"] for c in inspector.get_columns("empresas")]
            with engine.connect() as conn:
                if "perfil_negocio" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN perfil_negocio VARCHAR(50)"))
                if "modulos_ativos" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN modulos_ativos TEXT"))
                if "onboarding_concluido" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN onboarding_concluido BOOLEAN DEFAULT 0"))
                if "cep" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN cep VARCHAR(10)"))
                if "cor_primaria" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN cor_primaria VARCHAR(30)"))
                if "logo_url" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN logo_url TEXT"))
                conn.commit()

        if "usuarios" in inspector.get_table_names():
            usuario_cols = [c["name"] for c in inspector.get_columns("usuarios")]
            with engine.connect() as conn:
                if "foto_url" not in usuario_cols:
                    conn.execute(text("ALTER TABLE usuarios ADD COLUMN foto_url TEXT"))
                conn.commit()

        if "caixas" in inspector.get_table_names():
            caixa_cols = [c["name"] for c in inspector.get_columns("caixas")]
            with engine.connect() as conn:
                if "limite_gaveta" not in caixa_cols:
                    conn.execute(text("ALTER TABLE caixas ADD COLUMN limite_gaveta NUMERIC(10, 2) DEFAULT 1000.00"))
                conn.commit()

        if "clientes" in inspector.get_table_names():
            cliente_cols = [c["name"] for c in inspector.get_columns("clientes")]
            with engine.connect() as conn:
                if "cep" not in cliente_cols:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN cep VARCHAR(10)"))
                if "placa_veiculo" not in cliente_cols:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN placa_veiculo VARCHAR(15)"))
                if "modelo_veiculo" not in cliente_cols:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN modelo_veiculo VARCHAR(100)"))
                if "cor_veiculo" not in cliente_cols:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN cor_veiculo VARCHAR(50)"))
                conn.commit()
    except Exception as e:
        logger.warning(f"Aviso durante migração de colunas: {e}")

def inicializar_dados_demo():
    """Gera dados iniciais de demonstração caso o banco de dados esteja vazio"""
    db = SessionLocal()
    try:
        empresa_existente = db.query(Empresa).first()
        if not empresa_existente:
            logger.info("Banco inicializado pela primeira vez. Criando empresa e dados de demonstração...")
            empresa = Empresa(
                razao_social="Auto & Varejo Comércio e Serviços LTDA",
                nome_fantasia="Gestão PME Modelo",
                cnpj="12.345.678/0001-90",
                telefone="(11) 98765-4321",
                email="contato@gestaopme.com.br",
                endereco="Av. Paulista, 1500 - Sala 42, São Paulo - SP"
            )
            db.add(empresa)
            db.commit()
            db.refresh(empresa)

            # Usuário Administrador
            admin = Usuario(
                empresa_id=empresa.id,
                nome="Administrador do Sistema",
                email="admin@gestao.com",
                hashed_password=get_password_hash("admin123"),
                perfil=PerfilUsuario.ADMIN,
                ativo=True
            )
            # Usuário Vendedor / Operador
            vendedor = Usuario(
                empresa_id=empresa.id,
                nome="Operador de Caixa",
                email="caixa@gestao.com",
                hashed_password=get_password_hash("caixa123"),
                perfil=PerfilUsuario.OPERADOR_CAIXA,
                ativo=True
            )
            # Usuário Estoquista
            estoquista = Usuario(
                empresa_id=empresa.id,
                nome="Estoquista Responsável",
                email="estoque@gestao.com",
                hashed_password=get_password_hash("estoque123"),
                perfil=PerfilUsuario.ESTOQUISTA,
                ativo=True
            )
            db.add_all([admin, vendedor, estoquista])

            # Clientes Demo
            cliente1 = Cliente(
                empresa_id=empresa.id,
                nome="João Silva Santos",
                cpf_cnpj="123.456.789-00",
                telefone="(11) 99123-4567",
                email="joao.silva@email.com",
                endereco="Rua das Flores, 120",
                limite_credito=Decimal("1500.00"),
                saldo_devedor=Decimal("0.00")
            )
            cliente2 = Cliente(
                empresa_id=empresa.id,
                nome="Oficina Mecânica Rápida LTDA",
                cpf_cnpj="98.765.432/0001-10",
                telefone="(11) 3344-5566",
                email="oficina.rapida@email.com",
                endereco="Rua dos Motores, 500",
                limite_credito=Decimal("5000.00"),
                saldo_devedor=Decimal("350.00")
            )
            db.add_all([cliente1, cliente2])

            # Produtos Demo
            produtos_iniciais = [
                Produto(
                    empresa_id=empresa.id,
                    nome="Óleo Motor Sintético 5W30 1L",
                    codigo_barras="789123456001",
                    categoria="Lubrificantes",
                    unidade="UN",
                    preco_custo=Decimal("28.00"),
                    preco_venda=Decimal("49.90"),
                    estoque_atual=Decimal("35.00"),
                    estoque_minimo=Decimal("10.00")
                ),
                Produto(
                    empresa_id=empresa.id,
                    nome="Filtro de Óleo Blindado PSL55",
                    codigo_barras="789123456002",
                    categoria="Filtros",
                    unidade="UN",
                    preco_custo=Decimal("15.50"),
                    preco_venda=Decimal("35.00"),
                    estoque_atual=Decimal("8.00"),
                    estoque_minimo=Decimal("10.00") # Alerta de estoque baixo!
                ),
                Produto(
                    empresa_id=empresa.id,
                    nome="Pastilha de Freio Dianteira",
                    codigo_barras="789123456003",
                    categoria="Freios",
                    unidade="JG",
                    preco_custo=Decimal("65.00"),
                    preco_venda=Decimal("130.00"),
                    estoque_atual=Decimal("14.00"),
                    estoque_minimo=Decimal("5.00")
                ),
                Produto(
                    empresa_id=empresa.id,
                    nome="Lâmpada H7 Super Branca",
                    codigo_barras="789123456004",
                    categoria="Iluminação",
                    unidade="UN",
                    preco_custo=Decimal("12.00"),
                    preco_venda=Decimal("29.90"),
                    estoque_atual=Decimal("2.00"),
                    estoque_minimo=Decimal("5.00") # Alerta de estoque baixo!
                ),
                Produto(
                    empresa_id=empresa.id,
                    nome="Aditivo de Radiador Concentrado 1L",
                    codigo_barras="789123456005",
                    categoria="Arrefecimento",
                    unidade="UN",
                    preco_custo=Decimal("18.00"),
                    preco_venda=Decimal("38.00"),
                    estoque_atual=Decimal("22.00"),
                    estoque_minimo=Decimal("8.00")
                )
            ]
            db.add_all(produtos_iniciais)
            db.commit()
            logger.info("Dados de demonstração criados com sucesso!")
        else:
            # Garante que o usuário estoquista exista caso o banco já tenha sido populado antes
            estoquista_existente = db.query(Usuario).filter(Usuario.email == "estoque@gestao.com").first()
            if not estoquista_existente:
                novo_estoquista = Usuario(
                    empresa_id=empresa_existente.id,
                    nome="Estoquista Responsável",
                    email="estoque@gestao.com",
                    hashed_password=get_password_hash("estoque123"),
                    perfil=PerfilUsuario.ESTOQUISTA,
                    ativo=True
                )
                db.add(novo_estoquista)
                db.commit()
                logger.info("Usuário Estoquista (estoque@gestao.com) adicionado.")
    except Exception as e:
        logger.error(f"Erro ao inicializar dados demo: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria todas as tabelas caso não existam
    Base.metadata.create_all(bind=engine)
    # Migra novas colunas (ex: perfil_negocio, modulos_ativos, onboarding_concluido)
    migrar_colunas()
    inicializar_dados_demo()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API de Gestão Empresarial (PDV, Estoque, Clientes, OS e Financeiro)",
    lifespan=lifespan
)

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "sistema": settings.PROJECT_NAME,
        "versao": settings.VERSION,
        "documentacao": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

