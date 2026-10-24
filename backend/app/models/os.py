import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusOS(str, enum.Enum):
    ABERTA = "ABERTA"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    AGUARDANDO_PECAS = "AGUARDANDO_PECAS"
    CONCLUIDA = "CONCLUIDA"
    ENTREGUE = "ENTREGUE"
    CANCELADA = "CANCELADA"

class OrdemServico(Base):
    __tablename__ = "ordens_servico"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    
    titulo = Column(String(200), nullable=False)
    equipamento = Column(String(200), nullable=True)
    defeito_relatado = Column(Text, nullable=True)
    laudo_tecnico = Column(Text, nullable=True)
    status = Column(Enum(StatusOS), default=StatusOS.ABERTA, nullable=False, index=True)
    
    valor_servicos = Column(Numeric(10, 2), default=0.00, nullable=False)
    valor_pecas = Column(Numeric(10, 2), default=0.00, nullable=False)
    valor_total = Column(Numeric(10, 2), default=0.00, nullable=False)
    
    previsao_entrega = Column(DateTime, nullable=True)
    data_finalizacao = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="ordens_servico")
    cliente = relationship("Cliente", back_populates="ordens_servico")
    usuario = relationship("Usuario", back_populates="ordens_servico")
    itens = relationship("ItemOS", back_populates="ordem_servico", cascade="all, delete-orphan")

class ItemOS(Base):
    __tablename__ = "itens_os"

    id = Column(Integer, primary_key=True, index=True)
    os_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Numeric(10, 2), default=1.00, nullable=False)
    valor_unitario = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)

    ordem_servico = relationship("OrdemServico", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_os")

