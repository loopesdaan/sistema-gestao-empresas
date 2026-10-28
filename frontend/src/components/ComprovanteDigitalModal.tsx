import React, { useState, useEffect } from 'react';
import { 
  X, Printer, ChevronLeft, ChevronRight, Copy, Check, 
  Receipt, ShoppingBag, Calendar, User, CreditCard, Banknote, 
  Car, FileText
} from 'lucide-react';
import { Venda } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { resolveImageUrl } from '../services/api';
import { formatarNumeroVenda, formatarNumeroCaixa, formatDateSafe } from '../utils/formatters';

interface ComprovanteDigitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  venda?: Venda | null;
  listaVendas?: Venda[];
  indiceInicial?: number;
}

export const ComprovanteDigitalModal: React.FC<ComprovanteDigitalModalProps> = ({
  isOpen,
  onClose,
  venda,
  listaVendas = [],
  indiceInicial = 0,
}) => {
  const { empresa, temaAtual } = useEmpresa();
  const [copiado, setCopiado] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(indiceInicial);

  // Determina lista e venda ativa
  const vendas = listaVendas.length > 0 ? listaVendas : (venda ? [venda] : []);
  const vendaAtiva = vendas[indiceAtual] || venda || null;

  useEffect(() => {
    setIndiceAtual(indiceInicial);
  }, [indiceInicial, isOpen]);

  if (!isOpen || !vendaAtiva) return null;

  const totalVendas = vendas.length;
  const temAnterior = indiceAtual > 0;
  const temProximo = indiceAtual < totalVendas - 1;

  const handleImprimir = () => {
    if (!vendaAtiva) return;
    const existingIframe = document.getElementById('comprovante-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'comprovante-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprovante de Venda ${formatarNumeroVenda(vendaAtiva)}</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            margin: 0;
            padding: 4px;
            width: 74mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; }
          .title { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 2px; }
          .item-row { margin-bottom: 3px; }
        </style>
      </head>
      <body>
        <div class="title">${empresa.nome_fantasia || empresa.razao_social || 'ESTABELECIMENTO'}</div>
        <div class="text-center">${empresa.cnpj ? 'CNPJ: ' + empresa.cnpj : ''}</div>
        <div class="text-center">${empresa.telefone ? 'TEL: ' + empresa.telefone : ''}</div>
        <div class="divider"></div>
        <div class="row"><span>DATA: ${formatDateSafe(vendaAtiva.created_at, { includeTime: true })}</span></div>
        <div class="row"><span>VENDA: ${formatarNumeroVenda(vendaAtiva)}</span><span>CAIXA: #${formatarNumeroCaixa(vendaAtiva.caixa_id)}</span></div>
        <div class="row"><span>OPERADOR: ${vendaAtiva.usuario_nome || 'Caixa'}</span></div>
        <div class="row"><span>CLIENTE: ${vendaAtiva.cliente_nome || 'Consumidor Final'}</span></div>
        <div class="divider"></div>
        <div class="bold">ITENS:</div>
        ${(vendaAtiva.itens || []).map(i => `
          <div class="item-row">
            <div class="row">
              <span>${i.quantidade}x ${i.produto_nome || 'Item'}</span>
              <span class="bold">R$ ${Number(i.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style="font-size: 9px; color: #555;">(R$ ${Number(i.valor_unitario || 0).toFixed(2)} un)</div>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="row"><span>SUBTOTAL:</span><span>R$ ${Number(vendaAtiva.valor_bruto || 0).toFixed(2)}</span></div>
        ${Number(vendaAtiva.desconto || 0) > 0 ? `<div class="row"><span>DESCONTO:</span><span>- R$ ${Number(vendaAtiva.desconto).toFixed(2)}</span></div>` : ''}
        ${Number(vendaAtiva.acrescimo || 0) > 0 ? `<div class="row"><span>ACRÉSCIMO:</span><span>+ R$ ${Number(vendaAtiva.acrescimo).toFixed(2)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="row bold" style="font-size: 12px;"><span>TOTAL:</span><span>R$ ${Number(vendaAtiva.valor_liquido || 0).toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="bold">PAGAMENTO:</div>
        ${(vendaAtiva.pagamentos || []).map(p => `
          <div class="row">
            <span>${p.forma_pagamento.replace('_', ' ')}:</span>
            <span>R$ ${Number(p.valor).toFixed(2)}</span>
          </div>
        `).join('')}
        ${totalTroco > 0 ? `<div class="row bold"><span>TROCO:</span><span>R$ ${totalTroco.toFixed(2)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="text-center" style="margin-top: 6px;">OBRIGADO PELA PREFERÊNCIA!</div>
        <div class="text-center" style="font-size: 9px;">Documento auxiliar sem valor fiscal</div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2500);
    }, 250);
  };

  const copiarTextoComprovante = () => {
    if (!vendaAtiva) return;
    const linhas = [
      `==============================`,
      `${empresa.nome_fantasia || empresa.razao_social || 'ESTABELECIMENTO'}`,
      `CNPJ: ${empresa.cnpj || '00.000.000/0001-00'}`,
      `Tel: ${empresa.telefone || '-'}`,
      `Data: ${formatDateSafe(vendaAtiva.created_at, { includeTime: true })}`,
      `Venda Nº: ${formatarNumeroVenda(vendaAtiva)} | Caixa: #${formatarNumeroCaixa(vendaAtiva.caixa_id)}`,
      `Operador: ${vendaAtiva.usuario_nome || 'Caixa'}`,
      `Cliente: ${vendaAtiva.cliente_nome || 'Consumidor Final'}`,
      `==============================`,
      `ITENS DA VENDA:`,
      ...(vendaAtiva.itens || []).map(i => `${i.quantidade}x ${i.produto_nome || 'Item'} - R$ ${(i.subtotal || 0).toFixed(2)}`),
      `------------------------------`,
      `SUBTOTAL: R$ ${(vendaAtiva.valor_bruto || 0).toFixed(2)}`,
      `DESCONTO: R$ ${(vendaAtiva.desconto || 0).toFixed(2)}`,
      `TOTAL A PAGAR: R$ ${(vendaAtiva.valor_liquido || 0).toFixed(2)}`,
      `PAGAMENTO:`,
      ...(vendaAtiva.pagamentos || []).map(p => `- ${p.forma_pagamento}: R$ ${p.valor.toFixed(2)} (Troco: R$ ${(p.troco || 0).toFixed(2)})`),
      `==============================`,
      `Obrigado pela preferência!`
    ];
    navigator.clipboard.writeText(linhas.join('\n'));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const totalPago = (vendaAtiva.pagamentos || []).reduce((acc, p) => acc + (p.valor || 0), 0);
  const totalTroco = (vendaAtiva.pagamentos || []).reduce((acc, p) => acc + (p.troco || 0), 0);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header do Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-xs`}>
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Comprovante Digital de Venda {formatarNumeroVenda(vendaAtiva)}
              </h3>
              <p className="text-[11px] text-slate-500">
                Visualização detalhada com navegação e impressão térmica
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Navegação Entre Comprovantes (quando há múltiplas vendas no caixa) */}
        {totalVendas > 1 && (
          <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
            <button
              onClick={() => setIndiceAtual(prev => Math.max(0, prev - 1))}
              disabled={!temAnterior}
              className="flex items-center gap-1 font-bold text-slate-700 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>

            <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
              Venda {indiceAtual + 1} de {totalVendas}
            </span>

            <button
              onClick={() => setIndiceAtual(prev => Math.min(totalVendas - 1, prev + 1))}
              disabled={!temProximo}
              className="flex items-center gap-1 font-bold text-slate-700 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span>Próxima</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Área do Cupom Digital (Estilo Impressão Térmica) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 flex justify-center">
          <div 
            id="area-comprovante-imprimir"
            className="w-full max-w-sm bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-mono text-xs text-slate-800 space-y-4"
          >
            {/* Cabeçalho Empresa */}
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
              {empresa.logo_url && (
                <img
                  src={resolveImageUrl(empresa.logo_url)}
                  alt="Logo"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  className="w-12 h-12 mx-auto rounded-lg object-contain mb-2 border border-slate-200 p-0.5 bg-white"
                />
              )}
              <h2 className="font-black text-sm uppercase tracking-wide">
                {empresa.nome_fantasia || empresa.razao_social || 'ESTABELECIMENTO'}
              </h2>
              {empresa.cnpj && <p className="text-[10px] text-slate-500">CNPJ: {empresa.cnpj}</p>}
              {empresa.endereco && <p className="text-[10px] text-slate-500 leading-tight">{empresa.endereco}</p>}
              {empresa.telefone && <p className="text-[10px] text-slate-500">Tel: {empresa.telefone}</p>}
            </div>

            {/* Metadados da Venda */}
            <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-3 leading-tight">
              <div className="flex justify-between">
                <span className="text-slate-500">DOC:</span>
                <span className="font-bold">VENDA {formatarNumeroVenda(vendaAtiva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DATA / HORA:</span>
                <span>{formatDateSafe(vendaAtiva.created_at, { includeTime: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CAIXA / OPERADOR:</span>
                <span>Caixa #{formatarNumeroCaixa(vendaAtiva.caixa_id)} - {vendaAtiva.usuario_nome || 'Operador'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CLIENTE:</span>
                <span className="font-bold truncate max-w-[180px]">{vendaAtiva.cliente_nome || 'Consumidor Final'}</span>
              </div>
            </div>

            {/* Lista de Itens */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Item / Qtd</span>
                <span>Subtotal</span>
              </div>
              <div className="space-y-1.5">
                {(vendaAtiva.itens || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-[11px]">
                    <div className="truncate max-w-[190px]">
                      <span className="font-bold">{item.quantidade}x</span> {item.produto_nome || `Produto #${item.produto_id}`}
                      <div className="text-[9px] text-slate-400">
                        R$ {Number(item.valor_unitario).toFixed(2)} cada
                      </div>
                    </div>
                    <span className="font-bold font-mono">
                      R$ {Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totais Financeiros */}
            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal Bruto:</span>
                <span className="font-mono">R$ {Number(vendaAtiva.valor_bruto || 0).toFixed(2)}</span>
              </div>
              {Number(vendaAtiva.desconto || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Desconto:</span>
                  <span className="font-mono">- R$ {Number(vendaAtiva.desconto).toFixed(2)}</span>
                </div>
              )}
              {Number(vendaAtiva.acrescimo || 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Acréscimo:</span>
                  <span className="font-mono">+ R$ {Number(vendaAtiva.acrescimo).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                <span>TOTAL LIQUIDO:</span>
                <span className="text-emerald-700 font-mono">
                  R$ {Number(vendaAtiva.valor_liquido || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Pagamentos Realizados */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Formas de Pagamento:
              </span>
              {(vendaAtiva.pagamentos || []).map((pag, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{pag.forma_pagamento.replace('_', ' ')}:</span>
                  <span className="font-mono font-bold">R$ {Number(pag.valor).toFixed(2)}</span>
                </div>
              ))}
              {totalTroco > 0 && (
                <div className="flex justify-between text-sky-700 font-bold pt-1">
                  <span>Troco Devolvido:</span>
                  <span className="font-mono">R$ {totalTroco.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Rodapé / Mensagem de Agradecimento */}
            <div className="text-center pt-1 text-[10px] text-slate-400 space-y-1">
              <p className="font-bold text-slate-600">OBRIGADO PELA PREFERÊNCIA!</p>
              <p>Documento auxiliar sem valor fiscal para fins de conferência.</p>
            </div>
          </div>
        </div>

        {/* Barra de Ações Inferior */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={copiarTextoComprovante}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copiado ? 'Copiado!' : 'Copiar Texto'}</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleImprimir}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${temaAtual.bgGradiente} shadow-md transition-all`}
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

