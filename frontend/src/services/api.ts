import axios from 'axios';
import { 
  Usuario, Empresa, Produto, Cliente, Caixa, ResumoCaixa, 
  Venda, OrdemServico, DashboardMetrics, FormaPagamento, StatusOS 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor para injetar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gestao_token') || sessionStorage.getItem('gestao_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de erro 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('gestao_token');
      localStorage.removeItem('gestao_user');
      sessionStorage.removeItem('gestao_token');
      sessionStorage.removeItem('gestao_user');
    }
    return Promise.reject(error);
  }
);

// Endpoints da API
export const apiService = {
  // Autenticação
  login: async (email: string, password: string, lembrar: boolean = false) => {
    const res = await api.post('/auth/login/json', { email, password });
    if (res.data.access_token) {
      const storage = lembrar ? localStorage : sessionStorage;
      // Limpa do outro storage para evitar inconsistências
      localStorage.removeItem('gestao_token');
      localStorage.removeItem('gestao_user');
      sessionStorage.removeItem('gestao_token');
      sessionStorage.removeItem('gestao_user');

      storage.setItem('gestao_token', res.data.access_token);
      storage.setItem('gestao_user', JSON.stringify(res.data.usuario));
    }
    return res.data;
  },
  getCurrentUser: async (): Promise<Usuario> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('gestao_token');
    localStorage.removeItem('gestao_user');
    sessionStorage.removeItem('gestao_token');
    sessionStorage.removeItem('gestao_user');
  },

  // Empresa
  getEmpresa: async (): Promise<Empresa> => {
    const res = await api.get('/empresa');
    return res.data;
  },
  updateEmpresa: async (dados: Partial<Empresa>): Promise<Empresa> => {
    const res = await api.put('/empresa', dados);
    return res.data;
  },

  // Usuários (Apenas Admin)
  listarUsuarios: async (): Promise<Usuario[]> => {
    const res = await api.get('/usuarios');
    return res.data;
  },
  criarUsuario: async (usuario: Partial<Usuario> & { password?: string }): Promise<Usuario> => {
    const res = await api.post('/usuarios', usuario);
    return res.data;
  },
  atualizarUsuario: async (id: number, usuario: Partial<Usuario> & { password?: string }): Promise<Usuario> => {
    const res = await api.put(`/usuarios/${id}`, usuario);
    return res.data;
  },
  excluirUsuario: async (id: number): Promise<{ ok: boolean; tipo: string; mensagem: string }> => {
    const res = await api.delete(`/usuarios/${id}`);
    return res.data;
  },

  // Produtos
  listarProdutos: async (busca?: string, apenasEstoqueBaixo?: boolean): Promise<Produto[]> => {
    const params: Record<string, any> = {};
    if (busca) params.q = busca;
    if (apenasEstoqueBaixo) params.apenas_estoque_baixo = true;
    const res = await api.get('/produtos', { params });
    return res.data;
  },
  buscarPorCodigoBarras: async (codigo: string): Promise<Produto> => {
    const res = await api.get(`/produtos/codigo-barras/${codigo}`);
    return res.data;
  },
  criarProduto: async (produto: Partial<Produto>): Promise<Produto> => {
    const res = await api.post('/produtos', produto);
    return res.data;
  },
  atualizarProduto: async (id: number, produto: Partial<Produto>): Promise<Produto> => {
    const res = await api.put(`/produtos/${id}`, produto);
    return res.data;
  },

  // Estoque
  movimentarEstoque: async (dados: { produto_id: number; tipo: string; quantidade: number; motivo?: string }) => {
    const res = await api.post('/estoque/movimentar', dados);
    return res.data;
  },
  getTodasMovimentacoesEstoque: async (limit: number = 100) => {
    const res = await api.get(`/estoque/todas-movimentacoes?limit=${limit}`);
    return res.data;
  },
  getDashboardEstoqueMetricas: async () => {
    const res = await api.get('/estoque/dashboard-metricas');
    return res.data;
  },
  importarPlanilha: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/estoque/importar-planilha', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  // Clientes
  listarClientes: async (busca?: string): Promise<Cliente[]> => {
    const params: Record<string, any> = {};
    if (busca) params.q = busca;
    const res = await api.get('/clientes', { params });
    return res.data;
  },
  criarCliente: async (cliente: Partial<Cliente>): Promise<Cliente> => {
    const res = await api.post('/clientes', cliente);
    return res.data;
  },
  atualizarCliente: async (id: number, cliente: Partial<Cliente>): Promise<Cliente> => {
    const res = await api.put(`/clientes/${id}`, cliente);
    return res.data;
  },
  excluirCliente: async (id: number): Promise<{ ok: boolean; tipo: string; mensagem: string }> => {
    const res = await api.delete(`/clientes/${id}`);
    return res.data;
  },

  // Caixa
  getCaixaAtual: async (): Promise<Caixa | null> => {
    const res = await api.get('/caixa/atual');
    return res.data;
  },
  getCaixasAbertos: async (): Promise<Caixa[]> => {
    const res = await api.get('/caixa/abertos');
    return res.data;
  },
  abrirCaixa: async (saldoInicial: number, observacoes?: string): Promise<Caixa> => {
    const res = await api.post('/caixa/abrir', { saldo_inicial: saldoInicial, observacoes });
    return res.data;
  },
  movimentarCaixa: async (tipo: 'SANGRIA' | 'SUPRIMENTO', valor: number, motivo: string, caixaId?: number) => {
    const res = await api.post('/caixa/movimentacao', { tipo, valor, motivo, caixa_id: caixaId });
    return res.data;
  },
  getResumoCaixa: async (caixaId: number): Promise<ResumoCaixa> => {
    const res = await api.get(`/caixa/resumo/${caixaId}`);
    return res.data;
  },
  fecharCaixa: async (caixaId: number, saldoFinalInformado: number, observacoes?: string): Promise<ResumoCaixa> => {
    const res = await api.post(`/caixa/fechar/${caixaId}`, { saldo_final_informado: saldoFinalInformado, observacoes });
    return res.data;
  },
  getHistoricoCaixa: async (status?: string): Promise<Caixa[]> => {
    const res = await api.get('/caixa/historico', { params: status ? { status } : {} });
    return res.data;
  },

  // Vendas
  registrarVenda: async (dados: {
    caixa_id: number;
    cliente_id?: number | null;
    desconto?: number;
    acrescimo?: number;
    itens: Array<{ produto_id: number; quantidade: number; valor_unitario: number }>;
    pagamentos: Array<{ forma_pagamento: FormaPagamento; valor: number; troco?: number }>;
    observacoes?: string;
  }): Promise<Venda> => {
    const res = await api.post('/vendas', dados);
    return res.data;
  },
  listarVendas: async (): Promise<Venda[]> => {
    const res = await api.get('/vendas');
    return res.data;
  },
  cancelarVenda: async (vendaId: number, motivo?: string): Promise<Venda> => {
    const res = await api.post(`/vendas/${vendaId}/cancelar`, null, { params: { motivo } });
    return res.data;
  },

  // Ordem de Serviço
  listarOS: async (status?: StatusOS): Promise<OrdemServico[]> => {
    const params: Record<string, any> = {};
    if (status) params.status = status;
    const res = await api.get('/os', { params });
    return res.data;
  },
  obterOS: async (osId: number): Promise<OrdemServico> => {
    const res = await api.get(`/os/${osId}`);
    return res.data;
  },
  criarOS: async (dados: {
    cliente_id: number;
    titulo: string;
    equipamento?: string;
    defeito_relatado?: string;
    valor_servicos: number;
    previsao_entrega?: string;
    itens?: Array<{ produto_id: number; quantidade: number; valor_unitario: number }>;
  }): Promise<OrdemServico> => {
    const res = await api.post('/os', dados);
    return res.data;
  },
  atualizarOS: async (osId: number, dados: Partial<OrdemServico>): Promise<OrdemServico> => {
    const res = await api.put(`/os/${osId}`, dados);
    return res.data;
  },
  faturarOS: async (osId: number, dados: {
    caixa_id: number;
    pagamentos: Array<{ forma_pagamento: string; valor: number; troco?: number }>;
    desconto?: number;
    observacoes?: string;
  }): Promise<{ mensagem: string; os: OrdemServico; venda_id: number; valor_pago: number }> => {
    const res = await api.post(`/os/${osId}/faturar`, dados);
    return res.data;
  },

  // Relatórios e Dashboard
  getDashboard: async (): Promise<DashboardMetrics> => {
    const res = await api.get('/relatorios/dashboard');
    return res.data;
  },

  // Pagamentos Mercado Pago
  gerarPixQRCode: async (dados: { valor: number; descricao?: string; cliente_email?: string; cliente_nome?: string }) => {
    const res = await api.post('/pagamentos/pix-qrcode', dados);
    return res.data;
  },
  consultarStatusPagamento: async (paymentId: string) => {
    const res = await api.get(`/pagamentos/consultar/${paymentId}`);
    return res.data;
  },
  simularAprovacaoPix: async (paymentId: string) => {
    const res = await api.post(`/pagamentos/simular-aprovacao/${paymentId}`);
    return res.data;
  },

  // Pagamentos com cartão (Point)
  criarIntencaoCartao: async (valor: number, descricao: string, deviceId: string = 'DEV_DEVICE') => {
    const { data } = await api.post('/pagamentos/point-intencao', { valor, descricao, device_id: deviceId });
    return data;
  },
  consultarStatusPoint: async (paymentIntentId: string) => {
    const { data } = await api.get(`/pagamentos/point-status/${paymentIntentId}`);
    return data;
  },
  simularAprovacaoPoint: async (paymentIntentId: string) => {
    const { data } = await api.post(`/pagamentos/point-simular/${paymentIntentId}`);
    return data;
  },
  salvarOnboarding: async (dados: {
    perfil_negocio: string;
    modulos_ativos: string[];
    nome_fantasia?: string;
    razao_social?: string;
    cnpj?: string;
    telefone?: string;
    endereco?: string;
    cep?: string;
    cor_primaria?: string;
    aplicar_dados_demo?: boolean;
  }) => {
    const { data } = await api.put('/empresa/onboarding', dados);
    return data;
  },

  // Consulta gratuita de CEP
  buscarCep: async (cep: string) => {
    try {
      const limpo = cep.replace(/\D/g, '');
      if (limpo.length !== 8) return null;
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (data.erro) return null;
      return {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
        cep: data.cep || '',
        enderecoCompleto: `${data.logradouro || ''}, ${data.bairro || ''} - ${data.localidade || ''}/${data.uf || ''}`.replace(/^, /, '')
      };
    } catch {
      return null;
    }
  },

  // Aplicar catálogo e clientes modelo por segmento
  aplicarPresetSegmento: async (perfilNegocio: string) => {
    const { data } = await api.post('/empresa/aplicar-preset-segmento', { perfil_negocio: perfilNegocio });
    return data;
  },

  // Uploads
  uploadImagem: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/uploads/imagem', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  // Ponto Eletrônico CLT
  baterPonto: async (payload?: { tipo_batida?: string; hora_personalizada?: string } | string) => {
    const dados = typeof payload === 'string' ? { tipo_batida: payload } : (payload || {});
    const { data } = await api.post('/ponto/bater', dados);
    return data;
  },
  getStatusPontoHoje: async () => {
    const { data } = await api.get('/ponto/status-hoje');
    return data;
  },
  getHistoricoPonto: async (dias: number = 30) => {
    const { data } = await api.get(`/ponto/meu-historico?dias=${dias}`);
    return data;
  },
  getEquipeAuditoriaPonto: async (dataConsulta?: string) => {
    const url = dataConsulta ? `/ponto/equipe-auditoria?data_consulta=${dataConsulta}` : '/ponto/equipe-auditoria';
    const { data } = await api.get(url);
    return data;
  },
  aprovarHoraExtra: async (registro_id: number, minutos_aprovados: number, motivo?: string) => {
    const { data } = await api.post('/ponto/aprovar-hora-extra', { registro_id, minutos_aprovados, motivo });
    return data;
  },
  getConfiguracoesPonto: async (): Promise<any[]> => {
    const { data } = await api.get('/ponto/configuracoes');
    return data;
  },
  salvarConfiguracaoPonto: async (dados: any) => {
    const { data } = await api.post('/ponto/configuracoes', dados);
    return data;
  },
  resetarPontoTeste: async () => {
    const { data } = await api.post('/ponto/resetar-teste');
    return data;
  },
  simularDiaCompleto: async () => {
    const { data } = await api.post('/ponto/simular-dia-completo');
    return data;
  },

  // Caixa - Tickets & Monitor em Tempo Real
  solicitarTicketCaixa: async (caixaId: number, dados: { tipo: string; valor?: number; valor_solicitado?: number; justificativa?: string; motivo?: string }) => {
    const payload = {
      tipo: dados.tipo,
      valor: dados.valor ?? dados.valor_solicitado,
      valor_solicitado: dados.valor_solicitado ?? dados.valor,
      justificativa: dados.justificativa ?? dados.motivo,
      motivo: dados.motivo ?? dados.justificativa
    };
    const { data } = await api.post(`/caixa/${caixaId}/solicitar-ticket`, payload);
    return data;
  },
  getTicketsPendentes: async () => {
    const { data } = await api.get('/caixa/solicitacoes/pendentes');
    return data;
  },
  responderTicketCaixa: async (ticketId: number, aprovado: boolean, valorEfetivo?: number, observacao?: string) => {
    const { data } = await api.post(`/caixa/solicitacoes/${ticketId}/responder`, {
      aprovado,
      valor_aprovado: valorEfetivo,
      valor_efetivo: valorEfetivo,
      motivo: observacao,
      observacao
    });
    return data;
  },
  getMonitorCaixas: async () => {
    const { data } = await api.get('/caixa/monitor-tempo-real');
    return data;
  },

  // Notificações & Alertas
  getNotificacoes: async (statusFiltro?: string) => {
    const url = statusFiltro ? `/notificacoes?status_filtro=${statusFiltro}` : '/notificacoes';
    const { data } = await api.get(url);
    return data;
  },
  resolverNotificacao: async (id: number) => {
    const { data } = await api.put(`/notificacoes/${id}/resolver`);
    return data;
  },
  resolverTodasNotificacoes: async () => {
    const { data } = await api.put('/notificacoes/resolver-todas');
    return data;
  },

  // Inteligência Analítica OLAP & Previsão Preditiva
  getRelatorioOLAP: async (periodo: string = 'MENSAL') => {
    const { data } = await api.get(`/relatorios/olap-analitico?periodo=${periodo}`);
    return data;
  },

  // Bypass de Teste para Ponto Eletrônico
  toggleBypassPonto: async () => {
    const { data } = await api.post('/ponto/toggle-bypass-teste');
    return data;
  },
};


