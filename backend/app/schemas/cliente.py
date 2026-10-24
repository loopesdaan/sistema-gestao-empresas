from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

class ClienteBase(BaseModel):
    nome: str
    cpf_cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    placa_veiculo: Optional[str] = None
    modelo_veiculo: Optional[str] = None
    cor_veiculo: Optional[str] = None
    limite_credito: Decimal = Decimal("0.00")
    saldo_devedor: Decimal = Decimal("0.00")
    observacoes: Optional[str] = None
    ativo: bool = True

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    placa_veiculo: Optional[str] = None
    modelo_veiculo: Optional[str] = None
    cor_veiculo: Optional[str] = None
    limite_credito: Optional[Decimal] = None
    saldo_devedor: Optional[Decimal] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class ClienteResponse(ClienteBase):
    id: int
    empresa_id: int
    created_at: datetime

    class Config:
        from_attributes = True

