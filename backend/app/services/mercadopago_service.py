import os
import uuid
import time
import logging
from decimal import Decimal
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Base de mock para quando necessário em desenvolvimento
SIMULATED_PAYMENTS: Dict[str, str] = {}

class MercadoPagoService:
    """
    Serviço de Integração de Pagamentos.
    NOTA: Conforme diretriz operacional, as chamadas para APIs de gateways externos
    estão temporariamente suspensas. O sistema opera em conferência e baixa manual
    pelo operador de caixa (dinheiro, PIX estático/balcão, maquininha de cartão física e a prazo).
    """
    def __init__(self):
        # APIs externas desativadas temporariamente
        self.access_token = None
        self.sdk = None
        self.ativo = False

    def criar_cobranca_pix(
        self,
        valor: Decimal,
        descricao: str = "Venda no PDV",
        email_cliente: Optional[str] = None,
        nome_cliente: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retorna confirmação em modo manual (APIs externas suspensas)"""
        manual_id = f"MANUAL_PIX_{int(time.time())}"
        SIMULATED_PAYMENTS[manual_id] = "approved"
        
        return {
            "sucesso": True,
            "modo": "MANUAL_SUSPENSO",
            "payment_id": manual_id,
            "status": "approved",
            "qr_code": None,
            "qr_code_base64": None,
            "qr_svg": None,
            "ticket_url": None,
            "valor": float(valor)
        }

    def consultar_status_pagamento(self, payment_id: str) -> Dict[str, Any]:
        """Consulta em modo manual sempre retorna status aprovado para conferência manual"""
        return {
            "payment_id": payment_id,
            "status": "approved"
        }

    def simular_aprovacao(self, payment_id: str) -> Dict[str, Any]:
        """Confirmação imediata para desenvolvimento"""
        SIMULATED_PAYMENTS[payment_id] = "approved"
        return {"payment_id": payment_id, "status": "approved"}

    def criar_intencao_cartao(
        self,
        valor: float,
        descricao: str,
        device_id: str = "DEV_DEVICE"
    ) -> Dict[str, Any]:
        """Modo manual: Maquininhas físicas avulsas (POS/TEF), sem gateway de nuvem ativo"""
        manual_id = f"POINT_MANUAL_{int(time.time())}"
        return {
            "id": manual_id,
            "status": "APPROVED",
            "modo": "MANUAL_SUSPENSO"
        }

mp_service = MercadoPagoService()


