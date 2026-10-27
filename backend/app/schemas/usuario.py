from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.usuario import PerfilUsuario

class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    perfil: PerfilUsuario = PerfilUsuario.ADMIN
    ativo: bool = True
    foto_url: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    password: str
    empresa_id: Optional[int] = None

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    perfil: Optional[PerfilUsuario] = None
    ativo: Optional[bool] = None
    password: Optional[str] = None
    foto_url: Optional[str] = None

class UsuarioPerfilUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    foto_url: Optional[str] = None

class UsuarioResponse(UsuarioBase):
    id: int
    empresa_id: int
    created_at: datetime

    class Config:
        from_attributes = True

from app.schemas.auth import Token
Token.model_rebuild()

