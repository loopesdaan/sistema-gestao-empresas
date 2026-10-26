from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from app.services.mercadopago_service import mp_service, SIMULATED_PAYMENTS
from app.api.deps import get_current_user
from app.models.usuario import Usuario

# Rastreador de consultas para simulação do Point (aprova na segunda consulta)
POINT_INTENT_CALLS: dict = {}

router = APIRouter()

class PixCreateRequest(BaseModel):
    valor: Decimal
    descricao: Optional[str] = "Venda no PDV"
    cliente_email: Optional[str] = None
    cliente_nome: Optional[str] = None

class PixResponse(BaseModel):
    sucesso: bool
    modo: str
    payment_id: str
    status: str
    qr_code: Optional[str] = None
    qr_code_base64: Optional[str] = None
    qr_svg: Optional[str] = None
    ticket_url: Optional[str] = None
    valor: float

class StatusPagamentoResponse(BaseModel):
    payment_id: str
    status: str

@router.post("/pix-qrcode", response_model=PixResponse)
def gerar_pix_qrcode(
    dados: PixCreateRequest,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Gera um QR Code PIX dinâmico via Mercado Pago"""
    if dados.valor <= 0:
        raise HTTPException(status_code=400, detail="O valor da cobrança deve ser maior que zero.")

    res = mp_service.criar_cobranca_pix(
        valor=dados.valor,
        descricao=dados.descricao or f"Venda PDV - Operador {current_user.nome}",
        email_cliente=dados.cliente_email,
        nome_cliente=dados.cliente_nome
    )
    return res

@router.get("/consultar/{payment_id}", response_model=StatusPagamentoResponse)
def consultar_pagamento(
    payment_id: str,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Verifica se o cliente já realizou o pagamento"""
    return mp_service.consultar_status_pagamento(payment_id)

@router.post("/simular-aprovacao/{payment_id}", response_model=StatusPagamentoResponse)
def simular_aprovacao_pix(
    payment_id: str,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Simula a aprovação imediata do PIX para testes em ambiente de desenvolvimento"""
    return mp_service.simular_aprovacao(payment_id)

@router.post("/webhook")
async def webhook_mercadopago(request: Request) -> Any:
    """Recebe notificações automáticas (IPN / Webhooks) do Mercado Pago"""
    try:
        payload = await request.json()
        # Notificação recebida com sucesso
        return {"status": "recebido", "action": payload.get("action")}
    except Exception:
        return {"status": "ok"}


class PointIntencaoRequest(BaseModel):
    valor: float
    descricao: str
    device_id: str = "DEV_DEVICE"


@router.post("/point-intencao")
def criar_point_intencao(
    dados: PointIntencaoRequest,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Cria intenção de pagamento via Mercado Pago Point (maquininha de cartão)"""
    if dados.valor <= 0:
        raise HTTPException(status_code=400, detail="O valor deve ser maior que zero.")
    resultado = mp_service.criar_intencao_cartao(
        valor=dados.valor,
        descricao=dados.descricao,
        device_id=dados.device_id
    )
    # Registra a intenção para simulação de status
    POINT_INTENT_CALLS[resultado["id"]] = 0
    return resultado


@router.get("/point-status/{payment_intent_id}")
def consultar_point_status(
    payment_intent_id: str,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Consulta de maquininha em modo manual: aprovação imediata."""
    return {"payment_intent_id": payment_intent_id, "status": "APPROVED", "modo": "MANUAL_SUSPENSO"}


@router.post("/point-simular/{payment_intent_id}")
def simular_aprovacao_point(
    payment_intent_id: str,
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Simula a aprovação imediata da maquininha Point em dev"""
    POINT_INTENT_CALLS[payment_intent_id] = 5
    return {"payment_intent_id": payment_intent_id, "status": "APPROVED"}


