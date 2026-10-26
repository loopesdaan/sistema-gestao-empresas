import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusVenda(str, enum.Enum):
    CONCLUIDA = "CONCLUIDA"
    CANCELADA = "CANCELADA"

class FormaPagamento(str, enum.Enum):
    DINHEIRO = "DINHEIRO"
    PIX = "PIX"
    CARTAO_CREDITO = "CARTAO_CREDITO"
    CARTAO_DEBITO = "CARTAO_DEBITO"
    A_PRAZO = "A_PRAZO"

class Venda(Base):
    __tablename__ = "vendas"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False)
    caixa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("caixas.id"), nullable=False)
    cliente_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("clientes.id"), nullable=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False)
    numero_sequencial = Column(BigInteger().with_variant(Integer, "sqlite"), nullable=True, index=True)
    
    valor_bruto = Column(Numeric(10, 2), default=0.00, nullable=False)
    desconto = Column(Numeric(10, 2), default=0.00, nullable=False)
    acrescimo = Column(Numeric(10, 2), default=0.00, nullable=False)
    valor_liquido = Column(Numeric(10, 2), default=0.00, nullable=False)
    status = Column(Enum(StatusVenda), default=StatusVenda.CONCLUIDA, nullable=False)
    observacoes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    empresa = relationship("Empresa", back_populates="vendas")
    caixa = relationship("Caixa", back_populates="vendas")
    cliente = relationship("Cliente", back_populates="vendas")
    usuario = relationship("Usuario", back_populates="vendas")
    itens = relationship("ItemVenda", back_populates="venda", cascade="all, delete-orphan")
    pagamentos = relationship("PagamentoVenda", back_populates="venda", cascade="all, delete-orphan")

class ItemVenda(Base):
    __tablename__ = "itens_venda"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    venda_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("vendas.id"), nullable=False)
    produto_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Numeric(10, 2), default=1.00, nullable=False)
    valor_unitario = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_venda")

class PagamentoVenda(Base):
    __tablename__ = "pagamentos_venda"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    venda_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("vendas.id"), nullable=False)
    forma_pagamento = Column(Enum(FormaPagamento), nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    troco = Column(Numeric(10, 2), default=0.00, nullable=False)

    venda = relationship("Venda", back_populates="pagamentos")

