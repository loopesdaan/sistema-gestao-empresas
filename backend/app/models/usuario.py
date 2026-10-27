import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class PerfilUsuario(str, enum.Enum):
    ADMIN = "ADMIN"
    VENDEDOR = "VENDEDOR"
    OPERADOR_CAIXA = "OPERADOR_CAIXA"
    TECNICO = "TECNICO"
    ESTOQUISTA = "ESTOQUISTA"
    FINANCEIRO = "FINANCEIRO"

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False)
    nome = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    perfil = Column(Enum(PerfilUsuario), default=PerfilUsuario.ADMIN, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    foto_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="usuarios")
    caixas = relationship("Caixa", back_populates="usuario")
    vendas = relationship("Venda", back_populates="usuario")
    ordens_servico = relationship("OrdemServico", foreign_keys="[OrdemServico.usuario_id]", back_populates="usuario")

