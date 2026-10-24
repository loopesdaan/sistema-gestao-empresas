from typing import Optional
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioResponse"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    empresa_id: Optional[int] = None
    perfil: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

