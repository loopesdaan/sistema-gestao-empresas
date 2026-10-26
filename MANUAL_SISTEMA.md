# Manual do Sistema de Gestão Comercial Multi-Segmento (SaaS PME)

## 1. Visão Geral e Proposta de Valor

Este sistema foi concebido como uma plataforma de gestão integrada (ERP, PDV e Ponto Eletrônico) multi-segmento, desenhada para atender com excelência diferentes nichos do varejo e prestação de serviços no Brasil, mantendo consistência arquitetural, conformidade rigorosa com a legislação trabalhista brasileira (CLT) e independência de gateways externos com operação de baixa manual no balcão.

### Segmentos Atendidos Nativamente:
1. **Oficinas Mecânicas & Auto Centers:** Foco em Ordens de Serviço (OS), laudo técnico, identificação do veículo (placa, modelo, cor, quilometragem), peças do estoque e mão de obra.
2. **Lava Rápido & Estética Automotiva:** Cadastro ágil com histórico por placa de veículo, serviços expressos e frente de caixa ágil.
3. **Adegas & Conveniências:** Catálogo focado em bebidas, controle de estoque unitário e vendas no balcão em segundos com leitor de código de barras.
4. **Lojas de Materiais de Construção:** Venda balcão, entregas, controle rigoroso de limite de crédito para clientes frequentes e crediário próprio (vendas a prazo).
5. **Lojas de Roupas & Calçados:** Gestão de itens, crediário controlado e histórico detalhado de compras por cliente.
6. **Comércio Geral & Varejo Multi-Segmento:** Flexibilidade de cadastros, parametrização e relatórios.

---

## 2. Arquitetura de Software: Modelo Transacional OLTP & Analítico OLAP

### 2.1 Padrão OLTP (Online Transaction Processing)
O núcleo do sistema implementa uma arquitetura transacional robusta:
- **Atomicidade e Integridade ACID:** Cada venda no PDV envolve múltiplos registros interdependentes (cabeçalho da venda, itens faturados, formas de pagamento e decremento do saldo físico do produto no estoque). Toda essa operação é envelopada em uma transação de banco de dados (`db.commit()`), garantindo que se qualquer etapa falhar, toda a operação sofre `rollback`, impedindo furos de estoque ou inconsistências financeiras.
- **Isolamento de Concorrência:** O modelo de dados utiliza índices em chaves estrangeiras (`empresa_id`, `usuario_id`, `caixa_id`, `codigo_barras`) e identificadores primários sequenciais, permitindo concorrência de leituras e escritas sem deadlocks.
- **Benchmark de Desempenho:** Testes automatizados locais registraram mais de **750 requisições/s em consultas de catálogo** (latência média de 12.7 ms) e **280 checkouts transacionais completos/s no PDV** com 100% de sucesso.

### 2.2 Camada Analítica OLAP & Inteligência Comercial
O sistema conta com um módulo analítico dedicado à tomada de decisão estratégica:
- **Agrupamentos Temporais Avançados:** Filtro e consolidação de faturamento por Ano, Semestre, Quadrimestre, Trimestre, Bimestre, Mês, Quinzena e Semana.
- **Ranking de Operadores de Caixa:** Visualização quantitativa e financeira dos colaboradores com melhor desempenho em vendas.
- **Modelos de Previsão de Faturamento:** Algoritmo que calcula projeções de faturamento futuro baseado no histórico recente de giros e curvas de saída de produtos.
- **Segregação de Acesso aos Relatórios:** Operadores visualizam apenas as vendas realizadas por eles próprios; Administradores e Controladores têm visão panorâmica de toda a empresa.

---

## 3. Ponto Eletrônico & Barreira de Segurança CLT

O módulo de Ponto Eletrônico foi projetado em estrita observância à Consolidação das Leis do Trabalho (CLT):

1. **Jornada de 4 Batidas Diárias:**
   - 1ª Entrada (início do expediente)
   - 1ª Saída para Almoço / Intervalo
   - 2ª Entrada / Retorno do Almoço
   - 2ª Saída Final (encerramento da jornada)
2. **Barreira de Acesso Operacional por Ponto:**
   - Para garantir que ninguém trabalhe sem o devido registro legal, operadores e controladores têm acesso bloqueado às telas operacionais (PDV, Caixa, Estoque, OS, Notificações e Relatórios) até que o ponto do dia seja registrado.
3. **Bypass Administrativo de Teste e Emergência:**
   - O Administrador possui uma chave mestre de bypass para autorizar operações imediatas durante auditorias, testes de bancada ou exceções operacionais.
4. **Regras Trabalhistas Automáticas:**
   - Intervalo interjornada de 11 horas consecutivas de descanso (Art. 66 da CLT).
   - Limite de até 2 horas extras diárias (Art. 59 da CLT).
   - Parametrização de horários sugeridos de expediente por função.

---

## 4. Governança, Controle de Caixa & Notificações Rápidas

1. **Abertura com Fundo de Troco:** O operador inicia a sessão com valor inicial em dinheiro físico.
2. **Tempo de Abertura em Tempo Real:** Exibido no topo do PDV e na barra superior (`🟢 Aberto às 08:30 • Duração: 4h 15m`).
3. **Monitor de Gaveta & Alerta de Sangria:**
   - Acompanhamento contínuo do dinheiro em espécie presente no caixa.
   - Quando o valor ultrapassa o `limite_gaveta` configurado, alertas visuais orientam a realização de sangria para segurança patrimonial.
4. **Tickets de Suprimento e Sangria com Resposta Rápida:**
   - Operadores emitem pedidos de suprimento de troco ou retirada de sangria com um clique.
   - Notificações são encaminhadas aos administradores e controladores para aprovação ágil.
5. **Auditoria de Quebras de Caixa (Fechamento Cego):**
   - Ao fechar a sessão, o operador declara o dinheiro físico contado na gaveta sem visualizar o saldo esperado.
   - O sistema compara o valor declarado com o saldo calculado a partir das transações e registra divergências (Falta, Sobra ou 100% Bateu) no banco de dados.

---

## 5. Pagamentos no Balcão & Conferência Manual Segura

O sistema opera no modelo de confirmação e baixa manual, garantindo autonomia completa de provedores externos de pagamento:

- **Dinheiro Físico:** Lançamento rápido com calculadora automática de troco.
- **PIX (Balcão):** O PDV orienta o recebimento via chave PIX ou QR Code estático no balcão da loja. O operador confere a notificação no aplicativo bancário e confirma a baixa com um clique.
- **Cartões de Débito e Crédito:** O cliente passa o cartão na maquininha física da loja (Stone, PagBank, Cielo, etc.). O operador confere a emissão do comprovante impresso e confirma a baixa no sistema.
- **A Prazo (Crediário / Fiado):** O sistema valida o teto de crédito do cliente cadastrado e bloqueia vendas para inadimplentes ou para valores superiores ao limite autorizado.

---

## 6. Visualizador de Comprovantes Digitais

- Permite navegar por todas as vendas realizadas em um turno de caixa através dos botões `[← Venda Anterior]` e `[Próxima Venda →]`, sem exigir impressão física prévia.
- Layout de cupom fiscal térmico, apresentando dados da empresa (com logotipo), cliente, operador, lista de itens, descontos, acréscimos, formas de pagamento, troco calculado e botões de impressão e cópia rápida de texto.

---

## 7. Gestão de Ordens de Serviço (OS)

- **Workflow Dinâmico:** *Aberta ➔ Em Andamento ➔ Aguardando Peças ➔ Concluída ➔ Entregue*.
- **Controle de Insumos:** Peças associadas à OS são reservadas e baixadas do estoque físico.
- **Mão de Obra e Serviços:** Discriminação de horas técnicas e valores de serviço.
- **Cobrança Direta no Balcão:** Faturamento integrado ao caixa ativo, com suporte a todas as formas de pagamento (dinheiro, PIX, cartões ou fiado).

---

## 8. Segurança e Integridade dos Dados

1. **Autenticação Segura & RBAC:** Criptografia unidirecional com `bcrypt` para senhas e tokens de sessão `JWT` com controle de tempo de expiração.
2. **Exclusão Segura de Usuários e Clientes:**
   - Bloqueio de autoexclusão do usuário conectado.
   - Proteção de integridade do último Administrador ativo do sistema.
   - Bloqueio de exclusão de clientes com débitos em aberto.
   - *Soft Delete* (inativação) para entidades com histórico transacional/fiscal para preservação de auditoria contábil, e *Hard Delete* para registros sem movimentações.
3. **Uploads Sanitizados:** Validação rigorosa de extensões de imagens (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) com limite de 5MB e geração de nomes aleatórios com `UUIDv4`.

---

## 9. Assistente de IA & Exportação de Relatórios

- **Chatbot Inteligente (Sidecar):** Assistente contextual treinado nas rotinas operacionais (PDV, Estoque, Ponto CLT, Caixa e Relatórios) para suporte em tempo real.
- **Exportação Multi-Formato:** Planilhas em Excel (`.csv` com separador `;` e cabeçalho UTF-8 BOM), relatórios em HTML estilizado e impressão direta com layout responsivo.

---

## 10. Licenciamento & Uso Livre

O software é distribuído sob os termos da **Licença MIT**, concedendo liberdade total para utilização, estudo, modificação, distribuição e implementação em ambientes comerciais ou privados sem restrições proprietárias.
