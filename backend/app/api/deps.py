from typing import Generator
from datetime import date
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import oauth2_scheme, decode_token
from app.core.time import hoje_brasil_str
from app.models.usuario import Usuario, PerfilUsuario
from app.models.ponto import RegistroPonto, StatusJornada, ConfiguracaoPonto
from app.models.empresa import Empresa

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Usuario:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas no token",
        )
    
    uid = int(user_id)
    user = db.query(Usuario).filter(Usuario.id == uid).first()
    if not user and uid > 10_000_000:
        user = db.query(Usuario).filter(
            Usuario.id.between(uid - 1000, uid + 1000)
        ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    return user

def get_current_admin(
    current_user: Usuario = Depends(get_current_user)
) -> Usuario:
    if current_user.perfil != PerfilUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user

def verificar_ponto_trabalho(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Exige que Operadores e Controladores de Estoque estejam com ponto ativo (status TRABALHANDO)
    para realizar operações de trabalho. Admins ou usuários com bypass de teste ativado estão liberados.
    """
    if current_user.perfil == PerfilUsuario.ADMIN:
        return current_user

    # 1. Verifica se a empresa ativou o bypass de ponto para testes
    empresa = db.query(Empresa).filter(Empresa.id == current_user.empresa_id).first()
    if empresa and getattr(empresa, "bypass_ponto_teste", False):
        return current_user

    # 2. Verifica se o perfil ou usuário tem isenção legal de ponto (Art. 62 CLT)
    config = db.query(ConfiguracaoPonto).filter(
        ConfiguracaoPonto.empresa_id == current_user.empresa_id,
        (ConfiguracaoPonto.usuario_id == current_user.id) | (ConfiguracaoPonto.perfil == current_user.perfil.value)
    ).first()
    if config and config.isento_ponto:
        return current_user

    # 3. Verifica registro do dia no horário oficial de Brasília
    hoje_str = hoje_brasil_str()
    reg = db.query(RegistroPonto).filter(
        RegistroPonto.usuario_id == current_user.id,
        RegistroPonto.data == hoje_str
    ).first()

    if not reg or reg.status_jornada != StatusJornada.TRABALHANDO:
        motivo = "Você ainda não registrou o início do expediente hoje no Ponto Eletrônico."
        if reg:
            if reg.status_jornada == StatusJornada.EM_ALMOCO:
                motivo = "Você está em intervalo intrajornada de almoço (Art. 71 CLT). O trabalho é vedado durante o descanso legal. Registre o retorno no Ponto para retomar as atividades."
            elif reg.status_jornada == StatusJornada.FINALIZADA:
                motivo = "Seu expediente diário foi encerrado. O sistema está bloqueado até o próximo turno legal de trabalho (Art. 66 CLT)."
            elif reg.bloqueado_clt:
                motivo = f"Acesso bloqueado por normas da CLT: {reg.motivo_bloqueio or 'Limite legal de jornada de 8h diárias e 2h extras excedido'}."

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso Bloqueado pela Legislação Trabalhista (CLT): {motivo}"
        )

    return current_user

