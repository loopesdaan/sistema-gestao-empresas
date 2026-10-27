import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class TipoMovimentacaoTesouraria(str, enum.Enum):
    APORTE = "APORTE"                           # Entrada de capital / dinheiro físico no cofre
    RETIRADA = "RETIRADA"                       # Retirada / Depósito bancário / Pagamento de despesa
    LIBERACAO_FUNDO_TROCO = "LIBERACAO_FUNDO"   # Saída do cofre para compor o fundo de troco do caixa
    RECOLHIMENTO_FECHAMENTO = "RECOLHIMENTO"    # Entrada no cofre proveniente do fechamento de caixa
    SUPRIMENTO_CAIXA = "SUPRIMENTO_CAIXA"       # Saída do cofre para reforço de gaveta de caixa
    SANGRIA_CAIXA = "SANGRIA_CAIXA"             # Entrada no cofre recolhida por sangria de gaveta

class CofreCentral(Base):
    __tablename__ = "cofres_centrais"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), unique=True, nullable=False)
    saldo = Column(Numeric(12, 2), default=0.00, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="cofre_central")
    movimentacoes = relationship("MovimentacaoTesouraria", back_populates="cofre", cascade="all, delete-orphan")

class MovimentacaoTesouraria(Base):
    __tablename__ = "movimentacoes_tesouraria"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False)
    cofre_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("cofres_centrais.id"), nullable=False)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False)
    caixa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("caixas.id"), nullable=True)
    
    tipo = Column(Enum(TipoMovimentacaoTesouraria), nullable=False)
    valor = Column(Numeric(12, 2), nullable=False)
    saldo_anterior = Column(Numeric(12, 2), default=0.00, nullable=False)
    saldo_posterior = Column(Numeric(12, 2), default=0.00, nullable=False)
    motivo = Column(String(255), nullable=True)
    comprovante_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    cofre = relationship("CofreCentral", back_populates="movimentacoes")
    usuario = relationship("Usuario")
    caixa = relationship("Caixa")
