# Sistema de Gestão Empresarial, PDV & Ponto Eletrônico (SaaS PME)

[![Licença MIT](https://img.shields.io/badge/licença-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg)](https://tailwindcss.com/)

Sistema completo de gestão comercial, frente de caixa (PDV), controle de estoque, ordens de serviço (OS) e ponto eletrônico em conformidade com a legislação trabalhista brasileira (CLT). Projetado com arquitetura transacional **OLTP** de alta performance e camada analítica **OLAP** para tomada de decisão em pequenos e médios negócios.

---

## 🎯 Segmentos Atendidos Nativamente

O sistema se adapta às particularidades de diferentes nichos com terminologias e fluxos customizados:

1. **Oficinas Mecânicas & Auto Centers:** Ordens de Serviço (OS), identificação veicular (placa, modelo, cor, km), laudo de defeito relatado, peças e serviços.
2. **Lava Rápido & Estética Automotiva:** Controle ágil por placa de veículo, serviços expressos e faturamento rápido no balcão.
3. **Adegas & Conveniências:** Catálogo por unidade/fardo, leitor de código de barras e vendas ultrarrápidas no PDV.
4. **Lojas de Materiais de Construção:** Venda balcão, entregas, controle rigoroso de limite de crédito e vendas a prazo (crediário próprio).
5. **Lojas de Roupas & Calçados:** Gestão de itens, perfil de cliente e controle de cobrança de fiado.
6. **Comércio Geral & Varejo Multi-Segmento:** Gestão unificada de produtos, clientes e finanças.

---

## 🚀 Funcionalidades Principais

### 1. Frente de Caixa (PDV) & Baixa de Pagamentos
- **Venda Rápida:** Lançamento via leitor de código de barras ou busca preditiva inteligente.
- **Formas de Pagamento no Balcão:**
  - **Dinheiro:** Calculadora de troco automática.
  - **PIX (Balcão):** Exibição de instruções e confirmação com baixa manual após conferência no app/extrato bancário da empresa.
  - **Cartão de Crédito e Débito:** Operação com maquininhas físicas avulsas (POS/TEF da loja) e baixa imediata pelo operador.
  - **A Prazo (Fiado / Crediário):** Validação automática de teto de crédito do cliente e bloqueio de inadimplentes.
- **Visualizador de Comprovantes Digitais:** Navegação cronológica entre cupons térmicos do turno (`[← Venda Anterior]` e `[Próxima Venda →]`), com layout térmico pronto para impressão ou cópia.
- **Importação de OS para o Carrinho:** Faturamento de ordens de serviço finalizadas direto no PDV.

### 2. Controle e Auditoria de Caixa
- **Abertura de Caixa:** Registro obrigatório com suprimento inicial (fundo de troco).
- **Monitor de Gaveta em Tempo Real:** Alerta visual e sonoro de teto de gaveta (`limite_gaveta`), prevenindo excesso de dinheiro físico em caixa.
- **Tickets Rápidos de Suprimento e Sangria:**
  - Solicitação rápida pelo operador direto na tela de caixa.
  - Painel de aprovação para administradores e controladores responderem em tempo real.
- **Fechamento Cego:** O operador faz a contagem física do dinheiro sem visualizar o esperado. O sistema apura divergências (*Bateu*, *Sobra* ou *Falta*) e salva o histórico permanente para auditoria.

### 3. Ponto Eletrônico & Barreira CLT
- **4 Batidas Diárias:** Entrada matutina, Saída p/ almoço, Retorno do almoço e Saída vespertina.
- **Barreira de Trabalho Obrigatória:** Operadores e Controladores só conseguem operar o sistema (PDV, Caixa, Estoque, OS, Notificações e Relatórios) se o ponto estiver batido no dia.
- **Bypass de Teste e Emergência:** Função administrativa segura para testes ou exceções justificadas pela gerência.
- **Regras Trabalhistas (CLT):**
  - Validação de intervalo interjornada de 11 horas (Art. 66).
  - Alerta de limite diário de até 2 horas extras (Art. 59).
  - Configuração de horários sugeridos de expediente por função.

### 4. Controle de Acesso Baseado em Perfis (RBAC)
- **Administrador:** Acesso total, gerenciamento de usuários, configuração da empresa, auditoria geral de caixas, bypass de ponto e relatórios executivos.
- **Controlador (Gerência / Fiscal de Loja):** Supervisão de turnos, resposta a sangrias/suprimentos, acompanhamento de equipe e auditoria operacional.
- **Operador (Balcão / Caixa):** Foco operacional no PDV, abertura e fechamento de seu caixa, criação e faturamento de OS e visualização restrita às suas próprias vendas.

### 5. Camada Analítica OLAP & Relatórios Inteligentes
- **Visão Segregada:** Operadores visualizam o extrato de suas vendas; Administradores e Controladores acessam a visão consolidada de toda a empresa.
- **Agrupamentos Temporais:** Análise por Ano, Semestre, Quadrimestre, Trimestre, Bimestre, Mês, Quinzena e Semana.
- **Ranking de Operadores:** Identificação dos colaboradores com maior faturamento e volume de itens comercializados.
- **Projeção de Faturamento:** Modelos preditivos de receita calculados a partir da curva de giro dos produtos.
- **Exportação Multi-Formato:** Download instantâneo em **Excel (.csv com UTF-8 BOM)**, HTML estilizado e impressão em PDF.

### 6. Ordens de Serviço (OS)
- Workflow completo de estados: *Aberta ➔ Em Andamento ➔ Aguardando Peças ➔ Concluída ➔ Entregue/Faturada*.
- Inclusão de laudo técnico, peças consumidas do estoque e valor de serviços.
- Impressão formatada para a entrega ao cliente na bancada.

### 7. Gestão de Estoque & Clientes
- **Estoque:** Alertas visuais de estoque baixo/zerado, histórico de movimentações (entrada, saída, perda e ajuste) e importação em lote via planilha Excel.
- **Clientes:** Cadastro unificado, saldo devedor atualizado em tempo real e histórico de compras.
- **Exclusão Segura (Soft Delete / Hard Delete):** Proteção do usuário logado contra autoexclusão, blindagem do último administrador, bloqueio de remoção de clientes com dívidas em aberto e inativação segura para registros com histórico financeiro/fiscal.

### 8. Assistente de IA & Tour Interativo
- **Chatbot Flutuante:** Treinado com o manual e as regras de negócio de cada módulo para tirar dúvidas rápidas dos operadores.
- **Tour de Boas-Vindas:** Apresentação visual interativa do fluxo do sistema para novos usuários.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologias |
| :--- | :--- |
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy, Pydantic v2, ReportLab, OpenPyXL, PyJWT, Passlib (bcrypt) |
| **Banco de Dados** | PostgreSQL 16 (produção) com fallback automático para SQLite (desenvolvimento) |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Axios, PWA |

---

## ⚡ Como Rodar o Projeto

### Opção 1: Inicialização em 1 Comando (Recomendado)
Na raiz do projeto, execute o script de automação:
```bash
./dev.sh
```
O script verifica o ambiente, prepara as dependências e inicializa o **Backend na porta 8000** e o **Frontend na porta 5173**.

---

### Opção 2: Inicialização Manual

#### 1. Backend (FastAPI)
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API ativa em: `http://localhost:8000`
- Documentação interativa (Swagger UI): `http://localhost:8000/docs`

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- Aplicação ativa em: `http://localhost:5173`

---

## 🔑 Credenciais Pré-Configuradas para Testes

O banco de dados inicializa automaticamente com dados e usuários de demonstração:

| Perfil | E-mail | Senha | Nível de Acesso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@gestao.com` | `admin123` | Acesso Irrestrito / Gerência Geral |
| **Controlador** | `fiscal@gestao.com` | `fiscal123` | Supervisão / Caixa / Relatórios |
| **Operador de Caixa** | `caixa@gestao.com` | `caixa123` | Frente de Caixa (PDV) / OS / Meu Caixa |

---

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** — consulte o arquivo [LICENSE](LICENSE) para obter detalhes completos. Você tem liberdade para utilizar, modificar, distribuir e integrar este software em seus próprios projetos comerciais ou pessoais.
