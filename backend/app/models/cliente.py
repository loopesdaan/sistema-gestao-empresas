from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False, index=True)
    nome = Column(String(150), nullable=False)
    cpf_cnpj = Column(String(20), index=True, nullable=True)
    telefone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    endereco = Column(Text, nullable=True)
    cep = Column(String(10), nullable=True)
    placa_veiculo = Column(String(15), index=True, nullable=True)
    modelo_veiculo = Column(String(100), nullable=True)
    cor_veiculo = Column(String(50), nullable=True)
    limite_credito = Column(Numeric(10, 2), default=0.00, nullable=False)
    saldo_devedor = Column(Numeric(10, 2), default=0.00, nullable=False)
    observacoes = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_clientes_empresa_ativo", "empresa_id", "ativo"),
        Index("idx_clientes_empresa_nome", "empresa_id", "nome"),
    )

    empresa = relationship("Empresa", back_populates="clientes")
    vendas = relationship("Venda", back_populates="cliente")
    ordens_servico = relationship("OrdemServico", back_populates="cliente")

