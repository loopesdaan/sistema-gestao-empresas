from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

class EmpresaBase(BaseModel):
    razao_social: str
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    cor_primaria: Optional[str] = None
    logo_url: Optional[str] = None

class EmpresaCreate(EmpresaBase):
    pass

class EmpresaUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    cor_primaria: Optional[str] = None
    logo_url: Optional[str] = None

class EmpresaResponse(EmpresaBase):
    id: int
    created_at: datetime
    perfil_negocio: Optional[str] = None
    modulos_ativos: Optional[str] = None  # JSON string
    onboarding_concluido: bool = False
    cep: Optional[str] = None
    cor_primaria: Optional[str] = None

    class Config:
        from_attributes = True

