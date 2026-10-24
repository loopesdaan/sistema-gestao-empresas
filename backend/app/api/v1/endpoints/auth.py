from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models.usuario import Usuario, PerfilUsuario
from app.models.empresa import Empresa
from app.schemas.auth import Token, LoginRequest
from app.schemas.usuario import UsuarioResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
def login_form(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """Login compatível com OAuth2 (Swagger) e Formulários"""
    user = db.query(Usuario).filter(Usuario.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inativo no sistema"
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "empresa_id": user.empresa_id, "perfil": user.perfil.value}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": user
    }

@router.post("/login/json", response_model=Token)
def login_json(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """Login para frontend via JSON"""
    user = db.query(Usuario).filter(Usuario.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inativo no sistema"
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "empresa_id": user.empresa_id, "perfil": user.perfil.value}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": user
    }

@router.get("/me", response_model=UsuarioResponse)
def read_current_user(current_user: Usuario = Depends(get_current_user)) -> Any:
    return current_user

@router.post("/setup-inicial")
def setup_inicial(db: Session = Depends(get_db)) -> Any:
    """Configura automaticamente uma empresa padrão e um administrador demo caso o banco esteja vazio"""
    empresa_existente = db.query(Empresa).first()
    if empresa_existente:
        return {"mensagem": "O sistema já possui uma empresa cadastrada."}

    nova_empresa = Empresa(
        razao_social="Minha Empresa Gestão LTDA",
        nome_fantasia="Loja & Serviços Modelo",
        cnpj="00.000.000/0001-00",
        telefone="(11) 99999-9999",
        email="contato@minhaempresa.com.br",
        endereco="Av. Principal, 1000 - Centro"
    )
    db.add(nova_empresa)
    db.commit()
    db.refresh(nova_empresa)

    admin = Usuario(
        empresa_id=nova_empresa.id,
        nome="Administrador",
        email="admin@gestao.com",
        hashed_password=get_password_hash("admin123"),
        perfil=PerfilUsuario.ADMIN,
        ativo=True
    )
    db.add(admin)
    db.commit()

    return {
        "sucesso": True,
        "mensagem": "Empresa e usuário admin criados com sucesso!",
        "credenciais": {
            "email": "admin@gestao.com",
            "senha_padrao": "admin123"
        }
    }

