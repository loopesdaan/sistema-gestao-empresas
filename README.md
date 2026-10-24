# Sistema de Gestão Empresarial & PDV Online

Sistema de gestão completo, leve e intuitivo voltado para pequenos e médios negócios (comércio, oficinas, assistência técnica e serviços).

Desenvolvido com **Python (FastAPI)**, **PostgreSQL** e **React (Vite + Tailwind CSS)** com suporte a **PWA** (acesso em celular, tablet e computador).

---

## 🚀 Funcionalidades Principais

- **Vendas (Frente de Caixa / PDV):**
  - Registro ágil de vendas por código de barras ou busca por nome
  - Formas de pagamento: **Dinheiro** (com cálculo automático de troco), **PIX Dinâmico com Mercado Pago**, **Cartão de Crédito**, **Cartão de Débito** e **A Prazo (Fiado)**
  - Validação de limite de crédito do cliente para vendas a prazo
  - **Integração Mercado Pago:** Geração de QR Code PIX dinâmico com chave copia-e-cola e confirmação automática em tempo real (com modo de simulação para desenvolvimento e suporte a credenciais reais `MERCADO_PAGO_ACCESS_TOKEN`)
- **Controle de Caixa:**
  - Abertura de caixa com fundo de troco (suprimento inicial)
  - Lançamento de Sangrias e Suprimentos com justificativa
  - Fechamento com conferência cega e apuração de quebra/sobra
- **Produtos & Estoque:**
  - Cadastro com preço de custo, preço de venda, código de barras e estoque mínimo
  - Alerta visual no dashboard para produtos com estoque baixo ou zerado
  - **Importação em lote via planilha Excel (.xlsx)**
  - Movimentações manuais de entrada, saída e ajuste de inventário
- **Ordens de Serviço (OS):**
  - Workflow de status: *Aberta ➔ Em Andamento ➔ Aguardando Peças ➔ Concluída ➔ Entregue*
  - Consumo de peças do estoque e cobrança de mão de obra
- **Clientes & Controle de Fiado:**
  - Histórico de compras e ordens de serviço
  - Limite de crédito e saldo devedor em tempo real
- **Gestão & Relatórios:**
  - Dashboard em tempo real com faturamento do dia, mês, ticket médio e gráfico dos últimos 7 dias
  - Ranking dos 5 produtos mais vendidos
  - Cancelamento de vendas com estorno automático de estoque e crédito

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Python 3.12+ / FastAPI / SQLAlchemy / Pydantic / PyJWT / OpenPyXL
- **Banco de Dados:** PostgreSQL 16 (com fallback automático para SQLite em desenvolvimento caso o PostgreSQL esteja desligado)
- **Frontend:** React 18 / TypeScript / Vite / Tailwind CSS / Lucide Icons / PWA Manifest

---

## ⚡ Como Rodar o Projeto

### 1. Inicialização Rápida (1 comando)

No terminal raiz do projeto, execute:
```bash
./dev.sh
```
Isso iniciará o **Backend na porta 8000** e o **Frontend na porta 5173**.

---

### 2. Inicialização Manual Passo a Passo

#### A. Backend (FastAPI)
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
- A API estará rodando em: `http://localhost:8000`
- Documentação interativa Swagger: `http://localhost:8000/docs`

#### B. Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
- Acesse no navegador: `http://localhost:5173`

---

## 🐘 Banco de Dados PostgreSQL (Opcional via Docker)

Para subir o banco de dados PostgreSQL persistente via Docker:
```bash
docker compose up -d
```
> **Nota:** Caso você não queira iniciar o Docker agora, a aplicação utiliza automaticamente um banco local SQLite (`backend/gestao.db`), permitindo testar tudo imediatamente sem pré-requisitos!

---

## 🔑 Credenciais de Demonstração (Já criadas no banco)

O sistema inicializa automaticamente com dados e produtos modelo para teste:

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin@gestao.com` | `admin123` |
| **Operador de Caixa** | `caixa@gestao.com` | `caixa123` |

