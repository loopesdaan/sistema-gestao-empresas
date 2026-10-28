from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.usuario import PerfilUsuario

class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    perfil: PerfilUsuario = PerfilUsuario.ADMIN
    ativo: bool = True
    foto_url: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=6, description="Senha de acesso com no mínimo 6 caracteres")
    empresa_id: Optional[int] = None

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    perfil: Optional[PerfilUsuario] = None
    ativo: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, description="Nova senha com no mínimo 6 caracteres")
    foto_url: Optional[str] = None

    @field_validator("password", mode="before")
    @classmethod
    def empty_password_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class UsuarioPerfilUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, description="Nova senha com no mínimo 6 caracteres")
    foto_url: Optional[str] = None

    @field_validator("password", mode="before")
    @classmethod
    def empty_password_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class UsuarioResponse(UsuarioBase):
    id: int
    empresa_id: int
    created_at: datetime

    class Config:
        from_attributes = True

from app.schemas.auth import Token
Token.model_rebuild()

