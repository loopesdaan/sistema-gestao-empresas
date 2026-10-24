from typing import Any, List, Optional
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.ponto import RegistroPonto, ConfiguracaoPonto, StatusJornada
from app.models.notificacao import Notificacao
from app.api.deps import get_current_user

router = APIRouter()

class BatidaPontoResponse(BaseModel):
    ok: bool
    tipo_batida: str
    mensagem: str
    registro_id: int
    data: str
    status_jornada: str
    bloqueado_clt: bool
    entrada_1: Optional[datetime] = None
    saida_almoco: Optional[datetime] = None
    retorno_almoco: Optional[datetime] = None
    saida_2: Optional[datetime] = None
    minutos_trabalhados: int = 0
    horas_extras_aprovadas: int = 0

class ConfiguracaoPontoSchema(BaseModel):
    horario_entrada: str = "09:00"
    horario_saida_almoco: str = "12:00"
    horario_retorno_almoco: str = "13:00"
    horario_saida: str = "18:00"
    dias_trabalho: str = "SEG,TER,QUA,QUI,SEX"
    interjornada_minima_horas: int = 11
    max_horas_extras_dia_minutos: int = 120

class SolicitarHoraExtraSchema(BaseModel):
    minutos_solicitados: int
    motivo: str

class AprovarHoraExtraSchema(BaseModel):
    registro_id: int
    minutos_aprovados: int
    desbloquear_pdv: bool = True

@router.post("/bater", response_model=BatidaPontoResponse)
def registrar_batida(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Registra uma das 4 batidas diárias de ponto regulamentadas pela CLT"""
    hoje_str = date.today().isoformat()
    agora = datetime.now(timezone.utc)
    
    registro = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()

    tipo_batida = ""
    mensagem = ""

    if not registro:
        # 1ª Batida: Entrada
        # Validação de Interjornada de 11h (Art. 66 CLT) em relação ao último turno
        ontem_str = (date.today() - timedelta(days=1)).isoformat()
        registro_anterior = db.query(RegistroPonto).filter(
            RegistroPonto.usuario_id == current_user.id,
            RegistroPonto.data == ontem_str
        ).first()

        if registro_anterior and registro_anterior.saida_2:
            descanso = (agora - registro_anterior.saida_2.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0
            if descanso < 11.0:
                # Alerta de violação de interjornada CLT
                notif = Notificacao(
                    empresa_id=current_user.empresa_id,
                    usuario_id=None,
                    titulo="⚠️ Alerta CLT: Descanso Interjornada Inferior a 11h",
                    mensagem=f"O funcionário {current_user.nome} iniciou jornada após apenas {descanso:.1f}h de descanso (mínimo legal: 11h consecutivas).",
                    tipo="PONTO_CLT",
                    referencia_tipo="PONTO",
                    referencia_id=None
                )
                db.add(notif)

        registro = RegistroPonto(
            empresa_id=current_user.empresa_id,
            usuario_id=current_user.id,
            data=hoje_str,
            entrada_1=agora,
            status_jornada=StatusJornada.TRABALHANDO,
            minutos_trabalhados=0,
            saldo_minutos=0
        )
        db.add(registro)
        tipo_batida = "ENTRADA"
        mensagem = f"Entrada registrada com sucesso às {agora.strftime('%H:%M')}."

    elif registro.entrada_1 and not registro.saida_almoco:
        # 2ª Batida: Saída para Almoço
        registro.saida_almoco = agora
        registro.status_jornada = StatusJornada.INTERVALO_ALMOCO
        # Calcula primeiro período
        delta = (agora - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        registro.minutos_trabalhados = int(delta)
        tipo_batida = "SAIDA_ALMOCO"
        mensagem = f"Saída para almoço registrada às {agora.strftime('%H:%M')}."

    elif registro.saida_almoco and not registro.retorno_almoco:
        # 3ª Batida: Retorno do Almoço
        registro.retorno_almoco = agora
        registro.status_jornada = StatusJornada.TRABALHANDO
        tipo_batida = "RETORNO_ALMOCO"
        mensagem = f"Retorno do almoço registrado às {agora.strftime('%H:%M')}."

    elif registro.retorno_almoco and not registro.saida_2:
        # 4ª Batida: Saída Final
        registro.saida_2 = agora
        registro.status_jornada = StatusJornada.FINALIZADA
        
        # Calcula total trabalhado nos dois períodos
        p1 = (registro.saida_almoco.replace(tzinfo=timezone.utc) - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        p2 = (agora - registro.retorno_almoco.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        total_min = int(p1 + p2)
        registro.minutos_trabalhados = total_min
        registro.saldo_minutos = total_min - registro.minutos_previstos
        tipo_batida = "SAIDA_FINAL"
        mensagem = f"Jornada finalizada às {agora.strftime('%H:%M')}. Total trabalhado: {total_min // 60}h {total_min % 60}m."

    else:
        raise HTTPException(status_code=400, detail="Todas as 4 batidas de ponto de hoje já foram realizadas.")

    db.commit()
    db.refresh(registro)

    return {
        "ok": True,
        "tipo_batida": tipo_batida,
        "mensagem": mensagem,
        "registro_id": registro.id,
        "data": registro.data,
        "status_jornada": registro.status_jornada,
        "bloqueado_clt": registro.bloqueado_clt,
        "entrada_1": registro.entrada_1,
        "saida_almoco": registro.saida_almoco,
        "retorno_almoco": registro.retorno_almoco,
        "saida_2": registro.saida_2,
        "minutos_trabalhados": registro.minutos_trabalhados,
        "horas_extras_aprovadas": registro.horas_extras_aprovadas
    }

@router.get("/status-hoje")
def obter_status_hoje(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Retorna o status em tempo real da jornada do funcionário hoje"""
    hoje_str = date.today().isoformat()
    registro = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()

    if not registro:
        return {
            "possui_ponto_hoje": False,
            "status_jornada": "NAO_INICIADA",
            "bloqueado_clt": False,
            "minutos_trabalhados": 0,
            "limite_restante_minutos": 480, # 8h
            "jornada_estourada": False
        }

    agora = datetime.now(timezone.utc)
    minutos_atuais = registro.minutos_trabalhados

    if registro.status_jornada == StatusJornada.TRABALHANDO:
        if registro.retorno_almoco:
            p1 = (registro.saida_almoco.replace(tzinfo=timezone.utc) - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
            p2 = (agora - registro.retorno_almoco.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
            minutos_atuais = int(p1 + p2)
        elif registro.entrada_1:
            minutos_atuais = int((agora - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0)

    # Limite CLT: 480 minutos (8h) + horas extras aprovadas (máx 120 min)
    limite_maximo = 480 + registro.horas_extras_aprovadas
    jornada_estourada = minutos_atuais >= limite_maximo and registro.status_jornada == StatusJornada.TRABALHANDO

    return {
        "possui_ponto_hoje": True,
        "registro_id": registro.id,
        "status_jornada": registro.status_jornada,
        "bloqueado_clt": registro.bloqueado_clt or jornada_estourada,
        "entrada_1": registro.entrada_1,
        "saida_almoco": registro.saida_almoco,
        "retorno_almoco": registro.retorno_almoco,
        "saida_2": registro.saida_2,
        "minutos_trabalhados": minutos_atuais,
        "minutos_previstos": registro.minutos_previstos,
        "horas_extras_aprovadas": registro.horas_extras_aprovadas,
        "limite_restante_minutos": max(0, limite_maximo - minutos_atuais),
        "jornada_estourada": jornada_estourada
    }

@router.get("/meu-historico")
def meu_historico(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Histórico do mês do funcionário logado"""
    registros = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id
    ).order_by(RegistroPonto.data.desc()).limit(31).all()
    return registros

@router.get("/equipe-auditoria")
def equipe_auditoria(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Visão do Administrador de todos os pontos da equipe"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
        
    registros = db.query(RegistroPonto).filter(
        RegistroPonto.empresa_id == current_user.empresa_id
    ).order_by(RegistroPonto.data.desc()).limit(100).all()

    return [
        {
            "id": r.id,
            "usuario_id": r.usuario_id,
            "usuario_nome": r.usuario.nome if r.usuario else "",
            "data": r.data,
            "entrada_1": r.entrada_1,
            "saida_almoco": r.saida_almoco,
            "retorno_almoco": r.retorno_almoco,
            "saida_2": r.saida_2,
            "minutos_trabalhados": r.minutos_trabalhados,
            "saldo_minutos": r.saldo_minutos,
            "horas_extras_aprovadas": r.horas_extras_aprovadas,
            "status_jornada": r.status_jornada,
            "bloqueado_clt": r.bloqueado_clt
        }
        for r in registros
    ]

@router.post("/aprovar-hora-extra")
def aprovar_hora_extra(
    dados: AprovarHoraExtraSchema,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Administrador autoriza horas extras legais (máx 120min = 2h CLT) e desbloqueia o PDV"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    if dados.minutos_aprovados > 120:
        raise HTTPException(status_code=400, detail="O limite máximo de horas extras pela CLT é de 2 horas (120 minutos) por dia.")

    registro = db.query(RegistroPonto).filter(
        RegistroPonto.id == dados.registro_id,
        RegistroPonto.empresa_id == current_user.empresa_id
    ).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de ponto não encontrado.")

    registro.horas_extras_aprovadas = dados.minutos_aprovados
    if dados.desbloquear_pdv:
        registro.bloqueado_clt = False
        registro.status_jornada = StatusJornada.TRABALHANDO

    db.commit()
    db.refresh(registro)

    return {
        "ok": True,
        "mensagem": f"{dados.minutos_aprovados} minutos de hora extra autorizados pelo Administrador. Sistema desbloqueado com sucesso.",
        "horas_extras_aprovadas": registro.horas_extras_aprovadas
    }
