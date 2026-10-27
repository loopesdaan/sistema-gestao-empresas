export type PerfilUsuario = 'ADMIN' | 'VENDEDOR' | 'OPERADOR_CAIXA' | 'TECNICO' | 'ESTOQUISTA';

export interface Usuario {
  id: number;
  empresa_id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  foto_url?: string;
  created_at: string;
}

export interface Empresa {
  id: number;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  cor_primaria?: string;
  logo_url?: string;
  // Campos adicionados no Sprint 2
  perfil_negocio?: string;
  modulos_ativos?: string | string[];
  onboarding_concluido?: boolean;
}

export interface Produto {
  id: number;
  empresa_id: number;
  nome: string;
  codigo_barras?: string;
  categoria?: string;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  estoque_baixo?: boolean;
}

export interface Cliente {
  id: number;
  empresa_id: number;
  nome: string;
  cpf_cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  placa_veiculo?: string;
  modelo_veiculo?: string;
  cor_veiculo?: string;
  limite_credito: number;
  saldo_devedor: number;
  observacoes?: string;
  ativo: boolean;
}

export type StatusCaixa = 'ABERTO' | 'FECHADO' | 'PENDENTE_APROVACAO';
export type TipoMovimentacaoCaixa = 'SANGRIA' | 'SUPRIMENTO';

export type TipoSolicitacaoCaixa = 'SUPRIMENTO' | 'SANGRIA' | 'SANGRIA_CEGA' | 'FECHAMENTO';
export type StatusSolicitacaoCaixa = 'PENDENTE' | 'APROVADO' | 'REJEITADO';

export interface SolicitacaoCaixa {
  id: number;
  caixa_id: number;
  tipo: TipoSolicitacaoCaixa;
  valor?: number;
  justificativa?: string;
  status: StatusSolicitacaoCaixa;
  solicitado_em: string;
  respondido_em?: string;
  observacao_resposta?: string;
}

export interface Caixa {
  id: number;
  empresa_id: number;
  usuario_id: number;
  usuario_nome?: string;
  usuario_email?: string;
  usuario_perfil?: string;
  usuario_foto?: string;
  data_abertura: string;
  data_fechamento?: string;
  saldo_inicial: number;
  saldo_final_informado?: number;
  saldo_final_calculado?: number;
  diferenca?: number;
  limite_gaveta?: number;
  status: StatusCaixa;
  observacoes?: string;
}

export interface ResumoCaixa {
  caixa: Caixa;
  saldo_inicial: number;
  total_vendas_dinheiro: number;
  total_vendas_pix: number;
  total_vendas_cartao_credito: number;
  total_vendas_cartao_debito: number;
  total_vendas_a_prazo: number;
  total_suprimentos: number;
  total_sangrias: number;
  saldo_esperado_dinheiro: number;
  diferenca?: number;
  quantidade_vendas?: number;
}

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'A_PRAZO';
export type StatusVenda = 'CONCLUIDA' | 'CANCELADA';

export interface ItemVenda {
  id?: number;
  produto_id: number;
  produto_nome?: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

export interface PagamentoVenda {
  id?: number;
  forma_pagamento: FormaPagamento;
  valor: number;
  troco: number;
}

export interface Venda {
  id: number;
  empresa_id: number;
  caixa_id: number;
  cliente_id?: number;
  cliente_nome?: string;
  usuario_id: number;
  usuario_nome?: string;
  valor_bruto: number;
  desconto: number;
  acrescimo: number;
  valor_liquido: number;
  status: StatusVenda;
  observacoes?: string;
  created_at: string;
  itens: ItemVenda[];
  pagamentos: PagamentoVenda[];
  numero_sequencial?: number;
  codigo_identificador?: string;
}

export type StatusOS = 'ABERTA' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECAS' | 'CONCLUIDA' | 'ENTREGUE' | 'CANCELADA';

export interface ItemOS {
  id?: number;
  produto_id: number;
  produto_nome?: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

export interface OrdemServico {
  id: number;
  empresa_id: number;
  cliente_id: number;
  cliente_nome?: string;
  cliente_telefone?: string;
  usuario_id: number;
  usuario_nome?: string;
  titulo: string;
  equipamento?: string;
  defeito_relatado?: string;
  laudo_tecnico?: string;
  status: StatusOS;
  valor_servicos: number;
  valor_pecas: number;
  valor_total: number;
  previsao_entrega?: string;
  data_finalizacao?: string;
  motivo_cancelamento?: string;
  data_cancelamento?: string;
  usuario_cancelamento_id?: number;
  usuario_cancelamento_nome?: string;
  created_at: string;
  itens: ItemOS[];
  numero_sequencial?: number;
  codigo_identificador?: string;
}

export interface RelatorioCancelamentosOS {
  total_ordens_canceladas: number;
  total_servicos_cancelados: number;
  total_pecas_canceladas: number;
  total_valor_cancelado: number;
  ordens: OrdemServico[];
}

export interface DashboardMetrics {
  faturamento_hoje: number;
  faturamento_mes: number;
  quantidade_vendas_hoje: number;
  quantidade_vendas_mes: number;
  ordens_servico_abertas: number;
  produtos_estoque_baixo: number;
  ticket_medio: number;
  top_produtos: Array<{
    produto_id: number;
    nome: string;
    total_vendido: number;
    valor_total: number;
  }>;
  vendas_ultimos_dias: Array<{
    data: string;
    total: number;
    quantidade_vendas: number;
  }>;
}

// CLT Ponto Eletrônico
export interface RegistroPonto {
  id: number;
  usuario_id: number;
  usuario_nome?: string;
  data: string;
  entrada_1?: string;
  saida_almoco?: string;
  saida_1?: string;
  retorno_almoco?: string;
  entrada_2?: string;
  saida_2?: string;
  total_minutos_trabalhados?: number;
  minutos_trabalhados?: number;
  saldo_minutos?: number;
  minutos_hora_extra_autorizada?: number;
  horas_extras_aprovadas?: number;
  bloqueado_clt: boolean;
  motivo_bloqueio?: string;
  aprovado_por_id?: number;
  aprovado_em?: string;
}

export interface StatusJornada {
  possui_ponto_hoje?: boolean;
  tem_registro?: boolean;
  registro_id?: number;
  ponto_hoje?: RegistroPonto;
  proxima_acao?: string;
  status_jornada?: string;
  minutos_trabalhados?: number;
  minutos_restantes_jornada_normal?: number;
  minutos_previstos?: number;
  limite_restante_minutos?: number;
  minutos_hora_extra?: number;
  hora_extra_autorizada?: number;
  horas_extras_aprovadas?: number;
  bloqueado_clt?: boolean;
  isento_ponto?: boolean;
  bypass_ativo?: boolean;
  pode_operar?: boolean;
  pode_testar?: boolean;
  mensagem_status?: string;
  entrada_1?: string;
  saida_almoco?: string;
  saida_1?: string;
  retorno_almoco?: string;
  entrada_2?: string;
  saida_2?: string;
  horario_sugerido?: {
    entrada: string;
    saida_almoco: string;
    retorno_almoco: string;
    saida_final: string;
    carga_minutos?: number;
  };
  previsao_calculada?: {
    saida_almoco: string;
    retorno_almoco: string;
    saida_final: string;
  };
}

export interface ConfiguracaoPonto {
  id?: number;
  empresa_id?: number;
  perfil?: string;
  usuario_id?: number;
  usuario_nome?: string;
  horario_entrada: string;
  horario_saida_almoco: string;
  horario_retorno_almoco: string;
  horario_saida: string;
  dias_trabalho: string;
  carga_horaria_diaria_minutos: number;
  tolerancia_minutos: number;
  interjornada_minima_horas: number;
  max_horas_extras_dia_minutos: number;
  isento_ponto: boolean;
  ativo: boolean;
}

// Notificações & Alertas
export interface NotificacaoItem {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: string;
  referencia_tipo?: string;
  referencia_id?: number;
  valor_pendente?: number;
  status: 'PENDENTE' | 'RESOLVIDA';
  created_at: string;
  resolvido_em?: string;
}

// Monitor de Caixas em Tempo Real
export interface MonitorCaixaItem {
  id: number;
  usuario_nome: string;
  data_abertura: string;
  duracao_minutos: number;
  saldo_em_dinheiro: number;
  limite_gaveta: number;
  alerta_sangria: boolean;
  status: StatusCaixa;
  pendencias_solicitacao: number;
}

// Inteligência Analítica OLAP & Previsão Preditiva
export interface RankingOperadorItem {
  posicao: number;
  badge: string;
  usuario_id: number;
  nome_operador: string;
  perfil: string;
  quantidade_vendas: number;
  faturamento: number;
  ticket_medio: number;
  participacao_percentual: number;
}

export interface ProdutoMotorOLAP {
  produto_id: number;
  nome: string;
  unidades_vendidas: number;
  faturamento: number;
  taxa_giro_diaria: number;
  receita_diaria: number;
  estoque_atual: number;
  dias_estoque_estimados: number;
  risco_ruptura: 'ALTO' | 'MEDIO' | 'BAIXO';
  contribuicao_percentual: number;
}

export interface PrevisaoFaturamentoOLAP {
  previsao_7_dias: number;
  previsao_30_dias: number;
  previsao_90_dias: number;
  receita_diaria_estimada: number;
  fator_tendencia: number;
  confianca_estatistica: number;
  produtos_motores: ProdutoMotorOLAP[];
  sugestoes_estrategicas: string[];
}

export interface MetricasConsolidadasOLAP {
  faturamento_total: number;
  faturamento_anterior: number;
  crescimento_percentual: number;
  quantidade_vendas: number;
  ticket_medio: number;
  itens_vendidos: number;
  media_diaria: number;
}

export interface SerieTemporalItem {
  data: string;
  faturamento: number;
  quantidade_vendas: number;
}

export interface RelatorioOLAPResponse {
  periodo_selecionado: string;
  dias_periodo: number;
  data_inicio: string;
  data_fim: string;
  metricas_consolidadas: MetricasConsolidadasOLAP;
  ranking_operadores: RankingOperadorItem[];
  previsao_faturamento: PrevisaoFaturamentoOLAP;
  serie_temporal: SerieTemporalItem[];
}

