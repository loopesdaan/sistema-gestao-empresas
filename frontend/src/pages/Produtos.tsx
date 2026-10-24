import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Produto } from '../types';
import { 
  Package, Search, Plus, FileSpreadsheet, AlertTriangle, 
  ArrowUpDown, Edit, Check, X, Upload 
} from 'lucide-react';

export const Produtos: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const usuarioSalvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
  const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  const podeMovimentarEstoque = isAdmin ?? (usuarioLogado?.perfil === 'ADMIN' || usuarioLogado?.perfil === 'ESTOQUISTA');

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] = useState(false);

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

  useEffect(() => {
    carregarProdutos();
  }, [busca, filtroEstoqueBaixo]);

  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProduto || !modalProduto.nome) return;

    try {
      if (modalProduto.id) {
        await apiService.atualizarProduto(modalProduto.id, modalProduto);
      } else {
        await apiService.criarProduto(modalProduto);
      }
      setModalProduto(null);
      carregarProdutos();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar produto');
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
      setModalMov(null);
      carregarProdutos();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao movimentar estoque');
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
      carregarProdutos();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao importar planilha');
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
          <h2 className="text-xl font-bold text-slate-800">Produtos & Estoque</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento completo do catálogo, preços, códigos de barra e níveis de estoque.
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
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus size={16} />
              <span>Novo Produto</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou categoria..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setFiltroEstoqueBaixo(!filtroEstoqueBaixo)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filtroEstoqueBaixo
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <AlertTriangle size={14} />
          <span>Apenas Estoque Baixo</span>
        </button>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Código / Categoria</th>
                <th className="py-3 px-4 text-right">Preço Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtos.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {prod.nome}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <span>{prod.codigo_barras || 'Sem código'}</span>
                      {prod.categoria && (
                        <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {prod.categoria}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatMoney(prod.preco_venda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        prod.estoque_baixo || prod.estoque_atual <= 0 ? 'text-amber-600' : 'text-slate-800'
                      }`}>
                        {formatEstoque(prod.estoque_atual)} {prod.unidade}
                        {prod.estoque_baixo && (
                          <AlertTriangle size={13} className="text-amber-500" />
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        prod.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {prod.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {podeMovimentarEstoque ? (
                        <>
                          <button
                            onClick={() => setModalMov({ produto: prod, tipo: 'ENTRADA', qtd: 1, motivo: 'Entrada avulsa' })}
                            title="Ajustar estoque (Admin / Estoquista)"
                            className="p-1 text-slate-500 hover:text-sky-600 rounded"
                          >
                            <ArrowUpDown size={15} />
                          </button>
                          <button
                            onClick={() => setModalProduto(prod)}
                            title="Editar produto (Admin / Estoquista)"
                            className="p-1 text-slate-500 hover:text-sky-600 rounded"
                          >
                            <Edit size={15} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">Somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar / Editar Produto */}
      {modalProduto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="font-bold text-slate-800 text-lg mb-4">
              {modalProduto.id ? 'Editar Produto' : 'Novo Produto'}
            </h3>
            <form onSubmit={handleSalvarProduto} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={modalProduto.nome || ''}
                  onChange={(e) => setModalProduto({ ...modalProduto, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código de Barras (EAN)</label>
                  <input
                    type="text"
                    value={modalProduto.codigo_barras || ''}
                    onChange={(e) => setModalProduto({ ...modalProduto, codigo_barras: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={modalProduto.categoria || ''}
                    onChange={(e) => setModalProduto({ ...modalProduto, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preço Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={modalProduto.preco_custo || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, preco_custo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preço Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalProduto.preco_venda || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, preco_venda: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-sky-700 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                  <input
                    type="text"
                    value={modalProduto.unidade || 'UN'}
                    onChange={(e) => setModalProduto({ ...modalProduto, unidade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estoque Atual {['KG', 'L', 'M'].includes(modalProduto.unidade?.toUpperCase() || '') ? '(Decimal)' : '(Inteiro)'}
                  </label>
                  <input
                    type="number"
                    step={['KG', 'L', 'M'].includes(modalProduto.unidade?.toUpperCase() || '') ? "0.01" : "1"}
                    min="0"
                    value={modalProduto.estoque_atual || 0}
                    onChange={(e) => setModalProduto({ ...modalProduto, estoque_atual: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalProduto(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm shadow-xs"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Importar Planilha Excel */}
      {modalImportar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-slate-800 text-lg mb-1">Importar via Excel (.xlsx)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Selecione uma planilha contendo colunas: <strong>Nome, Preco_Venda, Codigo_Barras, Estoque_Atual</strong>.
            </p>

            <form onSubmit={handleUploadPlanilha} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-sky-500 transition-colors">
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setArquivoUpload(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
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
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !arquivoUpload}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {uploading ? 'Importando...' : 'Processar Planilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentar Estoque Avulso */}
      {modalMov && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="font-bold text-slate-800 text-base mb-1">Ajuste de Estoque</h3>
            <p className="text-xs text-sky-600 font-medium mb-4">{modalMov.produto.nome}</p>

            <form onSubmit={handleMovimentarEstoque} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Movimentação</label>
                <select
                  value={modalMov.tipo}
                  onChange={(e) => setModalMov({ ...modalMov, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="ENTRADA">Entrada (+)</option>
                  <option value="SAIDA">Saída (-)</option>
                  <option value="AJUSTE">Ajustar Saldo Total (=)</option>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: Compra de mercadoria, perda, acerto de inventário"
                  value={modalMov.motivo}
                  onChange={(e) => setModalMov({ ...modalMov, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMov(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

