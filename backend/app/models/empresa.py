from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, index=True)
    razao_social = Column(String(200), nullable=False)
    nome_fantasia = Column(String(200), nullable=True)
    cnpj = Column(String(20), unique=True, index=True, nullable=True)
    telefone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    endereco = Column(Text, nullable=True)
    cep = Column(String(10), nullable=True)
    cor_primaria = Column(String(30), nullable=True)
    logo_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    perfil_negocio = Column(String(50), nullable=True)
    modulos_ativos = Column(Text, nullable=True)  # JSON string
    onboarding_concluido = Column(Boolean, default=False, nullable=True)

    usuarios = relationship("Usuario", back_populates="empresa", cascade="all, delete-orphan")
    produtos = relationship("Produto", back_populates="empresa", cascade="all, delete-orphan")
    clientes = relationship("Cliente", back_populates="empresa", cascade="all, delete-orphan")
    caixas = relationship("Caixa", back_populates="empresa", cascade="all, delete-orphan")
    vendas = relationship("Venda", back_populates="empresa", cascade="all, delete-orphan")
    ordens_servico = relationship("OrdemServico", back_populates="empresa", cascade="all, delete-orphan")

