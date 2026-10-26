import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusNotificacao(str, enum.Enum):
    PENDENTE = "PENDENTE"
    RESOLVIDA = "RESOLVIDA"

class Notificacao(Base):
    __tablename__ = "notificacoes"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=True) # Null = global para admins
    
    titulo = Column(String(150), nullable=False)
    mensagem = Column(Text, nullable=False)
    tipo = Column(String(50), default="INFO", nullable=False) # 'PENDENCIA_FINANCEIRA', 'PONTO_CLT', 'CAIXA_TICKET', 'ALERTA', 'SUCESSO'
    
    referencia_tipo = Column(String(50), nullable=True) # 'VENDA', 'CLIENTE', 'CAIXA', 'PONTO'
    referencia_id = Column(BigInteger().with_variant(Integer, "sqlite"), nullable=True)
    valor_pendente = Column(Numeric(10, 2), nullable=True)
    
    status = Column(String(30), default="PENDENTE", nullable=False) # 'PENDENTE', 'RESOLVIDA'
    resolvido_em = Column(DateTime, nullable=True)
    resolvido_por_id = Column(BigInteger().with_variant(Integer, "sqlite"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    empresa = relationship("Empresa")
    usuario = relationship("Usuario")

