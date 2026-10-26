import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useEmpresa, TEMAS_SEGMENTO, TemaSegmento, PALETAS_CORES } from '../contexts/EmpresaContext';
import { 
  Building2, CheckCircle2, ChevronRight, ChevronLeft, Wrench, 
  Car, Wine, HardHat, Shirt, Settings, ToggleLeft, ToggleRight, 
  X, Users, Shield, Sparkles, Smartphone, Eye, Plus, Trash2, Check
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

// Lista de Ramos / Tipos de Negócio disponíveis
const TIPOS_NEGOCIO = [
  {
    id: 'mecanica',
    label: 'Mecânica & Auto Center',
    subtitulo: 'Oficina, revisão e autopeças',
    nomeSugerido: 'Auto Mecânica & Peças',
    emoji: '🔧',
    icon: Wrench,
    corBadge: 'bg-amber-100 text-amber-800 border-amber-300',
    descricao: 'Controle de ordens de serviço por placa, catálogo de peças e mecânicos responsáveis.',
    presetModulos: ['pdv', 'caixa', 'os', 'produtos', 'clientes', 'relatorios']
  },
  {
    id: 'lava_rapido',
    label: 'Lava Rápido & Estética',
    subtitulo: 'Ducha, polimento e higienização',
    nomeSugerido: 'Lava Rápido Levi Express',
    emoji: '🚗',
    icon: Car,
    corBadge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    descricao: 'Fila ágil de veículos, controle de lavadores, serviços rápidos e histórico por placa.',
    presetModulos: ['pdv', 'caixa', 'os', 'clientes']
  },
  {
    id: 'adega',
    label: 'Adega & Bebidas',
    subtitulo: 'Distribuidora e conveniência',
    nomeSugerido: 'Adega Premier & Distribuidora',
    emoji: '🍷',
    icon: Wine,
    corBadge: 'bg-purple-100 text-purple-800 border-purple-300',
    descricao: 'PDV ultra veloz com leitor de código de barras, controle de fardos, bebidas e crediário.',
    presetModulos: ['pdv', 'caixa', 'produtos', 'estoque', 'clientes', 'relatorios']
  },
  {
    id: 'material_construcao',
    label: 'Material de Construção',
    subtitulo: 'Cimento, ferragens e ferramentas',
    nomeSugerido: 'Material de Construção Silva',
    emoji: '🏗️',
    icon: HardHat,
    corBadge: 'bg-orange-100 text-orange-800 border-orange-300',
    descricao: 'Controle de estoque bruto, orçamentos para obras e controle de entregas.',
    presetModulos: ['pdv', 'caixa', 'produtos', 'estoque', 'clientes', 'relatorios']
  },
  {
    id: 'loja_roupa',
    label: 'Loja de Roupas & Varejo',
    subtitulo: 'Moda, calçados e acessórios',
    nomeSugerido: 'Boutique & Moda Elegance',
    emoji: '👕',
    icon: Shirt,
    corBadge: 'bg-pink-100 text-pink-800 border-pink-300',
    descricao: 'Catálogo de roupas, controle de crediário de clientes, trocas e promoções sazonais.',
    presetModulos: ['pdv', 'caixa', 'produtos', 'clientes', 'relatorios']
  },
  {
    id: 'personalizado',
    label: 'Personalizado / Geral',
    subtitulo: 'Comércio e serviços em geral',
    nomeSugerido: 'Minha Empresa Comercial',
    emoji: '⚙️',
    icon: Settings,
    corBadge: 'bg-sky-100 text-sky-800 border-sky-300',
    descricao: 'Configuração flexível para qualquer tipo de negócio, ativando módulos sob medida.',
    presetModulos: ['pdv', 'caixa', 'produtos', 'clientes', 'os', 'relatorios']
  },
];

// Lista de Módulos Reais do Sistema (Totalmente alinhados com a navegação)
const MODULOS_DISPONIVEIS = [
  { id: 'pdv', label: 'Frente de Caixa (PDV)', desc: 'Vendas rápidas no balcão, dinheiro, PIX e cartões' },
  { id: 'caixa', label: 'Controle de Caixa', desc: 'Abertura, fechamento, suprimentos, sangrias e conferência de gaveta' },
  { id: 'produtos', label: 'Produtos & Estoque', desc: 'Catálogo de itens, preços, código de barras e estoque mínimo' },
  { id: 'clientes', label: 'Clientes & Crediário', desc: 'Cadastro de clientes, limite de crédito e contas a receber' },
  { id: 'os', label: 'Ordens de Serviço (OS)', desc: 'Abertura de atendimentos técnicos, serviços, peças e entrega' },
  { id: 'relatorios', label: 'Relatórios de Vendas', desc: 'Histórico de vendas, produtos campeões e faturamento por período' },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { 
    empresa, 
    setModulosAtivos, 
    modulosAtivos,
    setPerfilNegocio, 
    setOnboardingConcluido, 
    carregarDadosEmpresa,
    corSelecionada,
    setCorSelecionada
  } = useEmpresa();

  const isModoEdicao = !!empresa.onboarding_concluido;

  // Se já concluiu o onboarding e está personalizando, abre direto no Passo 2 (Segmento & Estilo)
  const [etapa, setEtapa] = useState<number>(isModoEdicao ? 2 : 1);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Passo 1: Dados da Empresa
  const [nomeFantasia, setNomeFantasia] = useState(empresa.nome_fantasia || 'Minha Empresa');
  const [razaoSocial, setRazaoSocial] = useState(empresa.razao_social || 'Comércio & Serviços LTDA');
  const [cnpj, setCnpj] = useState(empresa.cnpj || '');
  const [telefone, setTelefone] = useState(empresa.telefone || '');
  const [email, setEmail] = useState(empresa.email || '');
  const [cep, setCep] = useState(empresa.cep || '');
  const [endereco, setEndereco] = useState(empresa.endereco || '');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Passo 2: Estilo / Ramo & Cores
  const [ramoSelecionado, setRamoSelecionado] = useState<string>(empresa.perfil_negocio || 'loja_roupa');
  const [corLocal, setCorLocal] = useState<string>(empresa.cor_primaria || corSelecionada || 'sky');
  
  // Em personalização, por padrão NÃO recarrega demo para nunca sobrescrever dados reais
  const [carregarDemo, setCarregarDemo] = useState<boolean>(!isModoEdicao);

  // Passo 3: Módulos (respeita estritamente o que já está salvo no banco/contexto)
  const [modulos, setModulos] = useState<string[]>(() => {
    if (modulosAtivos && modulosAtivos.length > 0) {
      return modulosAtivos;
    }
    const preset = TIPOS_NEGOCIO.find(t => t.id === (empresa.perfil_negocio || 'loja_roupa'));
    return preset ? preset.presetModulos : ['pdv', 'caixa', 'produtos', 'clientes', 'relatorios'];
  });

  // Passo 4: Usuários reais carregados da API
  const [usuariosLista, setUsuariosLista] = useState<Array<{ nome: string; email: string; perfil: string }>>([]);

  useEffect(() => {
    apiService.listarUsuarios().then((lista) => {
      if (Array.isArray(lista) && lista.length > 0) {
        setUsuariosLista(lista.map(u => ({ nome: u.nome, email: u.email, perfil: u.perfil })));
      }
    }).catch(() => {
      setUsuariosLista([
        { nome: 'Danilo Lopes', email: 'danilo.lopes@teste.com', perfil: 'ADMIN' },
        { nome: 'Leticia Melo', email: 'leticia.melo@teste.com', perfil: 'ADMIN' }
      ]);
    });
  }, []);

  // Sincroniza dados da empresa caso terminem de carregar após a montagem do componente
  useEffect(() => {
    if (empresa.nome_fantasia) setNomeFantasia(empresa.nome_fantasia);
    if (empresa.razao_social) setRazaoSocial(empresa.razao_social);
    if (empresa.cnpj) setCnpj(empresa.cnpj);
    if (empresa.telefone) setTelefone(empresa.telefone);
    if (empresa.email) setEmail(empresa.email);
    if (empresa.cep) setCep(empresa.cep);
    if (empresa.endereco) setEndereco(empresa.endereco);
    if (empresa.perfil_negocio) setRamoSelecionado(empresa.perfil_negocio);
    if (empresa.cor_primaria) setCorLocal(empresa.cor_primaria);
    if (modulosAtivos && modulosAtivos.length > 0) {
      setModulos(modulosAtivos);
    }
  }, [empresa]);

  // Tema ativo atual em tempo real
  const temaAtivo: TemaSegmento = TEMAS_SEGMENTO[ramoSelecionado] || TEMAS_SEGMENTO.personalizado;
  const paletaPreview = PALETAS_CORES[corLocal] || PALETAS_CORES.sky;

  const handleBuscarCep = async (cepInput: string) => {
    const clean = cepInput.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const info = await apiService.buscarCep(clean);
      if (info) {
        setCep(info.cep);
        setEndereco(info.enderecoCompleto);
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setBuscandoCep(false);
    }
  };

  // Ao trocar de ramo: NUNCA destrói o nome fantasia já configurado pelo usuário
  const handleSelecionarRamo = (ramoId: string) => {
    setRamoSelecionado(ramoId);
    const preset = TIPOS_NEGOCIO.find(t => t.id === ramoId);
    if (preset) {
      // Só sugere nome fantasia na primeira configuração e se o usuário ainda não tiver digitado nada
      const nomeEhPadrao = !nomeFantasia || nomeFantasia === 'Minha Empresa' || TIPOS_NEGOCIO.some(t => t.nomeSugerido === nomeFantasia);
      if (!isModoEdicao && nomeEhPadrao) {
        setNomeFantasia(preset.nomeSugerido);
        setRazaoSocial(preset.nomeSugerido + ' LTDA');
      }

      // Se for a primeira vez, sugere o preset de módulos; se já estiver em personalização, mantém os módulos customizados do usuário
      if (!isModoEdicao) {
        setModulos(preset.presetModulos);
      }
    }
    const corSugerida: Record<string, string> = {
      mecanica: 'amber',
      lava_rapido: 'cyan',
      adega: 'purple',
      material_construcao: 'orange',
      loja_roupa: 'rose',
      personalizado: 'sky'
    };
    if (corSugerida[ramoId]) {
      setCorLocal(corSugerida[ramoId]);
      setCorSelecionada(corSugerida[ramoId]);
    }
  };

  const toggleModulo = (id: string) => {
    setModulos(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // Salva toda a configuração final
  const handleFinalizar = async () => {
    setSalvando(true);
    try {
      await apiService.salvarOnboarding({
        nome_fantasia: nomeFantasia,
        razao_social: razaoSocial,
        cnpj,
        telefone,
        email,
        cep,
        endereco,
        cor_primaria: corLocal,
        perfil_negocio: ramoSelecionado,
        modulos_ativos: modulos,
        aplicar_dados_demo: carregarDemo,
      });

      if (carregarDemo) {
        try {
          await apiService.aplicarPresetSegmento(ramoSelecionado);
        } catch (presetErr) {
          console.warn('Preset já aplicado ou informativo:', presetErr);
        }
      }

      setPerfilNegocio(ramoSelecionado);
      setModulosAtivos(modulos);
      setCorSelecionada(corLocal);
      setOnboardingConcluido(true);
      await carregarDadosEmpresa();
      onComplete();
    } catch (err: any) {
      console.error('Erro ao salvar onboarding:', err);
      // Fallback gracioso
      setPerfilNegocio(ramoSelecionado);
      setModulosAtivos(modulos);
      setCorSelecionada(corLocal);
      setOnboardingConcluido(true);
      onComplete();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto flex flex-col text-slate-100">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-${temaAtivo.corPrimaria} flex items-center justify-center text-white text-xl shadow-lg transition-colors duration-300`}>
            {temaAtivo.emoji}
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {isModoEdicao ? 'Personalização do Sistema' : 'Assistente de Configuração Inicial'}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-semibold border border-slate-700">
                {isModoEdicao ? 'Personalização' : 'Setup Rápido'}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {isModoEdicao ? 'Edite identidade, segmento e ative ou desative ferramentas livremente' : 'Personalize a identidade visual, módulos e equipe da empresa'}
            </p>
          </div>
        </div>

        {/* Stepper no Topo */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { num: 1, label: 'Empresa' },
            { num: 2, label: 'Segmento & Estilo' },
            { num: 3, label: 'Módulos' },
            { num: 4, label: 'Equipe' },
            { num: 5, label: 'Ativação' },
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setEtapa(s.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                etapa === s.num
                  ? 'bg-sky-600 text-white shadow-md'
                  : etapa > s.num
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                etapa === s.num ? 'bg-white text-sky-600 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {s.num}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onComplete}
          title="Fechar e ir para o sistema"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </header>

      {/* Conteúdo Principal Dividido (Formulário à Esquerda + Live Preview à Direita) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Lado Esquerdo: Formulário por Etapas (7 colunas) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* ETAPA 1: Identidade da Empresa */}
          {etapa === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Passo 1 de 5</span>
                <h2 className="text-xl font-bold text-white mt-1">Identidade do Negócio</h2>
                <p className="text-xs text-slate-400 mt-0.5">Como seus clientes e funcionários reconhecem sua empresa?</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Nome Fantasia do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    placeholder="Ex: Oficina Mecânica Central, Lava Rápido Brilho..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Razão Social (Opcional)</label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Ex: Auto & Serviços LTDA"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">CNPJ (Opcional)</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">E-mail Comercial (Opcional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@minhaempresa.com.br"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-semibold text-slate-300">CEP</label>
                      <button
                        type="button"
                        disabled={buscandoCep}
                        onClick={() => cep && handleBuscarCep(cep)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        <Sparkles size={12} />
                        <span>{buscandoCep ? 'Buscando...' : 'Buscar CEP'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCep(val);
                        if (val.replace(/\D/g, '').length === 8) {
                          handleBuscarCep(val);
                        }
                      }}
                      placeholder="00000-000"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1.5">Endereço Completo</label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua, número, complemento, bairro, cidade - UF"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEtapa(2)}
                  className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-600/30 transition-all"
                >
                  <span>Continuar para Estilo</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Segmento & Estilo com Adaptação Visual Imediata */}
          {etapa === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Passo 2 de 5</span>
                <h2 className="text-xl font-bold text-white mt-1">Escolha o Segmento do Seu Negócio</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ao selecionar um ramo, o sistema adota automaticamente cores, termos e módulos específicos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {TIPOS_NEGOCIO.map(tipo => {
                  const isSelected = ramoSelecionado === tipo.id;
                  return (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => handleSelecionarRamo(tipo.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? `border-sky-500 bg-slate-800/90 shadow-xl shadow-sky-500/10 ring-2 ring-sky-500/30`
                          : `border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40`
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xl">{tipo.emoji}</span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-500/40">
                              <Check size={12} />
                              Ativo
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white">{tipo.label}</h3>
                        <p className="text-[11px] text-sky-300 font-medium mt-0.5">{tipo.subtitulo}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{tipo.descricao}</p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Preset: {tipo.presetModulos.length} módulos</span>
                        <span className="text-sky-400 font-semibold">Design sob medida →</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isModoEdicao && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl gap-2">
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white block">Módulos Customizados Preservados</span>
                    <span className="text-[11px] text-slate-400">Suas ferramentas ativas atuais ({modulos.length}) foram mantidas.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const preset = TIPOS_NEGOCIO.find(t => t.id === ramoSelecionado);
                      if (preset) setModulos(preset.presetModulos);
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-bold rounded-xl text-xs transition-colors border border-slate-700 whitespace-nowrap"
                  >
                    Redefinir módulos para padrão deste ramo
                  </button>
                </div>
              )}

              {/* Paleta de Cores para as Telas */}
              <div className="mt-5 p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-sky-400" />
                      <span>Paleta de Cores para as Telas & Menus</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Escolha a cor predominante do seu sistema para transformar botões, menus e indicadores.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-500/30">
                    {PALETAS_CORES[corLocal]?.label || 'Personalizado'}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                  {Object.values(PALETAS_CORES).map((paleta) => {
                    const selecionada = corLocal === paleta.id;
                    return (
                      <button
                        key={paleta.id}
                        type="button"
                        onClick={() => {
                          setCorLocal(paleta.id);
                          setCorSelecionada(paleta.id);
                        }}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                          selecionada
                            ? 'border-white bg-slate-800 ring-2 ring-white/50 scale-105 shadow-md shadow-black/40'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full border-2 mb-1 shadow-xs flex items-center justify-center transition-transform"
                          style={{
                            backgroundColor: paleta.previewHex,
                            borderColor: selecionada ? '#ffffff' : 'rgba(255,255,255,0.2)'
                          }}
                        >
                          {selecionada && <Check size={13} className="text-white drop-shadow stroke-[3]" />}
                        </div>
                        <span className={`text-[9px] font-bold leading-tight truncate w-full ${selecionada ? 'text-white' : 'text-slate-400'}`}>
                          {paleta.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa(3)}
                  className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-600/30 transition-all"
                >
                  <span>Continuar para Módulos</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3: Módulos do Sistema */}
          {etapa === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Passo 3 de 5</span>
                <h2 className="text-xl font-bold text-white mt-1">Módulos & Funcionalidades</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ative ou desative ferramentas conforme o fluxo de trabalho da sua equipe.
                </p>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {MODULOS_DISPONIVEIS.map(m => {
                  const ativo = modulos.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleModulo(m.id)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        ativo
                          ? 'border-sky-500/50 bg-slate-800/80 shadow-md'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          ativo ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {m.label.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${ativo ? 'text-white' : 'text-slate-400'}`}>
                            {m.label}
                          </p>
                          <p className="text-xs text-slate-500">{m.desc}</p>
                        </div>
                      </div>

                      <div className="pl-3">
                        {ativo ? (
                          <ToggleRight size={28} className="text-sky-400" />
                        ) : (
                          <ToggleLeft size={28} className="text-slate-600" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setEtapa(2)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa(4)}
                  className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-600/30 transition-all"
                >
                  <span>Continuar para Equipe</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 4: Equipe & Perfis de Acesso */}
          {etapa === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Passo 4 de 5</span>
                <h2 className="text-xl font-bold text-white mt-1">Equipe & Controle de Acesso</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cada perfil tem visão e permissões restritas às suas atividades no sistema.
                </p>
              </div>

              <div className="space-y-3">
                {usuariosLista.map((u, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-300">
                        {u.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{u.nome}</p>
                        <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        u.perfil === 'ADMIN'
                          ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                          : u.perfil === 'ESTOQUISTA'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                      }`}>
                        {u.perfil === 'ADMIN' ? 'Administrador' : u.perfil === 'ESTOQUISTA' ? 'Estoquista' : 'Operador de Caixa'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-2xl text-xs text-sky-300 leading-relaxed">
                💡 <strong>Dica de Segurança:</strong> Operadores de Caixa só têm acesso ao PDV e recebimentos. 
                Estoquistas só movimentam produtos e estoque. O Administrador tem visão global do faturamento e auditoria.
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setEtapa(3)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa(5)}
                  className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-600/30 transition-all"
                >
                  <span>Revisar & Ativar</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 5: Conclusão & Ativação */}
          {etapa === 5 && (
            <div className="space-y-6 text-center py-4 animate-fade-in">
              <div className={`w-20 h-20 rounded-3xl bg-${temaAtivo.corPrimaria}/20 border-2 border-${temaAtivo.corPrimaria} flex items-center justify-center text-4xl mx-auto shadow-xl`}>
                {temaAtivo.emoji}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">Pronto para Inicializar! 🚀</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Seu sistema foi configurado para <strong className="text-white">{nomeFantasia}</strong> com o design de <strong className="text-sky-400">{temaAtivo.label}</strong>.
                </p>
              </div>

              {/* Cartão de Resumo */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left max-w-md mx-auto space-y-3 text-xs">
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Nome:</span>
                  <span className="font-bold text-white">{nomeFantasia}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Segmento:</span>
                  <span className="font-bold text-sky-400 flex items-center gap-1">
                    {temaAtivo.emoji} {temaAtivo.label}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Cor Predominante:</span>
                  <span className="font-bold text-white uppercase">{PALETAS_CORES[corLocal]?.label || 'Safira'}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Módulos Ativos:</span>
                  <span className="font-bold text-white">{modulos.length} ferramentas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Equipe Inicial:</span>
                  <span className="font-bold text-white">{usuariosLista.length} usuários</span>
                </div>
              </div>

              {/* Opção para popular catálogo e clientes modelo */}
              <div className="max-w-md mx-auto text-left">
                <label className="flex items-start gap-3 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={carregarDemo}
                    onChange={(e) => setCarregarDemo(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded bg-slate-950 border-slate-700 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-white text-xs block">
                      {isModoEdicao ? 'Adicionar itens de exemplo deste segmento' : 'Carregar Catálogo e Clientes Modelo deste Segmento'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                      {isModoEdicao
                        ? 'Deixe desmarcado para preservar exatamente seu catálogo e clientes já existentes.'
                        : 'Popula com catálogo de produtos e clientes reais coerentes com o ramo escolhido.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setEtapa(2)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Alterar Ramo / Estilo
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={handleFinalizar}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
                >
                  {salvando ? (
                    <span>Aplicando Personalização...</span>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Ativar Sistema Personalizado</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Live Mockup Preview em Tempo Real (5 colunas) */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
              <Eye size={14} className="text-sky-400" />
              Preview Ao Vivo da Sua Interface
            </span>
            <span className="text-[11px] font-mono text-sky-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {temaAtivo.emoji} {ramoSelecionado.toUpperCase()}
            </span>
          </div>

          {/* Maquete da Interface que muda dinamicamente de acordo com o segmento */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
            {/* Topbar do Preview */}
            <div className={`p-4 bg-gradient-to-r ${paletaPreview.bgGradiente} text-white flex items-center justify-between transition-all duration-500`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{temaAtivo.emoji}</span>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold truncate leading-tight">
                    {nomeFantasia || 'Minha Empresa'}
                  </h4>
                  <p className="text-[10px] text-white/80 font-medium truncate">
                    {temaAtivo.label} • {paletaPreview.label}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-black/20 px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
                Modo Ativo
              </span>
            </div>

            {/* Corpo do Mockup */}
            <div className="p-4 space-y-4 bg-slate-950/80">
              {/* Mini Navbar */}
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 truncate">
                  {temaAtivo.terminologia.resumo}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  ● Caixa Aberto
                </span>
              </div>

              {/* Destaque contextual por segmento */}
              <div className={`p-3.5 rounded-2xl border ${paletaPreview.accentBadge} space-y-1`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                  Foco Operacional do Ramo
                </span>
                <p className="text-xs font-bold leading-tight">
                  {temaAtivo.destaqueDashboard}
                </p>
              </div>

              {/* Cartões de Métricas Adaptados */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Vendas Hoje</span>
                  <span className="text-base font-bold text-white">R$ 1.840,00</span>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">{temaAtivo.terminologia.cliente}</span>
                  <span className={`text-base font-bold ${paletaPreview.textoHighlight}`}>18 Atendidos</span>
                </div>
              </div>

              {/* Módulos Habilitados neste Estilo */}
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Menu Habilitado na Sidebar ({modulos.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {MODULOS_DISPONIVEIS.filter(m => modulos.includes(m.id)).map(m => (
                    <span
                      key={m.id}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {m.label.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Botão de Ação Rápida */}
              <div className="pt-1">
                <div className={`w-full py-2.5 rounded-xl text-center text-xs font-bold text-white bg-gradient-to-r ${paletaPreview.bgGradiente} shadow-md`}>
                  Ir para: {temaAtivo.terminologia.pdv}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Onboarding;
