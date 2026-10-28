import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusCaixa(str, enum.Enum):
    ABERTO = "ABERTO"
    FECHADO = "FECHADO"
    PENDENTE_APROVACAO = "PENDENTE_APROVACAO"

class TipoMovimentacaoCaixa(str, enum.Enum):
    SANGRIA = "SANGRIA"
    SUPRIMENTO = "SUPRIMENTO"

class StatusSolicitacaoCaixa(str, enum.Enum):
    PENDENTE = "PENDENTE"
    APROVADO = "APROVADO"
    REJEITADO = "REJEITADO"

class TipoSolicitacaoCaixa(str, enum.Enum):
    SUPRIMENTO = "SUPRIMENTO"
    SANGRIA = "SANGRIA"
    SANGRIA_CEGA = "SANGRIA_CEGA"

class Caixa(Base):
    __tablename__ = "caixas"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False, index=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False, index=True)
    data_abertura = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    data_fechamento = Column(DateTime, nullable=True)
    saldo_inicial = Column(Numeric(10, 2), default=0.00, nullable=False)
    saldo_final_informado = Column(Numeric(10, 2), nullable=True)
    saldo_final_calculado = Column(Numeric(10, 2), nullable=True)
    limite_gaveta = Column(Numeric(10, 2), default=1000.00, nullable=True)
    status = Column(Enum(StatusCaixa), default=StatusCaixa.ABERTO, nullable=False, index=True)
    observacoes = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_caixas_empresa_status", "empresa_id", "status"),
        Index("idx_caixas_empresa_data", "empresa_id", "data_abertura"),
    )

    empresa = relationship("Empresa", back_populates="caixas")
    usuario = relationship("Usuario", back_populates="caixas")
    movimentacoes = relationship("MovimentacaoCaixa", back_populates="caixa", cascade="all, delete-orphan")
    vendas = relationship("Venda", back_populates="caixa")
    solicitacoes = relationship("SolicitacaoCaixa", back_populates="caixa", cascade="all, delete-orphan")

class MovimentacaoCaixa(Base):
    __tablename__ = "movimentacoes_caixa"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    caixa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("caixas.id"), nullable=False, index=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(Enum(TipoMovimentacaoCaixa), nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    motivo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_mov_caixa_caixa_id", "caixa_id"),
    )

    caixa = relationship("Caixa", back_populates="movimentacoes")

class SolicitacaoCaixa(Base):
    __tablename__ = "solicitacoes_caixa"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False, index=True)
    caixa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("caixas.id"), nullable=False, index=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(Enum(TipoSolicitacaoCaixa), nullable=False)
    valor_solicitado = Column(Numeric(10, 2), nullable=True)
    valor_aprovado = Column(Numeric(10, 2), nullable=True)
    motivo = Column(String(255), nullable=True)
    status = Column(Enum(StatusSolicitacaoCaixa), default=StatusSolicitacaoCaixa.PENDENTE, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    respondido_em = Column(DateTime, nullable=True)
    respondido_por_id = Column(BigInteger().with_variant(Integer, "sqlite"), nullable=True)

    __table_args__ = (
        Index("idx_solic_caixa_empresa_status", "empresa_id", "status"),
    )

    caixa = relationship("Caixa", back_populates="solicitacoes")


