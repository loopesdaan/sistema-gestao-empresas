import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL.strip()

# Ajuste automático para provedores como Neon, Supabase e Render (postgres:// -> postgresql://)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    try:
        # Tenta conectar ao PostgreSQL com pool otimizado para nuvem
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
        logger.info("Conectado com sucesso ao banco PostgreSQL!")
    except Exception as e:
        if settings.ENVIRONMENT.lower() in ["production", "prod"]:
            logger.error(f"FALHA CRÍTICA AO CONECTAR AO POSTGRESQL EM PRODUÇÃO: {e}")
            raise e
        else:
            logger.warning(f"PostgreSQL indisponível no momento ({e}). Usando SQLite local ('gestao.db') para desenvolvimento.")
            engine = create_engine("sqlite:///./gestao.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

