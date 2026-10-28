import os
import json
import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text, func
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Empresa, Usuario, PerfilUsuario, Produto, Cliente, Venda, OrdemServico
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
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN onboarding_concluido BOOLEAN DEFAULT FALSE"))
                if "cep" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN cep VARCHAR(10)"))
                if "cor_primaria" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN cor_primaria VARCHAR(30)"))
                if "logo_url" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN logo_url TEXT"))
                if "bypass_ponto_teste" not in empresa_cols:
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN bypass_ponto_teste BOOLEAN DEFAULT FALSE"))
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

        if "ordens_servico" in inspector.get_table_names():
            os_cols = [c["name"] for c in inspector.get_columns("ordens_servico")]
            with engine.connect() as conn:
                if "motivo_cancelamento" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN motivo_cancelamento TEXT"))
                if "data_cancelamento" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN data_cancelamento TIMESTAMP"))
                if "usuario_cancelamento_id" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN usuario_cancelamento_id INTEGER REFERENCES usuarios(id)"))
                if "numero_sequencial" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN numero_sequencial BIGINT"))
                if "foto_antes_url" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN foto_antes_url TEXT"))
                if "foto_depois_url" not in os_cols:
                    conn.execute(text("ALTER TABLE ordens_servico ADD COLUMN foto_depois_url TEXT"))
                conn.commit()

        if "vendas" in inspector.get_table_names():
            venda_cols = [c["name"] for c in inspector.get_columns("vendas")]
            with engine.connect() as conn:
                if "numero_sequencial" not in venda_cols:
                    conn.execute(text("ALTER TABLE vendas ADD COLUMN numero_sequencial BIGINT"))
                conn.commit()

        if "movimentacoes_tesouraria" in inspector.get_table_names():
            mov_cols = [c["name"] for c in inspector.get_columns("movimentacoes_tesouraria")]
            with engine.connect() as conn:
                if "comprovante_url" not in mov_cols:
                    conn.execute(text("ALTER TABLE movimentacoes_tesouraria ADD COLUMN comprovante_url TEXT"))
                conn.commit()

        # Suporte ao Enum FINANCEIRO no PostgreSQL / CockroachDB
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TYPE perfilusuario ADD VALUE IF NOT EXISTS 'FINANCEIRO'"))
                conn.commit()
        except Exception:
            pass
    except Exception as e:
        logger.warning(f"Aviso durante migração de colunas: {e}")

def migrar_indices():
    """
    Cria índices secundários e compostos essenciais no CockroachDB / PostgreSQL.
    Elimina Full Table Scans distribuídos em consultas multi-tenant (WHERE empresa_id = ? ...),
    resolvendo os alertas de lentidão (>90ms) e reduzindo a latência para faixas de 2ms a 8ms.
    """
    indices_necessarios = [
        # Vendas
        ("idx_vendas_empresa_created", "vendas", "empresa_id, created_at DESC"),
        ("idx_vendas_empresa_caixa", "vendas", "empresa_id, caixa_id"),
        ("idx_vendas_empresa_status", "vendas", "empresa_id, status"),
        ("idx_vendas_empresa_seq", "vendas", "empresa_id, numero_sequencial"),
        ("idx_itens_venda_venda", "itens_venda", "venda_id"),
        ("idx_itens_venda_produto", "itens_venda", "produto_id"),
        ("idx_pagamentos_venda_venda", "pagamentos_venda", "venda_id"),
        # Produtos
        ("idx_produtos_empresa_ativo", "produtos", "empresa_id, ativo"),
        ("idx_produtos_empresa_categoria", "produtos", "empresa_id, categoria"),
        ("idx_produtos_empresa_id", "produtos", "empresa_id"),
        # Caixas & Movimentações
        ("idx_caixas_empresa_status", "caixas", "empresa_id, status"),
        ("idx_caixas_empresa_data", "caixas", "empresa_id, data_abertura DESC"),
        ("idx_caixas_empresa_id", "caixas", "empresa_id"),
        ("idx_mov_caixa_caixa_id", "movimentacoes_caixa", "caixa_id"),
        ("idx_solic_caixa_empresa_status", "solicitacoes_suprimento_sangria", "empresa_id, status"),
        # Ordens de Serviço
        ("idx_os_empresa_created", "ordens_servico", "empresa_id, created_at DESC"),
        ("idx_os_empresa_status", "ordens_servico", "empresa_id, status"),
        ("idx_os_empresa_cliente", "ordens_servico", "empresa_id, cliente_id"),
        ("idx_os_empresa_seq", "ordens_servico", "empresa_id, numero_sequencial"),
        ("idx_os_empresa_id", "ordens_servico", "empresa_id"),
        ("idx_itens_os_os_id", "itens_ordem_servico", "ordem_servico_id"),
        ("idx_itens_os_produto_id", "itens_ordem_servico", "produto_id"),
        # Estoque
        ("idx_mov_estoque_empresa_created", "movimentacoes_estoque", "empresa_id, created_at DESC"),
        ("idx_mov_estoque_empresa_produto", "movimentacoes_estoque", "empresa_id, produto_id"),
        # Tesouraria / Financeiro
        ("idx_mov_tesouraria_empresa_created", "movimentacoes_tesouraria", "empresa_id, created_at DESC"),
        ("idx_mov_tesouraria_cofre", "movimentacoes_tesouraria", "cofre_central_id"),
        # Ponto Eletrônico
        ("idx_ponto_empresa_data", "registros_ponto", "empresa_id, data_registro"),
        ("idx_ponto_usuario_data", "registros_ponto", "usuario_id, data_registro"),
        ("idx_config_ponto_empresa", "configuracoes_ponto", "empresa_id"),
        # Notificações
        ("idx_notificacoes_empresa_status", "notificacoes", "empresa_id, status"),
        ("idx_notificacoes_empresa_created", "notificacoes", "empresa_id, created_at DESC"),
        # Clientes
        ("idx_clientes_empresa_ativo", "clientes", "empresa_id, ativo"),
        ("idx_clientes_empresa_nome", "clientes", "empresa_id, nome"),
        ("idx_clientes_empresa_id", "clientes", "empresa_id"),
        # Usuários
        ("idx_usuarios_empresa_ativo", "usuarios", "empresa_id, ativo"),
        ("idx_usuarios_empresa_id", "usuarios", "empresa_id"),
    ]
    try:
        inspector = inspect(engine)
        tabelas_existentes = set(inspector.get_table_names())
        with engine.connect() as conn:
            for idx_name, tab_name, cols in indices_necessarios:
                if tab_name in tabelas_existentes:
                    try:
                        conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tab_name} ({cols})"))
                    except Exception as err:
                        logger.debug(f"Aviso ao criar índice {idx_name}: {err}")
            conn.commit()
        logger.info("Migração e verificação de índices no banco de dados concluída com sucesso.")
    except Exception as e:
        logger.warning(f"Aviso durante criação/verificação de índices: {e}")

def inicializar_banco_dados():
    """
    Inicializa a empresa e usuários de acordo com o ambiente (Dev vs Prod).
    Em PRODUÇÃO: Garante empresa e cria os dois administradores oficiais:
      - danilo.lopes@teste.com (Senha: Teste@123)
      - leticia.melo@teste.com (Senha: Teste@123)
      Sem dados fictícios de demonstração.
    Em DESENVOLVIMENTO: Cria os administradores oficiais e popula dados de demonstração.
    """
    db = SessionLocal()
    try:
        is_prod = settings.ENVIRONMENT.lower() in ["production", "prod"]
        
        empresa = db.query(Empresa).first()
        if not empresa:
            logger.info(f"Criando empresa principal ({'PRODUÇÃO' if is_prod else 'DESENVOLVIMENTO'})...")
            empresa = Empresa(
                razao_social="Sistema de Gestão Comercial PME",
                nome_fantasia="Gestão PME",
                cnpj="00.000.000/0001-00" if is_prod else "12.345.678/0001-90",
                telefone="(11) 99999-9999" if is_prod else "(11) 98765-4321",
                email="contato@gestaopme.com.br",
                endereco="São Paulo - SP",
                modulos_ativos=json.dumps(["pdv", "caixa", "produtos", "estoque", "clientes", "os", "relatorios", "financeiro"])
            )
            db.add(empresa)
            db.commit()
            db.refresh(empresa)

        # 1. Garante os dois Administradores Oficiais solicitados
        admins_oficiais = [
            ("Danilo Lopes", "danilo.lopes@teste.com", "Teste@123"),
            ("Leticia Melo", "leticia.melo@teste.com", "Teste@123"),
        ]

        for nome, email_admin, senha in admins_oficiais:
            u_admin = db.query(Usuario).filter(Usuario.email == email_admin).first()
            if not u_admin:
                novo_admin = Usuario(
                    empresa_id=empresa.id,
                    nome=nome,
                    email=email_admin,
                    hashed_password=get_password_hash(senha),
                    perfil=PerfilUsuario.ADMIN,
                    ativo=True
                )
                db.add(novo_admin)
                logger.info(f"Administrador oficial cadastrado com sucesso: {email_admin}")
            else:
                u_admin.empresa_id = empresa.id
                u_admin.perfil = PerfilUsuario.ADMIN
                u_admin.ativo = True
                u_admin.hashed_password = get_password_hash(senha)
                db.add(u_admin)
        db.commit()

        # Garante numeração sequencial humanizada para vendas e OS já registradas
        try:
            empresas = db.query(Empresa).all()
            for emp in empresas:
                vendas_sem_seq = db.query(Venda).filter(
                    Venda.empresa_id == emp.id,
                    Venda.numero_sequencial.is_(None)
                ).order_by(Venda.created_at.asc(), Venda.id.asc()).all()
                if vendas_sem_seq:
                    maior_seq = db.query(func.max(Venda.numero_sequencial)).filter(
                        Venda.empresa_id == emp.id
                    ).scalar() or 0
                    for v in vendas_sem_seq:
                        maior_seq += 1
                        v.numero_sequencial = maior_seq
                    db.commit()

                os_sem_seq = db.query(OrdemServico).filter(
                    OrdemServico.empresa_id == emp.id,
                    OrdemServico.numero_sequencial.is_(None)
                ).order_by(OrdemServico.created_at.asc(), OrdemServico.id.asc()).all()
                if os_sem_seq:
                    maior_os = db.query(func.max(OrdemServico.numero_sequencial)).filter(
                        OrdemServico.empresa_id == emp.id
                    ).scalar() or 0
                    for o in os_sem_seq:
                        maior_os += 1
                        o.numero_sequencial = maior_os
                    db.commit()

                # Garante que todas as empresas tenham modulos_ativos com OS e módulos operacionais
                modulos = []
                if emp.modulos_ativos:
                    try:
                        parsed = json.loads(emp.modulos_ativos) if isinstance(emp.modulos_ativos, str) else emp.modulos_ativos
                        if isinstance(parsed, list):
                            modulos = [str(m).strip().lower() for m in parsed if m]
                    except Exception:
                        pass

                modulos_essenciais = ["pdv", "caixa", "produtos", "estoque", "clientes", "os", "relatorios", "financeiro"]
                modificou = False
                if not modulos:
                    modulos = list(modulos_essenciais)
                    modificou = True
                else:
                    for m in modulos_essenciais:
                        if m not in modulos:
                            modulos.append(m)
                            modificou = True

                if modificou:
                    emp.modulos_ativos = json.dumps(modulos)
                    db.add(emp)
                    db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Aviso ao inicializar numeração sequencial e módulos: {e}")

        # 2. Se for PRODUÇÃO, desativa contas de demonstração e encerra
        if is_prod:
            emails_demo = ["admin@gestao.com", "caixa@gestao.com", "estoque@gestao.com", "caixa2@gestao.com", "caixa3@gestao.com", "estoque2@gestao.com"]
            for email_d in emails_demo:
                u_d = db.query(Usuario).filter(Usuario.email == email_d).first()
                if u_d:
                    u_d.ativo = False
                    db.add(u_d)
            db.commit()
            logger.info("Ambiente de Produção ativo: Contas demo desativadas. Apenas administradores oficiais autorizados.")
            return

        # 3. Se for DESENVOLVIMENTO, popula dados de demonstração
        usuarios_demo = [
            ("Administrador Demo", "admin@gestao.com", "admin123", PerfilUsuario.ADMIN),
            ("Gerente Financeiro", "financeiro@gestao.com", "fin123", PerfilUsuario.FINANCEIRO),
            ("Operador de Caixa", "caixa@gestao.com", "caixa123", PerfilUsuario.OPERADOR_CAIXA),
            ("Estoquista Responsável", "estoque@gestao.com", "estoque123", PerfilUsuario.ESTOQUISTA),
        ]
        for nome, email_d, senha_d, perfil_d in usuarios_demo:
            if not db.query(Usuario).filter(Usuario.email == email_d).first():
                db.add(Usuario(
                    empresa_id=empresa.id,
                    nome=nome,
                    email=email_d,
                    hashed_password=get_password_hash(senha_d),
                    perfil=perfil_d,
                    ativo=True
                ))
        db.commit()

        # Clientes Demo se não existirem
        if db.query(Cliente).count() == 0:
            db.add_all([
                Cliente(
                    empresa_id=empresa.id,
                    nome="João Silva Santos",
                    cpf_cnpj="123.456.789-00",
                    telefone="(11) 99123-4567",
                    email="joao.silva@email.com",
                    endereco="Rua das Flores, 120",
                    limite_credito=Decimal("1500.00"),
                    saldo_devedor=Decimal("0.00")
                ),
                Cliente(
                    empresa_id=empresa.id,
                    nome="Oficina Mecânica Rápida LTDA",
                    cpf_cnpj="98.765.432/0001-10",
                    telefone="(11) 3344-5566",
                    email="oficina.rapida@email.com",
                    endereco="Rua dos Motores, 500",
                    limite_credito=Decimal("5000.00"),
                    saldo_devedor=Decimal("350.00")
                )
            ])
            db.commit()

        # Produtos Demo se não existirem
        if db.query(Produto).count() == 0:
            db.add_all([
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
                    estoque_minimo=Decimal("10.00")
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
                    estoque_minimo=Decimal("5.00")
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
            ])
            db.commit()
            logger.info("Catálogo demo inicializado com sucesso em desenvolvimento!")
    except Exception as e:
        logger.error(f"Erro ao inicializar banco de dados: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria todas as tabelas caso não existam
    Base.metadata.create_all(bind=engine)
    # Migra novas colunas (ex: perfil_negocio, modulos_ativos, motivo_cancelamento)
    migrar_colunas()
    # Cria e verifica índices essenciais para CockroachDB / PostgreSQL
    migrar_indices()
    inicializar_banco_dados()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API de Gestão Empresarial (PDV, Estoque, Clientes, OS e Financeiro)",
    lifespan=lifespan
)

# Hardening de Segurança: Middleware de Security Headers HTTP (OWASP Recommended)
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Configuração Dinâmica de CORS (Permite localhost + Netlify em produção)
origens_cors = list(settings.BACKEND_CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL.strip():
    origens_cors.append(settings.FRONTEND_URL.strip().rstrip("/"))
if os.getenv("CORS_ORIGINS"):
    for org in os.getenv("CORS_ORIGINS", "").split(","):
        if org.strip():
            origens_cors.append(org.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_cors,
    allow_origin_regex=r"https://.*\.netlify\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

