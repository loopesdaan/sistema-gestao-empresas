import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class TipoMovimentacaoEstoque(str, enum.Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"
    AJUSTE = "AJUSTE"
    VENDA = "VENDA"
    OS = "OS"

class MovimentacaoEstoque(Base):
    __tablename__ = "movimentacoes_estoque"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False, index=True)
    produto_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("produtos.id"), nullable=False, index=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=True, index=True)
    tipo = Column(Enum(TipoMovimentacaoEstoque), nullable=False)
    quantidade = Column(Numeric(10, 2), nullable=False)
    motivo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_mov_estoque_empresa_created", "empresa_id", "created_at"),
        Index("idx_mov_estoque_empresa_produto", "empresa_id", "produto_id"),
    )

    produto = relationship("Produto", back_populates="movimentacoes")
    usuario = relationship("Usuario")

