from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class MensagemInterna(Base):
    __tablename__ = "mensagens_internas"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    empresa_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("empresas.id"), nullable=False, index=True)
    usuario_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("usuarios.id"), nullable=False, index=True)

    usuario_nome = Column(String(100), nullable=False)
    usuario_perfil = Column(String(50), nullable=False)
    usuario_foto_url = Column(String(255), nullable=True)

    conteudo = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_mensagens_empresa_created", "empresa_id", "created_at"),
    )

    empresa = relationship("Empresa")
    usuario = relationship("Usuario")
