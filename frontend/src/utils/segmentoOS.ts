import { 
  Wine, Car, Shirt, HardHat, Wrench, Settings, LucideIcon 
} from 'lucide-react';
import { StatusOS } from '../types';

export interface StatusOSConfig {
  label: string;
  bg: string;
  text: string;
}

export interface SegmentoOSConfig {
  id: string;
  icone: LucideIcon;
  nomeModulo: string;
  tituloTela: string;
  subtituloTela: string;
  botaoNovaOS: string;
  tituloModalNovo: string;
  
  // Rótulos e placeholders do formulário
  labelCliente: string;
  placeholderCliente: string;
  
  labelTitulo: string;
  placeholderTitulo: string;
  
  labelEquipamento: string;
  placeholderEquipamento: string;
  exibirEquipamento: boolean;
  
  labelDefeito: string;
  placeholderDefeito: string;
  
  labelValorServico: string;
  labelItensVinculados: string;
  labelMaoDeObra: string;
  labelPecasInsumos: string;
  
  // Status contextualizados
  statusLabels: Record<StatusOS, StatusOSConfig>;
  
  // Ações contextuais dos botões
  statusAcoes: {
    iniciar: string;
    aguardarPecas: string;
    retomar: string;
    concluir: string;
    reabrir: string;
    cobrar: string;
  };
  
  // Mensagens informativas por fase
  msgAguardandoPecas: string;
  msgEmAndamento: string;
  msgConcluida: string;
  msgEntregue: string;
  
  termoSingular: string; // ex: 'Encomenda', 'Lavagem', 'Ajuste', 'Carga', 'Ordem de Serviço'
}

export const CONFIG_OS_SEGMENTOS: Record<string, SegmentoOSConfig> = {
  adega: {
    id: 'adega',
    icone: Wine,
    nomeModulo: 'Encomendas & Entregas',
    tituloTela: 'Ordens de Pedidos, Encomendas & Entregas',
    subtituloTela: 'Gerencie encomendas especiais, barris de chopp, kits para festas, entregas agendadas e realize a cobrança direta no caixa.',
    botaoNovaOS: 'Nova Encomenda / Pedido',
    tituloModalNovo: 'Nova Encomenda / Ordem de Entrega',
    
    labelCliente: 'Cliente Solicitante *',
    placeholderCliente: 'Selecione o cliente solicitante...',
    
    labelTitulo: 'Resumo da Encomenda / Evento *',
    placeholderTitulo: 'Ex: 10 Caixas de Cerveja + Chopp 50L p/ Festa de Aniversário',
    
    labelEquipamento: 'Local de Entrega / Evento ou Chopeira Consignada',
    placeholderEquipamento: 'Ex: Chopeira Naja 2 bicos / Sítio Boa Vista (Chácara 12)',
    exibirEquipamento: true,
    
    labelDefeito: 'Instruções de Entrega & Detalhes da Encomenda',
    placeholderDefeito: 'Ex: Entregar gelado até às 17h30, levar copos descartáveis e máquina de cartão...',
    
    labelValorServico: 'Taxa de Entrega / Frete / Serviço (R$)',
    labelItensVinculados: 'Bebidas, Gelo & Produtos da Encomenda',
    labelMaoDeObra: 'Taxa de Entrega / Serviço:',
    labelPecasInsumos: 'Bebidas & Produtos Consignados:',
    
    statusLabels: {
      ABERTA: { label: 'Recebido / Na Fila', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Separando / Montagem', bg: 'bg-blue-50', text: 'text-blue-700' },
      AGUARDANDO_PECAS: { label: 'Aguardando Estoque', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Pronto p/ Entrega', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Entregue & Faturado', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelado', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Separação / Montagem',
      aguardarPecas: 'Aguardar Reposição de Estoque',
      retomar: 'Retomar Separação da Encomenda',
      concluir: 'Pronto p/ Entrega ou Retirada',
      reabrir: 'Reabrir Pedido (Ajustes)',
      cobrar: 'Cobrar e Faturar Entrega',
    },
    
    msgAguardandoPecas: 'Encomenda pausada aguardando reposição de bebidas geladas ou barris.',
    msgEmAndamento: 'Itens em separação no estoque ou chopeira em teste de pressão.',
    msgConcluida: 'Encomenda pronta e conferida para envio ou retirada pelo cliente.',
    msgEntregue: 'Encomenda entregue ao cliente e faturada com sucesso no caixa.',
    termoSingular: 'Encomenda'
  },

  lava_rapido: {
    id: 'lava_rapido',
    icone: Car,
    nomeModulo: 'Fila de Lavagem & Estética',
    tituloTela: 'Fila de Veículos, Lavagens & Estética Automotiva',
    subtituloTela: 'Acompanhe veículos no pátio e na rampa, serviços de estética, produtos aplicados e recebimento no caixa.',
    botaoNovaOS: 'Nova Lavagem / Veículo',
    tituloModalNovo: 'Entrada de Veículo / Nova Lavagem',
    
    labelCliente: 'Cliente / Proprietário *',
    placeholderCliente: 'Selecione o proprietário do veículo...',
    
    labelTitulo: 'Tipo de Lavagem / Serviço de Estética *',
    placeholderTitulo: 'Ex: Lavagem completa com cera líquida e aspiração interna',
    
    labelEquipamento: 'Veículo (Modelo, Cor & Placa) *',
    placeholderEquipamento: 'Ex: Jeep Compass 2022 Branco - Placa ABC-1D23',
    exibirEquipamento: true,
    
    labelDefeito: 'Observações / Cuidados Especiais com o Veículo',
    placeholderDefeito: 'Ex: Cuidado com insulfilm novo, atenção ao cheirinho e maçaneta do passageiro...',
    
    labelValorServico: 'Valor do Serviço / Lavagem (R$)',
    labelItensVinculados: 'Insumos, Acessórios & Ceras Aplicadas',
    labelMaoDeObra: 'Serviços de Lavagem:',
    labelPecasInsumos: 'Insumos & Produtos Aplicados:',
    
    statusLabels: {
      ABERTA: { label: 'No Pátio / Fila', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Na Rampa / Lavando', bg: 'bg-cyan-50', text: 'text-cyan-800' },
      AGUARDANDO_PECAS: { label: 'Secagem / Espera', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Pronto p/ Entrega', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Retirado & Pago', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelado', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Lavagem na Rampa',
      aguardarPecas: 'Aguardar Insumo / Secagem',
      retomar: 'Retomar Lavagem do Veículo',
      concluir: 'Concluir (Pronto p/ Entrega)',
      reabrir: 'Reabrir Serviço (Retoque)',
      cobrar: 'Cobrar e Liberar Veículo',
    },
    
    msgAguardandoPecas: 'Veículo aguardando insumo especial ou etapa de secagem/polimento.',
    msgEmAndamento: 'Veículo em execução na rampa de lavagem ou box de detalhamento.',
    msgConcluida: 'Lavagem concluída! Veículo limpo, pronto para retirada e pagamento.',
    msgEntregue: 'Veículo entregue ao cliente e recebimento registrado no caixa.',
    termoSingular: 'Lavagem'
  },

  loja_roupa: {
    id: 'loja_roupa',
    icone: Shirt,
    nomeModulo: 'Ajustes, Costuras & Sacolas',
    tituloTela: 'Ordens de Ajustes de Roupas, Costuras & Sacolas',
    subtituloTela: 'Acompanhe bainhas, ajustes sob medida, sacolas de prova condicional e acertos no caixa.',
    botaoNovaOS: 'Nova Ordem de Ajuste / Sacola',
    tituloModalNovo: 'Nova Ordem de Ajuste / Serviço de Moda',
    
    labelCliente: 'Cliente *',
    placeholderCliente: 'Selecione o cliente...',
    
    labelTitulo: 'Serviço Solicitado / Descrição do Ajuste *',
    placeholderTitulo: 'Ex: Barra original de calça jeans e ajuste de ombro em blazer',
    
    labelEquipamento: 'Peça de Roupa / Referência / Tamanho',
    placeholderEquipamento: 'Ex: Calça Jeans Skinny Tam 38 / Vestido Seda Floral Ref 402',
    exibirEquipamento: true,
    
    labelDefeito: 'Medidas & Detalhes do Ajuste Solicitado',
    placeholderDefeito: 'Ex: Encurtar 3 cm na barra mantendo efeito desfiado, apertar 2 cm no quadril...',
    
    labelValorServico: 'Valor do Serviço de Costura / Ajuste (R$)',
    labelItensVinculados: 'Aviamentos & Peças Vinculadas',
    labelMaoDeObra: 'Serviço de Costura / Ajuste:',
    labelPecasInsumos: 'Aviamentos & Peças:',
    
    statusLabels: {
      ABERTA: { label: 'Recebida / Aguardando', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Na Costura / Ajuste', bg: 'bg-pink-50', text: 'text-pink-800' },
      AGUARDANDO_PECAS: { label: 'Aguardando Aviamento', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Pronto p/ Prova', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Entregue & Faturado', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelado', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Ajuste na Oficina',
      aguardarPecas: 'Aguardar Tecido / Aviamento',
      retomar: 'Retomar Ajuste da Peça',
      concluir: 'Pronto para Prova / Entrega',
      reabrir: 'Reabrir Ajuste (Retoque)',
      cobrar: 'Cobrar e Faturar Ajuste',
    },
    
    msgAguardandoPecas: 'Peça pausada aguardando chegada de zíper, linha ou aviamento específico.',
    msgEmAndamento: 'Peça em trabalho de costura ou ajuste pela costureira/alfaiate.',
    msgConcluida: 'Ajuste finalizado com sucesso! Peça pronta para prova ou retirada.',
    msgEntregue: 'Peça entregue ao cliente e acerto registrado no caixa.',
    termoSingular: 'Ajuste'
  },

  material_construcao: {
    id: 'material_construcao',
    icone: HardHat,
    nomeModulo: 'Orçamentos, Cargas & Locações',
    tituloTela: 'Orçamentos para Obra, Cargas & Locações de Máquinas',
    subtituloTela: 'Gerencie entregas agendadas para obras, orçamentos pesados, locações de betoneiras e cobrança.',
    botaoNovaOS: 'Nova Carga / Orçamento',
    tituloModalNovo: 'Novo Orçamento / Ordem de Carga',
    
    labelCliente: 'Cliente / Responsável da Obra *',
    placeholderCliente: 'Selecione o cliente ou construtor...',
    
    labelTitulo: 'Finalidade da Carga / Resumo da Obra *',
    placeholderTitulo: 'Ex: Carga para fundação da laje e locação de betoneira 400L',
    
    labelEquipamento: 'Local da Obra ou Máquina Locada',
    placeholderEquipamento: 'Ex: Betoneira 400L #02 / Obra Residencial Alpha - Lote 12',
    exibirEquipamento: true,
    
    labelDefeito: 'Instruções de Descarregamento & Observações da Obra',
    placeholderDefeito: 'Ex: Caminhão só entra pela manhã, descarregar no piso inferior próximo ao portão...',
    
    labelValorServico: 'Valor do Frete / Locação / Serviço (R$)',
    labelItensVinculados: 'Materiais & Insumos da Carga',
    labelMaoDeObra: 'Frete / Locação / Serviço:',
    labelPecasInsumos: 'Materiais & Carga:',
    
    statusLabels: {
      ABERTA: { label: 'Orçamento Aberto', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Separando / Carregando', bg: 'bg-orange-50', text: 'text-orange-800' },
      AGUARDANDO_PECAS: { label: 'Aguardando Usina/Fornecedor', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Pronto p/ Despacho', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Entregue na Obra & Faturado', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelado', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Separação da Carga',
      aguardarPecas: 'Aguardar Fornecedor/Usina',
      retomar: 'Retomar Separação dos Materiais',
      concluir: 'Pronto para Despacho / Envio',
      reabrir: 'Reabrir Carga (Ajustes)',
      cobrar: 'Faturar Pedido no Caixa',
    },
    
    msgAguardandoPecas: 'Carga aguardando fornecedor de blocos, cimento ou ferro.',
    msgEmAndamento: 'Materiais sendo separados no depósito ou caminhão sendo carregado.',
    msgConcluida: 'Carga conferida e pronta para envio à obra. Liberada para faturamento.',
    msgEntregue: 'Materiais descarregados na obra e faturamento concluído no caixa.',
    termoSingular: 'Carga'
  },

  mecanica: {
    id: 'mecanica',
    icone: Wrench,
    nomeModulo: 'Ordens de Serviço (Oficina)',
    tituloTela: 'Ordens de Serviço (OS) & Oficina Mecânica',
    subtituloTela: 'Gerencie atendimentos automotivos, veículos no box, peças aplicadas e realize a cobrança no caixa com recibo.',
    botaoNovaOS: 'Nova Ordem de Serviço',
    tituloModalNovo: 'Nova Ordem de Serviço Automotiva',
    
    labelCliente: 'Cliente / Proprietário *',
    placeholderCliente: 'Selecione o proprietário do veículo...',
    
    labelTitulo: 'Título do Serviço / Resumo *',
    placeholderTitulo: 'Ex: Troca de óleo, pastilhas de freio e revisão da suspensão',
    
    labelEquipamento: 'Veículo / Modelo & Placa',
    placeholderEquipamento: 'Ex: Honda Civic 2.0 - Placa ABC-1234',
    exibirEquipamento: true,
    
    labelDefeito: 'Defeito Relatado pelo Cliente',
    placeholderDefeito: 'Ex: Barulho na suspensão dianteira ao passar em lombadas...',
    
    labelValorServico: 'Valor da Mão de Obra Mecânica (R$)',
    labelItensVinculados: 'Peças & Autopeças Aplicadas',
    labelMaoDeObra: 'Mão de Obra Mecânica:',
    labelPecasInsumos: 'Autopeças & Insumos:',
    
    statusLabels: {
      ABERTA: { label: 'No Box / Aguardando', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Em Manutenção', bg: 'bg-blue-50', text: 'text-blue-700' },
      AGUARDANDO_PECAS: { label: 'Aguardando Peças', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Pronto / Concluído', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Entregue ao Cliente', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelada', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Manutenção no Box',
      aguardarPecas: 'Aguardar Chegada de Peças',
      retomar: 'Retomar Manutenção no Box',
      concluir: 'Concluir Serviço Mecânico',
      reabrir: 'Reabrir Atendimento (Ajustes)',
      cobrar: 'Cobrar e Faturar OS',
    },
    
    msgAguardandoPecas: 'Veículo pausado no box aguardando entrega de autopeças.',
    msgEmAndamento: 'Veículo no box em manutenção pelo mecânico responsável.',
    msgConcluida: 'Serviço automotivo concluído! Veículo pronto para entrega e cobrança.',
    msgEntregue: 'Veículo entregue ao cliente e pagamento registrado no caixa.',
    termoSingular: 'Ordem de Serviço'
  },

  personalizado: {
    id: 'personalizado',
    icone: Settings,
    nomeModulo: 'Ordens de Serviço & Atendimentos',
    tituloTela: 'Ordens de Serviço (OS) & Faturamento',
    subtituloTela: 'Gerencie atendimentos técnicos, serviços prestados, produtos vinculados e realize a cobrança direta no caixa.',
    botaoNovaOS: 'Nova Ordem de Serviço',
    tituloModalNovo: 'Nova Ordem de Serviço',
    
    labelCliente: 'Cliente *',
    placeholderCliente: 'Selecione o cliente...',
    
    labelTitulo: 'Título do Serviço / Resumo *',
    placeholderTitulo: 'Ex: Prestação de serviços ou atendimento técnico especializado',
    
    labelEquipamento: 'Equipamento / Item / Referência',
    placeholderEquipamento: 'Ex: Modelo, número de série ou referência do item',
    exibirEquipamento: true,
    
    labelDefeito: 'Descrição da Solicitação / Detalhes',
    placeholderDefeito: 'Descreva o que o cliente solicitou ou o trabalho a ser realizado...',
    
    labelValorServico: 'Valor da Mão de Obra / Serviço (R$)',
    labelItensVinculados: 'Produtos & Peças Utilizadas',
    labelMaoDeObra: 'Mão de Obra / Serviços:',
    labelPecasInsumos: 'Produtos & Peças Utilizadas:',
    
    statusLabels: {
      ABERTA: { label: 'Aberta', bg: 'bg-amber-50', text: 'text-amber-800' },
      EM_ANDAMENTO: { label: 'Em Andamento', bg: 'bg-blue-50', text: 'text-blue-700' },
      AGUARDANDO_PECAS: { label: 'Aguardando Insumos', bg: 'bg-purple-50', text: 'text-purple-700' },
      CONCLUIDA: { label: 'Concluída', bg: 'bg-emerald-50', text: 'text-emerald-800' },
      ENTREGUE: { label: 'Entregue & Faturada', bg: 'bg-slate-100', text: 'text-slate-700' },
      CANCELADA: { label: 'Cancelada', bg: 'bg-rose-50', text: 'text-rose-700' },
    },
    
    statusAcoes: {
      iniciar: 'Iniciar Atendimento',
      aguardarPecas: 'Aguardar Insumos / Peças',
      retomar: 'Retomar Atendimento',
      concluir: 'Concluir Atendimento',
      reabrir: 'Reabrir Atendimento (Ajustes)',
      cobrar: 'Cobrar e Faturar OS',
    },
    
    msgAguardandoPecas: 'Atendimento pausado aguardando insumos ou componentes.',
    msgEmAndamento: 'Ordem de serviço em execução pela equipe técnica.',
    msgConcluida: 'Serviço finalizado com sucesso! Pronto para liberação e cobrança.',
    msgEntregue: 'Ordem de serviço finalizada e faturada com sucesso no caixa.',
    termoSingular: 'Ordem de Serviço'
  }
};

/**
 * Retorna a configuração especializada de OS para o segmento da empresa.
 */
export const getOSConfig = (perfilNegocio?: string): SegmentoOSConfig => {
  if (perfilNegocio && CONFIG_OS_SEGMENTOS[perfilNegocio]) {
    return CONFIG_OS_SEGMENTOS[perfilNegocio];
  }
  return CONFIG_OS_SEGMENTOS.personalizado;
};
