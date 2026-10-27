import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Produto } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Package, Search, Plus, FileSpreadsheet, AlertTriangle, 
  ArrowUpDown, Edit, Check, X, Upload, BarChart3, History,
  TrendingUp, DollarSign, Layers, AlertCircle, Sparkles, RefreshCw
} from 'lucide-react';

interface MovimentacaoItem {
  id: number;
  produto_id: number;
  produto_nome: string;
  categoria?: string;
  usuario_id: number;
  usuario_nome: string;
  tipo: string;
  quantidade: number;
  motivo?: string;
  created_at: string;
}

interface MetricasEstoque {
  total_itens_cadastrados: number;
  quantidade_total_unidades: number;
  patrimonio_custo_total: number;
  valor_potencial_venda: number;
  lucro_bruto_projetado: number;
  margem_media_percentual: number;
  qtd_itens_zerados: number;
  qtd_itens_alerta: number;
  produtos_criticos: Array<{
    id: number;
    nome: string;
    categoria?: string;
    estoque_atual: number;
    estoque_minimo: number;
    unidade: string;
    preco_venda: number;
    status: 'ZERADO' | 'ALERTA';
  }>;
  ultimas_movimentacoes: MovimentacaoItem[];
}

export const Produtos: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const { temaAtual } = useEmpresa();
  const { toast } = useToast();
  const usuarioSalvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
  const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  const podeMovimentarEstoque = isAdmin ?? (usuarioLogado?.perfil === 'ADMIN' || usuarioLogado?.perfil === 'ESTOQUISTA');
  const isEstoquista = usuarioLogado?.perfil === 'ESTOQUISTA';

  // Abas: Catalogo | Dashboard de Estoque | Histórico de Movimentações
  const [abaAtiva, setAbaAtiva] = useState<'catalogo' | 'dashboard' | 'historico'>('catalogo');

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] = useState(false);

  // Dados do Dashboard de Estoque
  const [metricasEstoque, setMetricasEstoque] = useState<MetricasEstoque | null>(null);
  const [historicoGeral, setHistoricoGeral] = useState<MovimentacaoItem[]>([]);
  const [carregandoMetricas, setCarregandoMetricas] = useState(false);

  // Modais
  const [modalProduto, setModalProduto] = useState<Partial<Produto> | null>(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalMov, setModalMov] = useState<{ produto: Produto; tipo: string; qtd: number; motivo: string } | null>(null);

  // Estados de upload
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultadoUpload, setResultadoUpload] = useState<any | null>(null);

  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const data = await apiService.listarProdutos(busca, filtroEstoqueBaixo);
      setProdutos(data);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarMetricasEstoque = async () => {
    setCarregandoMetricas(true);
    try {
      const [metrics, hist] = await Promise.all([
        apiService.getDashboardEstoqueMetricas(),
        apiService.getTodasMovimentacoesEstoque(100)
      ]);
      setMetricasEstoque(metrics);
      setHistoricoGeral(hist);
    } catch (err) {
      console.error('Erro ao carregar dashboard de estoque:', err);
    } finally {
      setCarregandoMetricas(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, [busca, filtroEstoqueBaixo]);

  useEffect(() => {
    if (abaAtiva === 'dashboard' || abaAtiva === 'historico') {
      carregarMetricasEstoque();
    }
  }, [abaAtiva]);

  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProduto || !modalProduto.nome) return;

    try {
      if (modalProduto.id) {
        await apiService.atualizarProduto(modalProduto.id, modalProduto);
        toast.sucesso('Produto atualizado com sucesso!');
      } else {
        await apiService.criarProduto(modalProduto);
        toast.sucesso('Produto cadastrado com sucesso!');
      }
      setModalProduto(null);
      carregarProdutos();
      if (abaAtiva === 'dashboard') carregarMetricasEstoque();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao salvar produto');
    }
  };

  const handleMovimentarEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMov || modalMov.qtd <= 0) return;

    try {
      await apiService.movimentarEstoque({
        produto_id: modalMov.produto.id,
        tipo: modalMov.tipo,
        quantidade: modalMov.qtd,
        motivo: modalMov.motivo
      });
      toast.sucesso(`Movimentação de ${modalMov.tipo} registrada com sucesso!`);
      setModalMov(null);
      carregarProdutos();
      carregarMetricasEstoque();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao movimentar estoque');
    }
  };

  const handleUploadPlanilha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivoUpload) return;
    setUploading(true);
    setResultadoUpload(null);

    try {
      const res = await apiService.importarPlanilha(arquivoUpload);
      setResultadoUpload(res);
      toast.sucesso(`Planilha importada com sucesso: ${res.sucessos || 0} produtos processados!`);
      carregarProdutos();
      carregarMetricasEstoque();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao importar planilha');
    } finally {
      setUploading(false);
    }
  };

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatEstoque = (val: number = 0) => {
    const num = Number(val);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="text-sky-600" size={22} />
            <h2 className="text-xl font-bold text-slate-800">
              {isEstoquista ? 'Controle & Gestão de Estoque' : 'Produtos & Estoque'}
            </h2>
            {isEstoquista && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Controlador de Estoque
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão física do inventário, código de barras, balanço, importação Excel e auditoria de movimentações.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podeMovimentarEstoque && (
            <button
              onClick={() => setModalImportar(true)}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet size={16} />
              <span>Importar Planilha</span>
            </button>
          )}
          {podeMovimentarEstoque && (
            <button
              onClick={() => setModalProduto({
                nome: '',
                codigo_barras: '',
                categoria: '',
                unidade: 'UN',
                preco_custo: 0,
                preco_venda: 0,
                estoque_atual: 0,
                estoque_minimo: 5,
                ativo: true
              })}
              className={`flex items-center gap-2 bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all`}
            >
              <Plus size={16} />
              <span>Novo Produto</span>
            </button>
          )}
        </div>
      </div>

      {/* Navegação entre Abas: Catálogo / Dashboard de Estoque / Histórico */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva('catalogo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === 'catalogo'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Package size={15} />
          <span>Catálogo de Produtos ({produtos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === 'dashboard'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <BarChart3 size={15} />
          <span>Dashboard de Estoque</span>
          {metricasEstoque && metricasEstoque.qtd_itens_zerados > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === 'historico'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <History size={15} />
          <span>Histórico de Movimentações</span>
        </button>
      </div>

      {/* ABA 1: CATÁLOGO DE PRODUTOS */}
      {abaAtiva === 'catalogo' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código de barras ou categoria..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setFiltroEstoqueBaixo(!filtroEstoqueBaixo)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filtroEstoqueBaixo
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle size={14} />
              <span>Apenas Estoque Crítico / Baixo</span>
            </button>
          </div>

          {/* Tabela de Produtos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Item / Descrição</th>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-right">Preço Venda</th>
                    <th className="py-3 px-4 text-center">Estoque Atual</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produtos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {loading ? 'Carregando catálogo...' : 'Nenhum item encontrado.'}
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p) => {
                      const estoqueBaixo = Number(p.estoque_atual) <= Number(p.estoque_minimo);
                      const zerado = Number(p.estoque_atual) <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{p.nome}</span>
                            <span className="text-[10px] text-slate-400">Custo: {formatMoney(p.preco_custo)}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {p.codigo_barras || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                              {p.categoria || 'Geral'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {formatMoney(p.preco_venda)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span className={zerado ? 'text-rose-600' : estoqueBaixo ? 'text-amber-600' : 'text-slate-800'}>
                              {formatEstoque(p.estoque_atual)} {p.unidade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {zerado ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Esgotado
                              </span>
                            ) : estoqueBaixo ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Baixo (Mín: {p.estoque_minimo})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {podeMovimentarEstoque && (
                              <button
                                onClick={() => setModalMov({ produto: p, tipo: 'ENTRADA', qtd: 1, motivo: '' })}
                                title="Movimentar estoque (Entrada, Saída ou Balanço auditado)"
                                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ArrowUpDown size={13} />
                                <span>Movimentar</span>
                              </button>
                            )}
                            <button
                              onClick={() => setModalProduto(p)}
                              title="Editar dados cadastrais e preços"
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit size={13} />
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: DASHBOARD ESPECIALIZADO DE ESTOQUE */}
      {abaAtiva === 'dashboard' && (
        <div className="space-y-6">
          {carregandoMetricas && !metricasEstoque ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-sky-600" />
              Calculando patrimônio e métricas de estoque...
            </div>
          ) : (
            <>
              {/* KPIs de Estoque */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Patrimônio em Custo
                  </span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">
                    {formatMoney(metricasEstoque?.patrimonio_custo_total)}
                  </span>
                  <span className="text-[10px] text-slate-500">Capital investido em mercadoria</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Valor de Venda Potencial
                  </span>
                  <span className="text-2xl font-black text-sky-600 mt-1 block">
                    {formatMoney(metricasEstoque?.valor_potencial_venda)}
                  </span>
                  <span className="text-[10px] text-slate-500">Projeção bruta de faturamento</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Lucro Bruto Projetado
                  </span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">
                    {formatMoney(metricasEstoque?.lucro_bruto_projetado)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Margem Média: {metricasEstoque?.margem_media_percentual}%
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Volume Físico
                  </span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {metricasEstoque?.quantidade_total_unidades} un
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Em {metricasEstoque?.total_itens_cadastrados} itens cadastrados
                  </span>
                </div>
              </div>

              {/* Alertas Críticos de Reposição */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        Itens Críticos & Sugestão de Reposição
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {metricasEstoque?.qtd_itens_zerados} item(ns) esgotados e {metricasEstoque?.qtd_itens_alerta} abaixo do estoque mínimo
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={carregarMetricasEstoque}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Atualizar métricas"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Produto</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3 text-center">Estoque Atual</th>
                        <th className="py-2.5 px-3 text-center">Estoque Mínimo</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!metricasEstoque?.produtos_criticos || metricasEstoque.produtos_criticos.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-emerald-600 font-semibold">
                            ✅ Nenhum item crítico! Todo o estoque está acima do nível mínimo.
                          </td>
                        </tr>
                      ) : (
                        metricasEstoque.produtos_criticos.map((pc) => (
                          <tr key={pc.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">{pc.nome}</td>
                            <td className="py-2.5 px-3 text-slate-500">{pc.categoria || '-'}</td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              <span className={pc.status === 'ZERADO' ? 'text-rose-600' : 'text-amber-600'}>
                                {pc.estoque_atual} {pc.unidade}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600">
                              {pc.estoque_minimo} {pc.unidade}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pc.status === 'ZERADO'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {pc.status === 'ZERADO' ? 'Esgotado' : 'Estoque Baixo'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => {
                                  const prod = produtos.find(p => p.id === pc.id) || {
                                    id: pc.id,
                                    nome: pc.nome,
                                    preco_venda: pc.preco_venda,
                                    preco_custo: 0,
                                    estoque_atual: pc.estoque_atual,
                                    estoque_minimo: pc.estoque_minimo,
                                    unidade: pc.unidade,
                                    ativo: true,
                                    empresa_id: 1,
                                    created_at: new Date().toISOString()
                                  };
                                  setModalMov({ produto: prod as any, tipo: 'ENTRADA', qtd: 10, motivo: 'Reposição de estoque crítico' });
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-semibold transition-colors"
                              >
                                Dar Entrada (+)
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA 3: HISTÓRICO COMPLETO DE MOVIMENTAÇÕES DE ESTOQUE */}
      {abaAtiva === 'historico' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Histórico Geral de Movimentações Registradas</h3>
              <p className="text-[11px] text-slate-400">
                Auditoria de entradas, saídas manuais, acertos de balanço e vendas por operador.
              </p>
            </div>
            <button
              onClick={carregarMetricasEstoque}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              title="Recarregar histórico"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-3">Data / Hora</th>
                  <th className="py-3 px-3">Produto</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3 text-center">Quantidade</th>
                  <th className="py-3 px-3">Operador Responsável</th>
                  <th className="py-3 px-3">Motivo / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historicoGeral.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhuma movimentação registrada no histórico.
                    </td>
                  </tr>
                ) : (
                  historicoGeral.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {h.produto_nome}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.tipo === 'ENTRADA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : h.tipo === 'SAIDA'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : h.tipo === 'VENDA'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {h.tipo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {h.quantidade} un
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {h.usuario_nome || 'Sistema'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">
                        {h.motivo || 'Sem justificativa preenchida'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAIS COM FECHAMENTO AO CLICAR FORA (BACKDROP CLICK) */}

      {/* Modal Criar / Editar Produto */}
      {modalProduto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalProduto(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-xs`}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    {modalProduto.id ? 'Editar Produto / Serviço' : 'Novo Produto / Serviço'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Defina preços, códigos e parâmetros de estoque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalProduto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarProduto} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={modalProduto.nome || ''}
                  onChange={(e) => setModalProduto({ ...modalProduto, nome: e.target.value })}
                  placeholder="Ex: Cerveja Heineken Long Neck 330ml"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código de Barras (EAN/GTIN)</label>
                  <input
                    type="text"
                    value={modalProduto.codigo_barras || ''}
                    onChange={(e) => setModalProduto({ ...modalProduto, codigo_barras: e.target.value })}
                    placeholder="7891234567890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={modalProduto.categoria || ''}
                    onChange={(e) => setModalProduto({ ...modalProduto, categoria: e.target.value })}
                    placeholder="Ex: Bebidas, Ferramentas, Óleos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                  <select
                    value={modalProduto.unidade || 'UN'}
                    onChange={(e) => setModalProduto({ ...modalProduto, unidade: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="FD">FD (Fardo)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="PCT">PCT (Pacote)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="L">L (Litro)</option>
                    <option value="PC">PC (Peça)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preço Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalProduto.preco_custo || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, preco_custo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preço Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={modalProduto.preco_venda || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, preco_venda: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {modalProduto.id ? (
                  /* Modo Edição: Mostra o estoque físico atual auditado e um botão direto para movimentar */
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Estoque Físico Atual
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black text-slate-800">
                          {formatEstoque(modalProduto.estoque_atual)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{modalProduto.unidade || 'UN'}</span>
                      </div>
                    </div>
                    {podeMovimentarEstoque && (
                      <button
                        type="button"
                        onClick={() => {
                          const prod = modalProduto as Produto;
                          setModalProduto(null);
                          setModalMov({ produto: prod, tipo: 'ENTRADA', qtd: 1, motivo: '' });
                        }}
                        className="mt-2 py-1 px-2.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <ArrowUpDown size={12} />
                        <span>Ajustar Quantidade</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* Modo Criação: Permite definir o saldo inicial de lançamento */
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Estoque Inicial {['KG', 'L', 'M'].includes(modalProduto.unidade?.toUpperCase() || '') ? '(Decimal)' : '(Inteiro)'}
                    </label>
                    <input
                      type="number"
                      step={['KG', 'L', 'M'].includes(modalProduto.unidade?.toUpperCase() || '') ? "0.01" : "1"}
                      min="0"
                      value={modalProduto.estoque_atual || 0}
                      onChange={(e) => setModalProduto({ ...modalProduto, estoque_atual: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Saldo no momento do cadastro</span>
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    step={['KG', 'L', 'M'].includes(modalProduto.unidade?.toUpperCase() || '') ? "0.01" : "1"}
                    min="0"
                    value={modalProduto.estoque_minimo || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, estoque_minimo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Gera aviso quando atingido</span>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalProduto(null)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} text-white rounded-xl font-bold text-xs shadow-xs transition-all`}
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Importar Planilha Excel com Fechamento ao Clicar Fora */}
      {modalImportar && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalImportar(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-800 text-base">Importação em Massa (.xlsx)</h3>
              <button
                type="button"
                onClick={() => setModalImportar(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Importe seus produtos direto do Excel. O sistema reconhece colunas como: <strong>Nome, Preco_Venda, Codigo_Barras, Estoque_Atual</strong>.
            </p>

            <form onSubmit={handleUploadPlanilha} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-sky-500 transition-colors">
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setArquivoUpload(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              {resultadoUpload && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                  ✅ Processados: {resultadoUpload.total_processados} | Novos: {resultadoUpload.total_criados} | Atualizados: {resultadoUpload.total_atualizados}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalImportar(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !arquivoUpload}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {uploading ? 'Importando...' : 'Processar Planilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentar Estoque com Fechamento ao Clicar Fora */}
      {modalMov && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalMov(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
              <h3 className="font-bold text-slate-800 text-sm">Ajuste de Estoque</h3>
              <button
                type="button"
                onClick={() => setModalMov(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-sky-600 font-bold mb-3">{modalMov.produto.nome}</p>

            <form onSubmit={handleMovimentarEstoque} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Movimentação</label>
                <select
                  value={modalMov.tipo}
                  onChange={(e) => setModalMov({ ...modalMov, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="ENTRADA">Entrada (+ Adicionar)</option>
                  <option value="SAIDA">Saída (- Baixa Manual)</option>
                  <option value="AJUSTE">Ajustar Saldo Total (= Balanço)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantidade {['KG', 'L', 'M'].includes(modalMov.produto.unidade?.toUpperCase() || '') ? '(Decimal)' : '(Número Inteiro)'}
                </label>
                <input
                  type="number"
                  step={['KG', 'L', 'M'].includes(modalMov.produto.unidade?.toUpperCase() || '') ? "0.01" : "1"}
                  min={modalMov.tipo === 'AJUSTE' ? '0' : '1'}
                  required
                  value={modalMov.qtd}
                  onChange={(e) => setModalMov({ ...modalMov, qtd: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivo / Justificativa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra com fornecedor, acerto físico, avaria"
                  value={modalMov.motivo}
                  onChange={(e) => setModalMov({ ...modalMov, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMov(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} text-white rounded-xl font-bold text-xs shadow-xs`}
                >
                  Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
