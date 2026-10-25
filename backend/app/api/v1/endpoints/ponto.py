from typing import Any, List, Optional
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.usuario import Usuario, PerfilUsuario
from app.models.ponto import RegistroPonto, ConfiguracaoPonto, StatusJornada
from app.models.notificacao import Notificacao
from app.models.empresa import Empresa
from app.api.deps import get_current_user, get_current_admin

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

class BaterPontoRequest(BaseModel):
    tipo_batida: Optional[str] = None
    hora_personalizada: Optional[str] = None

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

@router.post("/bater")
def registrar_batida(
    dados: Optional[BaterPontoRequest] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Registra uma das 4 batidas diárias de ponto regulamentadas pela CLT a qualquer hora com validação estrita da etapa"""
    hoje_str = date.today().isoformat()
    agora = datetime.now(timezone.utc)

    # Suporte a horário personalizado para testes do ADM
    if dados and dados.hora_personalizada:
        try:
            partes = dados.hora_personalizada.split(":")
            h, m = int(partes[0]), int(partes[1])
            agora = agora.replace(hour=h, minute=m, second=0, microsecond=0)
        except Exception:
            pass
    
    registro = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()

    tipo_solicitado = (dados.tipo_batida or "").upper().strip() if dados else ""

    # Determina o tipo alvo
    if tipo_solicitado in ["ENTRADA_1", "ENTRADA"]:
        tipo_alvo = "ENTRADA"
    elif tipo_solicitado in ["SAIDA_1", "SAIDA_ALMOCO", "ALMOCO"]:
        tipo_alvo = "SAIDA_ALMOCO"
    elif tipo_solicitado in ["ENTRADA_2", "RETORNO_ALMOCO", "VOLTA_ALMOCO"]:
        tipo_alvo = "RETORNO_ALMOCO"
    elif tipo_solicitado in ["SAIDA_2", "SAIDA_FINAL", "FINAL"]:
        tipo_alvo = "SAIDA_FINAL"
    else:
        # Próxima etapa estrita automática
        if not registro or not registro.entrada_1:
            tipo_alvo = "ENTRADA"
        elif not registro.saida_almoco:
            tipo_alvo = "SAIDA_ALMOCO"
        elif not registro.retorno_almoco:
            tipo_alvo = "RETORNO_ALMOCO"
        elif not registro.saida_2:
            tipo_alvo = "SAIDA_FINAL"
        else:
            raise HTTPException(
                status_code=400,
                detail="Todas as 4 batidas de hoje já foram realizadas. O expediente está concluído."
            )

    tipo_batida = ""
    mensagem = ""

    if tipo_alvo == "ENTRADA":
        if registro and registro.entrada_1:
            raise HTTPException(
                status_code=400,
                detail=f"A entrada de hoje já foi registrada às {registro.entrada_1.strftime('%H:%M')}."
            )

        if not registro:
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
        else:
            registro.entrada_1 = agora
            registro.status_jornada = StatusJornada.TRABALHANDO

        tipo_batida = "ENTRADA"
        mensagem = f"Entrada registrada com sucesso às {agora.strftime('%H:%M')}."

    elif tipo_alvo == "SAIDA_ALMOCO":
        if not registro or not registro.entrada_1:
            raise HTTPException(
                status_code=400,
                detail="Você precisa registrar a entrada antes de registrar a saída para almoço."
            )
        if registro.saida_almoco:
            raise HTTPException(
                status_code=400,
                detail=f"A saída para almoço já foi registrada às {registro.saida_almoco.strftime('%H:%M')}."
            )

        registro.saida_almoco = agora
        registro.status_jornada = StatusJornada.INTERVALO_ALMOCO
        delta = (agora - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        registro.minutos_trabalhados = max(0, int(delta))
        tipo_batida = "SAIDA_ALMOCO"
        mensagem = f"Saída para almoço registrada às {agora.strftime('%H:%M')}."

    elif tipo_alvo == "RETORNO_ALMOCO":
        if not registro or not registro.saida_almoco:
            raise HTTPException(
                status_code=400,
                detail="Você precisa registrar a saída para almoço antes de registrar o retorno."
            )
        if registro.retorno_almoco:
            raise HTTPException(
                status_code=400,
                detail=f"O retorno do almoço já foi registrado às {registro.retorno_almoco.strftime('%H:%M')}."
            )

        registro.retorno_almoco = agora
        registro.status_jornada = StatusJornada.TRABALHANDO
        tipo_batida = "RETORNO_ALMOCO"
        mensagem = f"Retorno do almoço registrado às {agora.strftime('%H:%M')}."

    elif tipo_alvo == "SAIDA_FINAL":
        if not registro or not registro.retorno_almoco:
            raise HTTPException(
                status_code=400,
                detail="Você precisa registrar o retorno do almoço antes de registrar a saída final."
            )
        if registro.saida_2:
            raise HTTPException(
                status_code=400,
                detail=f"A saída final de hoje já foi registrada às {registro.saida_2.strftime('%H:%M')}."
            )

        registro.saida_2 = agora
        registro.status_jornada = StatusJornada.FINALIZADA
        
        p1 = (registro.saida_almoco.replace(tzinfo=timezone.utc) - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        p2 = (agora - registro.retorno_almoco.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        total_min = max(0, int(p1 + p2))
        registro.minutos_trabalhados = total_min
        registro.saldo_minutos = total_min - registro.minutos_previstos
        tipo_batida = "SAIDA_FINAL"
        mensagem = f"Jornada finalizada às {agora.strftime('%H:%M')}. Total trabalhado: {total_min // 60}h {total_min % 60}m."

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
    """Retorna o status e os cálculos dinâmicos da jornada de trabalho de hoje"""
    hoje_str = date.today().isoformat()
    registro = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()

    is_admin = current_user.perfil == PerfilUsuario.ADMIN

    # Busca horário sugerido de referência cadastrado: prioriza usuário individual, senão perfil
    config = db.query(ConfiguracaoPonto).filter(
        ConfiguracaoPonto.empresa_id == current_user.empresa_id,
        ConfiguracaoPonto.usuario_id == current_user.id
    ).first()
    if not config:
        config = db.query(ConfiguracaoPonto).filter(
            ConfiguracaoPonto.empresa_id == current_user.empresa_id,
            ConfiguracaoPonto.perfil == current_user.perfil.value,
            ConfiguracaoPonto.usuario_id.is_(None)
        ).first()
    if not config:
        config = db.query(ConfiguracaoPonto).filter(
            ConfiguracaoPonto.empresa_id == current_user.empresa_id,
            ConfiguracaoPonto.perfil == current_user.perfil.value
        ).first()

    horario_sugerido = {
        "entrada": config.horario_entrada if config else "08:00",
        "saida_almoco": config.horario_saida_almoco if config else "12:00",
        "retorno_almoco": config.horario_retorno_almoco if config else "13:00",
        "saida_final": config.horario_saida if config else "17:00",
        "carga_minutos": config.carga_horaria_diaria_minutos if config else 480
    }

    # Previsões dinâmicas calculadas a partir da batida real de entrada
    previsoes = {
        "saida_almoco": horario_sugerido["saida_almoco"],
        "retorno_almoco": horario_sugerido["retorno_almoco"],
        "saida_final": horario_sugerido["saida_final"]
    }

    agora = datetime.now(timezone.utc)
    minutos_atuais = registro.minutos_trabalhados if registro else 0

    if registro and registro.entrada_1:
        # Se bateu entrada (a hora que for!), almoço previsto após 4 horas
        almoco_prev = registro.entrada_1 + timedelta(hours=4)
        previsoes["saida_almoco"] = almoco_prev.strftime("%H:%M")
        
        if registro.saida_almoco:
            # Retorno após mínimo de 1 hora CLT
            retorno_prev = registro.saida_almoco + timedelta(hours=1)
            previsoes["retorno_almoco"] = retorno_prev.strftime("%H:%M")
            
            if registro.retorno_almoco:
                p1_min = (registro.saida_almoco.replace(tzinfo=timezone.utc) - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
                restante_min = max(0, 480 - p1_min)
                saida_prev = registro.retorno_almoco + timedelta(minutes=restante_min)
                previsoes["saida_final"] = saida_prev.strftime("%H:%M")
                
                if registro.status_jornada == StatusJornada.TRABALHANDO:
                    p2_min = (agora - registro.retorno_almoco.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
                    minutos_atuais = int(p1_min + p2_min)
            else:
                previsoes["saida_final"] = (registro.entrada_1 + timedelta(hours=9)).strftime("%H:%M")
        else:
            previsoes["retorno_almoco"] = (registro.entrada_1 + timedelta(hours=5)).strftime("%H:%M")
            previsoes["saida_final"] = (registro.entrada_1 + timedelta(hours=9)).strftime("%H:%M")
            if registro.status_jornada == StatusJornada.TRABALHANDO:
                minutos_atuais = int((agora - registro.entrada_1.replace(tzinfo=timezone.utc)).total_seconds() / 60.0)

    # Determina próxima ação
    if not registro or not registro.entrada_1:
        proxima_acao = "ENTRADA"
        mensagem_status = "Aguardando 1ª batida (Entrada)."
    elif not registro.saida_almoco:
        proxima_acao = "SAIDA_ALMOCO"
        mensagem_status = f"Trabalhando. Almoço sugerido às {previsoes['saida_almoco']}."
    elif not registro.retorno_almoco:
        proxima_acao = "RETORNO_ALMOCO"
        mensagem_status = f"Em intervalo de almoço. Retorno sugerido às {previsoes['retorno_almoco']} (mín. 1h CLT)."
    elif not registro.saida_2:
        proxima_acao = "SAIDA_FINAL"
        mensagem_status = f"Segundo turno ativo. Previsão de saída às {previsoes['saida_final']}."
    else:
        proxima_acao = "FINALIZADO"
        mensagem_status = "Jornada de hoje 100% concluída."

    limite_maximo = 480 + (registro.horas_extras_aprovadas if registro else 0)
    jornada_estourada = minutos_atuais >= limite_maximo and registro and registro.status_jornada == StatusJornada.TRABALHANDO

    ponto_hoje_obj = None
    if registro:
        ponto_hoje_obj = {
            "id": registro.id,
            "data": registro.data,
            "entrada_1": registro.entrada_1.isoformat() if registro.entrada_1 else None,
            "saida_almoco": registro.saida_almoco.isoformat() if registro.saida_almoco else None,
            "saida_1": registro.saida_almoco.isoformat() if registro.saida_almoco else None,
            "retorno_almoco": registro.retorno_almoco.isoformat() if registro.retorno_almoco else None,
            "entrada_2": registro.retorno_almoco.isoformat() if registro.retorno_almoco else None,
            "saida_2": registro.saida_2.isoformat() if registro.saida_2 else None,
            "total_minutos_trabalhados": minutos_atuais,
            "minutos_trabalhados": minutos_atuais,
            "saldo_minutos": registro.saldo_minutos,
            "horas_extras_aprovadas": registro.horas_extras_aprovadas,
            "minutos_hora_extra_autorizada": registro.horas_extras_aprovadas,
            "status_jornada": registro.status_jornada,
            "bloqueado_clt": False if is_admin else (registro.bloqueado_clt or jornada_estourada)
        }

    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    bypass_ativo = bool(getattr(empresa, "bypass_ponto_teste", False)) if empresa else False
    isento_total = is_admin or (config and config.isento_ponto) or bypass_ativo

    pode_operar = isento_total or (
        bool(registro) and 
        registro.status_jornada == StatusJornada.TRABALHANDO and 
        not (registro.bloqueado_clt or jornada_estourada)
    )

    return {
        "possui_ponto_hoje": bool(registro),
        "registro_id": registro.id if registro else None,
        "status_jornada": registro.status_jornada if registro else "NAO_INICIADA",
        "bloqueado_clt": False if is_admin else (registro.bloqueado_clt or jornada_estourada) if registro else False,
        "isento_ponto": is_admin or (config and config.isento_ponto),
        "bypass_ativo": bypass_ativo,
        "pode_operar": pode_operar,
        "pode_testar": True,
        "proxima_acao": proxima_acao,
        "mensagem_status": mensagem_status,
        "horario_sugerido": horario_sugerido,
        "previsao_calculada": previsoes,
        "ponto_hoje": ponto_hoje_obj,
        "entrada_1": registro.entrada_1 if registro else None,
        "saida_almoco": registro.saida_almoco if registro else None,
        "saida_1": registro.saida_almoco if registro else None,
        "retorno_almoco": registro.retorno_almoco if registro else None,
        "entrada_2": registro.retorno_almoco if registro else None,
        "saida_2": registro.saida_2 if registro else None,
        "minutos_trabalhados": minutos_atuais,
        "minutos_previstos": registro.minutos_previstos if registro else 480,
        "horas_extras_aprovadas": registro.horas_extras_aprovadas if registro else 0,
        "hora_extra_autorizada": registro.horas_extras_aprovadas if registro else 0,
        "limite_restante_minutos": max(0, limite_maximo - minutos_atuais),
        "jornada_estourada": False if is_admin else jornada_estourada
    }

@router.post("/toggle-bypass-teste")
def alternar_bypass_ponto(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    """Administrador ativa ou desativa o bypass geral de ponto eletrônico para testes da equipe"""
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")

    novo_estado = not bool(getattr(empresa, "bypass_ponto_teste", False))
    empresa.bypass_ponto_teste = novo_estado
    db.commit()

    return {
        "ok": True,
        "bypass_ativo": novo_estado,
        "mensagem": f"Bypass de ponto para testes {'ATIVADO' if novo_estado else 'DESATIVADO'} com sucesso. {'Operadores e Controladores liberados para operar.' if novo_estado else 'Batida de ponto obrigatória restaurada.'}"
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

class ConfiguracaoPontoItem(BaseModel):
    id: Optional[int] = None
    empresa_id: Optional[int] = None
    perfil: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_nome: Optional[str] = None
    horario_entrada: str = "08:00"
    horario_saida_almoco: str = "12:00"
    horario_retorno_almoco: str = "13:00"
    horario_saida: str = "17:00"
    dias_trabalho: str = "SEG,TER,QUA,QUI,SEX"
    carga_horaria_diaria_minutos: int = 480
    tolerancia_minutos: int = 15
    interjornada_minima_horas: int = 11
    max_horas_extras_dia_minutos: int = 120
    isento_ponto: bool = False
    ativo: bool = True

@router.get("/configuracoes")
def listar_configuracoes_ponto(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Retorna as escalas e horários de trabalho configurados por perfil e colaborador"""
    configs = db.query(ConfiguracaoPonto).filter(
        ConfiguracaoPonto.empresa_id == current_user.empresa_id
    ).all()

    # Se ainda não existem configurações para a empresa, inicializa padrões por perfil
    perfis_existentes = {c.perfil for c in configs if c.perfil}
    padroes = [
        {
            "perfil": "ADMIN",
            "horario_entrada": "09:00",
            "horario_saida_almoco": "12:00",
            "horario_retorno_almoco": "13:00",
            "horario_saida": "18:00",
            "dias_trabalho": "SEG,TER,QUA,QUI,SEX",
            "carga_horaria_diaria_minutos": 480,
            "tolerancia_minutos": 15,
            "interjornada_minima_horas": 11,
            "max_horas_extras_dia_minutos": 120,
            "isento_ponto": True,
            "ativo": True
        },
        {
            "perfil": "OPERADOR_CAIXA",
            "horario_entrada": "08:00",
            "horario_saida_almoco": "12:00",
            "horario_retorno_almoco": "13:00",
            "horario_saida": "17:00",
            "dias_trabalho": "SEG,TER,QUA,QUI,SEX",
            "carga_horaria_diaria_minutos": 480,
            "tolerancia_minutos": 15,
            "interjornada_minima_horas": 11,
            "max_horas_extras_dia_minutos": 120,
            "isento_ponto": False,
            "ativo": True
        },
        {
            "perfil": "ESTOQUISTA",
            "horario_entrada": "07:30",
            "horario_saida_almoco": "11:30",
            "horario_retorno_almoco": "12:30",
            "horario_saida": "16:30",
            "dias_trabalho": "SEG,TER,QUA,QUI,SEX",
            "carga_horaria_diaria_minutos": 480,
            "tolerancia_minutos": 15,
            "interjornada_minima_horas": 11,
            "max_horas_extras_dia_minutos": 120,
            "isento_ponto": False,
            "ativo": True
        }
    ]

    for p in padroes:
        if p["perfil"] not in perfis_existentes:
            nova_cfg = ConfiguracaoPonto(
                empresa_id=current_user.empresa_id,
                perfil=p["perfil"],
                horario_entrada=p["horario_entrada"],
                horario_saida_almoco=p["horario_saida_almoco"],
                horario_retorno_almoco=p["horario_retorno_almoco"],
                horario_saida=p["horario_saida"],
                dias_trabalho=p["dias_trabalho"],
                carga_horaria_diaria_minutos=p["carga_horaria_diaria_minutos"],
                tolerancia_minutos=p["tolerancia_minutos"],
                interjornada_minima_horas=p["interjornada_minima_horas"],
                max_horas_extras_dia_minutos=p["max_horas_extras_dia_minutos"],
                isento_ponto=p["isento_ponto"],
                ativo=True
            )
            db.add(nova_cfg)
            db.commit()
            configs.append(nova_cfg)

    resultado = []
    for c in configs:
        resultado.append({
            "id": c.id,
            "empresa_id": c.empresa_id,
            "perfil": c.perfil,
            "usuario_id": c.usuario_id,
            "usuario_nome": c.usuario.nome if c.usuario else None,
            "horario_entrada": c.horario_entrada,
            "horario_saida_almoco": c.horario_saida_almoco,
            "horario_retorno_almoco": c.horario_retorno_almoco,
            "horario_saida": c.horario_saida,
            "dias_trabalho": c.dias_trabalho,
            "carga_horaria_diaria_minutos": c.carga_horaria_diaria_minutos or 480,
            "tolerancia_minutos": c.tolerancia_minutos or 15,
            "interjornada_minima_horas": c.interjornada_minima_horas or 11,
            "max_horas_extras_dia_minutos": c.max_horas_extras_dia_minutos or 120,
            "isento_ponto": bool(c.isento_ponto),
            "ativo": bool(c.ativo)
        })
    return resultado

@router.post("/configuracoes")
def salvar_configuracao_ponto(
    dados: ConfiguracaoPontoItem,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Cria ou atualiza a escala de horários de trabalho de um perfil ou colaborador"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem configurar jornadas e escalas de trabalho.")

    config = None
    if dados.id:
        config = db.query(ConfiguracaoPonto).filter(
            ConfiguracaoPonto.id == dados.id,
            ConfiguracaoPonto.empresa_id == current_user.empresa_id
        ).first()
    elif dados.usuario_id:
        config = db.query(ConfiguracaoPonto).filter(
            ConfiguracaoPonto.usuario_id == dados.usuario_id,
            ConfiguracaoPonto.empresa_id == current_user.empresa_id
        ).first()
    elif dados.perfil:
        config = db.query(ConfiguracaoPonto).filter(
            ConfiguracaoPonto.perfil == dados.perfil,
            ConfiguracaoPonto.usuario_id.is_(None),
            ConfiguracaoPonto.empresa_id == current_user.empresa_id
        ).first()

    if not config:
        config = ConfiguracaoPonto(
            empresa_id=current_user.empresa_id,
            perfil=dados.perfil,
            usuario_id=dados.usuario_id
        )
        db.add(config)

    config.horario_entrada = dados.horario_entrada
    config.horario_saida_almoco = dados.horario_saida_almoco
    config.horario_retorno_almoco = dados.horario_retorno_almoco
    config.horario_saida = dados.horario_saida
    config.dias_trabalho = dados.dias_trabalho
    config.carga_horaria_diaria_minutos = dados.carga_horaria_diaria_minutos
    config.tolerancia_minutos = dados.tolerancia_minutos
    config.interjornada_minima_horas = dados.interjornada_minima_horas
    config.max_horas_extras_dia_minutos = dados.max_horas_extras_dia_minutos
    config.isento_ponto = dados.isento_ponto
    config.ativo = dados.ativo

    db.commit()
    db.refresh(config)

    return {
        "ok": True,
        "mensagem": f"Escala de trabalho para {dados.perfil or 'colaborador'} atualizada com sucesso.",
        "configuracao": {
            "id": config.id,
            "perfil": config.perfil,
            "usuario_id": config.usuario_id,
            "horario_entrada": config.horario_entrada,
            "horario_saida_almoco": config.horario_saida_almoco,
            "horario_retorno_almoco": config.horario_retorno_almoco,
            "horario_saida": config.horario_saida,
            "dias_trabalho": config.dias_trabalho,
            "carga_horaria_diaria_minutos": config.carga_horaria_diaria_minutos,
            "tolerancia_minutos": config.tolerancia_minutos,
            "interjornada_minima_horas": config.interjornada_minima_horas,
            "max_horas_extras_dia_minutos": config.max_horas_extras_dia_minutos,
            "isento_ponto": config.isento_ponto,
            "ativo": config.ativo
        }
    }

@router.post("/resetar-teste")
def resetar_ponto_teste(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Permite ao Administrador resetar as batidas de teste de hoje para poder validar novas regras"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem resetar batidas em modo de teste.")
    
    hoje_str = date.today().isoformat()
    registro = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()
    if registro:
        db.delete(registro)
        db.commit()
    return {"ok": True, "mensagem": "Batidas de teste de hoje resetadas com sucesso para novas validações."}

@router.post("/simular-dia-completo")
def simular_dia_completo(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Simula um dia inteiro de trabalho (8h) com as 4 batidas para validação instantânea pelo ADM"""
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem simular jornadas.")

    hoje_str = date.today().isoformat()
    
    # Remove registro de hoje se existir
    existente = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()
    if existente:
        db.delete(existente)
        db.commit()

    base = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    e1 = base.replace(hour=8, minute=30)
    s1 = base.replace(hour=12, minute=30)
    r1 = base.replace(hour=13, minute=30)
    s2 = base.replace(hour=17, minute=30)

    reg = RegistroPonto(
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        data=hoje_str,
        entrada_1=e1,
        saida_almoco=s1,
        retorno_almoco=r1,
        saida_2=s2,
        minutos_trabalhados=480, # 8h exatas
        minutos_previstos=480,
        saldo_minutos=0,
        horas_extras_aprovadas=0,
        status_jornada=StatusJornada.FINALIZADA,
        bloqueado_clt=False,
        observacoes="Simulação de jornada completa de 8h pelo Administrador."
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    return {"ok": True, "mensagem": "Dia de trabalho completo (8h) simulado com sucesso!"}

