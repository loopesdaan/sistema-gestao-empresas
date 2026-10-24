import os
import uuid
import base64
import time
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
import mercadopago
from app.core.config import settings

logger = logging.getLogger(__name__)

# Base de mock para quando o token não estiver configurado em desenvolvimento
SIMULATED_PAYMENTS: Dict[str, str] = {}

class MercadoPagoService:
    def __init__(self):
        self.access_token = settings.MERCADO_PAGO_ACCESS_TOKEN
        self.sdk = mercadopago.SDK(self.access_token) if self.access_token else None

    def criar_cobranca_pix(
        self,
        valor: Decimal,
        descricao: str = "Venda no PDV",
        email_cliente: Optional[str] = None,
        nome_cliente: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cria cobrança PIX no Mercado Pago ou gera simulação se em modo dev sem chave"""
        if self.sdk and self.access_token.strip():
            try:
                payment_data = {
                    "transaction_amount": float(valor),
                    "description": descricao,
                    "payment_method_id": "pix",
                    "payer": {
                        "email": email_cliente or "comprador@gestaopme.com.br",
                        "first_name": nome_cliente or "Consumidor Final"
                    }
                }
                payment_response = self.sdk.payment().create(payment_data)
                payment = payment_response.get("response", {})
                
                point_of_interaction = payment.get("point_of_interaction", {})
                transaction_data = point_of_interaction.get("transaction_data", {})

                return {
                    "sucesso": True,
                    "modo": "REAL",
                    "payment_id": str(payment.get("id")),
                    "status": payment.get("status", "pending"),
                    "qr_code": transaction_data.get("qr_code"),
                    "qr_code_base64": transaction_data.get("qr_code_base64"),
                    "ticket_url": transaction_data.get("ticket_url"),
                    "valor": float(valor)
                }
            except Exception as e:
                logger.error(f"Erro na API do Mercado Pago: {e}. Alternando para simulação de desenvolvimento.")

        # Fallback / Modo Desenvolvimento Simulado
        mock_id = str(uuid.uuid4())[:8]
        SIMULATED_PAYMENTS[mock_id] = "pending"
        
        # QR Code base64 simples de placeholder para desenvolvimento
        mock_qr_code = f"00020126580014BR.GOV.BCB.PIX0136{mock_id}-gestao-dev5204000053039865405{float(valor):.2f}5802BR5925GESTAO PME COMERCIO6009SAO PAULO62070503***6304"
        
        # SVG gerado e convertido para base64
        svg_qr = f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8fafc"/><rect x="20" y="20" width="50" height="50" fill="#0284c7"/><rect x="130" y="20" width="50" height="50" fill="#0284c7"/><rect x="20" y="130" width="50" height="50" fill="#0284c7"/><rect x="90" y="90" width="20" height="20" fill="#0ea5e9"/><rect x="130" y="130" width="40" height="40" fill="#0284c7"/><text x="100" y="105" font-size="11" text-anchor="middle" fill="#0369a1" font-family="sans-serif" font-weight="bold">PIX DEV</text></svg>'
        
        # Gera imagem PNG real do QR Code via biblioteca qrcode para compatibilidade total
        try:
            import io
            import qrcode
            qr = qrcode.QRCode(box_size=6, border=2)
            qr.add_data(mock_qr_code)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            mock_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        except Exception as err:
            logger.warning(f"Não foi possível gerar QR PNG com biblioteca qrcode: {err}")
            mock_base64 = base64.b64encode(svg_qr.encode('utf-8')).decode('utf-8')

        return {
            "sucesso": True,
            "modo": "SIMULACAO_DEV",
            "payment_id": mock_id,
            "status": "pending",
            "qr_code": mock_qr_code,
            "qr_code_base64": mock_base64,
            "qr_svg": svg_qr,
            "ticket_url": None,
            "valor": float(valor)
        }

    def consultar_status_pagamento(self, payment_id: str) -> Dict[str, Any]:
        """Consulta o status atual do pagamento no Mercado Pago"""
        if self.sdk and self.access_token.strip() and not payment_id.isalnum() and len(payment_id) > 10:
            try:
                payment_response = self.sdk.payment().get(int(payment_id))
                payment = payment_response.get("response", {})
                return {
                    "payment_id": payment_id,
                    "status": payment.get("status", "pending")
                }
            except Exception as e:
                logger.error(f"Erro ao consultar pagamento no Mercado Pago: {e}")

        # Consulta mock
        status = SIMULATED_PAYMENTS.get(payment_id, "approved")
        return {
            "payment_id": payment_id,
            "status": status
        }

    def simular_aprovacao(self, payment_id: str) -> Dict[str, Any]:
        """Força a aprovação para testes no ambiente de desenvolvimento"""
        SIMULATED_PAYMENTS[payment_id] = "approved"
        return {"payment_id": payment_id, "status": "approved"}

    def criar_intencao_cartao(
        self,
        valor: float,
        descricao: str,
        device_id: str = "DEV_DEVICE"
    ) -> Dict[str, Any]:
        """Cria intenção de pagamento via Mercado Pago Point (maquininha)"""
        if self.sdk and self.access_token.strip():
            try:
                payload = {
                    "amount": int(valor * 100),
                    "additional_info": {"external_reference": f"PDV_{int(time.time())}"},
                    "description": descricao,
                    "payment": {"installments": 1, "type": "credit_card"},
                    "type": "payment_intent"
                }
                response = self.sdk.point().create_payment_intent(device_id, payload)
                data = response.get("response", {})
                return {
                    "id": str(data.get("id", f"POINT_INTENT_{int(time.time())}")),
                    "status": data.get("state", "OPEN"),
                    "modo": "REAL"
                }
            except Exception as e:
                logger.error(f"Erro ao criar intenção de cartão no Mercado Pago Point: {e}")

        # Modo simulação
        return {
            "id": f"POINT_INTENT_{int(time.time())}",
            "status": "OPEN",
            "modo": "SIMULACAO_DEV"
        }

mp_service = MercadoPagoService()

