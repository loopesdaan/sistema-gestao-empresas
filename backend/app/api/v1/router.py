from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, empresa, usuarios, clientes, produtos, estoque, caixa, vendas, os as os_router, relatorios, pagamentos,
    uploads, ponto, notificacoes, financeiro, mensagens
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(empresa.router, prefix="/empresa", tags=["Empresa"])
api_router.include_router(usuarios.router, prefix="/usuarios", tags=["Usuários"])
api_router.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
api_router.include_router(produtos.router, prefix="/produtos", tags=["Produtos"])
api_router.include_router(estoque.router, prefix="/estoque", tags=["Estoque"])
api_router.include_router(caixa.router, prefix="/caixa", tags=["Controle de Caixa"])
api_router.include_router(vendas.router, prefix="/vendas", tags=["Vendas & PDV"])
api_router.include_router(os_router.router, prefix="/os", tags=["Ordens de Serviço"])
api_router.include_router(relatorios.router, prefix="/relatorios", tags=["Gestão & Relatórios"])
api_router.include_router(pagamentos.router, prefix="/pagamentos", tags=["Pagamentos Mercado Pago"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(ponto.router, prefix="/ponto", tags=["Ponto Eletrônico CLT"])
api_router.include_router(notificacoes.router, prefix="/notificacoes", tags=["Notificações & Alertas"])
api_router.include_router(financeiro.router, prefix="/financeiro", tags=["Financeiro & Tesouraria"])
api_router.include_router(mensagens.router, prefix="/mensagens", tags=["Comunicador Interno"])


