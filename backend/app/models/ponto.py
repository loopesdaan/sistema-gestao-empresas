import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusJornada(str, enum.Enum):
    TRABALHANDO = "TRABALHANDO"
    INTERVALO_ALMOCO = "INTERVALO_ALMOCO"
    FINALIZADA = "FINALIZADA"
    BLOQUEADA_CLT = "BLOQUEADA_CLT"

class RegistroPonto(Base):
    __tablename__ = "registros_ponto"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    data = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    
    # 4 Batidas regulamentadas CLT
    entrada_1 = Column(DateTime, nullable=True)          # Ex: 09:00
    saida_almoco = Column(DateTime, nullable=True)       # Ex: 12:00
    retorno_almoco = Column(DateTime, nullable=True)     # Ex: 13:00
    saida_2 = Column(DateTime, nullable=True)            # Ex: 18:00
    
    minutos_trabalhados = Column(Integer, default=0, nullable=False)
    minutos_previstos = Column(Integer, default=480, nullable=False)  # 8 horas
    saldo_minutos = Column(Integer, default=0, nullable=False)        # Horas extras / déficit
    horas_extras_aprovadas = Column(Integer, default=0, nullable=False) # Minutos de hora extra homologados pelo ADM
    
    status_jornada = Column(Enum(StatusJornada), default=StatusJornada.TRABALHANDO, nullable=False)
    bloqueado_clt = Column(Boolean, default=False, nullable=False)
    observacoes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")

class ConfiguracaoPonto(Base):
    __tablename__ = "configuracoes_ponto"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    perfil = Column(String(50), nullable=True) # PerfilUsuario: ADMIN, OPERADOR_CAIXA, ESTOQUISTA
    
    horario_entrada = Column(String(5), default="09:00", nullable=False)
    horario_saida_almoco = Column(String(5), default="12:00", nullable=False)
    horario_retorno_almoco = Column(String(5), default="13:00", nullable=False)
    horario_saida = Column(String(5), default="18:00", nullable=False)
    
    dias_trabalho = Column(String(50), default="SEG,TER,QUA,QUI,SEX", nullable=False)
    carga_horaria_diaria_minutos = Column(Integer, default=480, nullable=False) # 8h
    tolerancia_minutos = Column(Integer, default=15, nullable=False) # Tolerância CLT (Art. 58 § 1º)
    interjornada_minima_horas = Column(Integer, default=11, nullable=False) # Art. 66 CLT: 11 horas
    max_horas_extras_dia_minutos = Column(Integer, default=120, nullable=False) # Art. 59 CLT: max 2 horas
    isento_ponto = Column(Boolean, default=False, nullable=False) # Art. 62 CLT: cargos de gestão/admin isentos
    ativo = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")

