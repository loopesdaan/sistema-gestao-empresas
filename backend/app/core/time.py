from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Optional

# Fuso horário oficial de Brasília / Brasil (Art. 58 CLT / Portaria 671 MTP)
TZ_BRASIL = ZoneInfo("America/Sao_Paulo")

def agora_brasil() -> datetime:
    """
    Retorna datetime naive correspondente ao momento atual no fuso horário oficial de Brasília (UTC-3).
    Garante que registros de ponto, caixa e vendas reflitam a hora real do Brasil
    independentemente do fuso horário do servidor em nuvem (Render, AWS, etc.).
    """
    return datetime.now(TZ_BRASIL).replace(tzinfo=None)

def hoje_brasil_str() -> str:
    """
    Retorna a data atual no formato YYYY-MM-DD no fuso horário de Brasília.
    Evita virada de data prematura às 21h em servidores UTC.
    """
    return datetime.now(TZ_BRASIL).date().isoformat()

def to_brasil_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Normaliza qualquer datetime (com ou sem fuso horário) para naive no Horário de Brasília.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(TZ_BRASIL).replace(tzinfo=None)
    return dt
