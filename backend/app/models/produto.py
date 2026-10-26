from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False)
    nome = Column(String(200), nullable=False, index=True)
    codigo_barras = Column(String(50), index=True, nullable=True)
    categoria = Column(String(100), nullable=True)
    unidade = Column(String(10), default="UN", nullable=False)
    preco_custo = Column(Numeric(10, 2), default=0.00, nullable=False)
    preco_venda = Column(Numeric(10, 2), default=0.00, nullable=False)
    estoque_atual = Column(Numeric(10, 2), default=0.00, nullable=False)
    estoque_minimo = Column(Numeric(10, 2), default=0.00, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="produtos")
    movimentacoes = relationship("MovimentacaoEstoque", back_populates="produto", cascade="all, delete-orphan")
    itens_venda = relationship("ItemVenda", back_populates="produto")
    itens_os = relationship("ItemOS", back_populates="produto")

