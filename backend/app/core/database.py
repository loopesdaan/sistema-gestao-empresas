import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL.strip()

# Ajuste automático para CockroachDB Serverless e PostgreSQL
is_cockroach = "cockroach" in db_url.lower() or ":26257" in db_url
db_name = "CockroachDB Serverless" if is_cockroach else "PostgreSQL"

if is_cockroach:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "cockroachdb://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "cockroachdb://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "cockroachdb://", 1)
elif db_url.startswith("postgres://"):
    # Ajuste para provedores como Neon, Supabase e Render
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    try:
        # Tenta conectar ao banco relacional com pool otimizado para nuvem
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=10,
            max_overflow=20,
            connect_args={"connect_timeout": 5}
        )
        with engine.connect() as conn:
            pass
        logger.info(f"Conectado com sucesso ao banco relacional {db_name}!")
    except Exception as e:
        if settings.ENVIRONMENT.lower() in ["production", "prod"]:
            logger.error(f"FALHA CRÍTICA AO CONECTAR AO BANCO RELACIONAL {db_name.upper()} EM PRODUÇÃO: {e}")
            raise e
        else:
            logger.warning(f"{db_name} indisponível no momento ({e}). Usando SQLite local ('gestao.db') para desenvolvimento.")
            engine = create_engine("sqlite:///./gestao.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

