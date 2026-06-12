import { useState, useEffect, useCallback } from 'react';
import { Banknote, Landmark, Pencil } from 'lucide-react';
import { apiService } from '../services/api';
import type { SaqueRequisicao, DadosBancarios } from '../services/api';

const BANCOS = [
  { c: '260', n: 'Nubank' }, { c: '104', n: 'Caixa' }, { c: '001', n: 'Banco do Brasil' },
  { c: '237', n: 'Bradesco' }, { c: '341', n: 'Itaú' }, { c: '033', n: 'Santander' },
  { c: '077', n: 'Inter' }, { c: '336', n: 'C6 Bank' }, { c: '380', n: 'PicPay' },
  { c: '323', n: 'Mercado Pago' }, { c: '290', n: 'PagBank' }, { c: '280', n: 'Will Bank' },
  { c: '655', n: 'Neon' }, { c: '403', n: 'Cora' },
];

export default function PixSaque({ saldo }: { saldo: number }) {
  const [dados, setDados] = useState<DadosBancarios | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ banco_codigo: '', agencia: '', conta: '', tipo_conta: 'CHECKING', titular_nome: '', titular_doc: '', chave_pix: '' });
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [saques, setSaques] = useState<SaqueRequisicao[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([apiService.obterDadosBancarios(), apiService.meusSaques()]);
      setDados(d);
      setSaques(s);
      if (d.completo) {
        setForm({ banco_codigo: d.banco_codigo || '', agencia: d.agencia || '', conta: d.conta || '', tipo_conta: d.tipo_conta || 'CHECKING', titular_nome: d.titular_nome || '', titular_doc: d.titular_doc || '', chave_pix: d.chave_pix || '' });
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setOk(''); setLoading(true);
    try {
      await apiService.salvarDadosBancarios(form as any);
      setOk('Dados bancários salvos!');
      setEditando(false);
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar dados');
    } finally { setLoading(false); }
  }

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setOk('');
    const v = parseFloat(valor.replace(',', '.'));
    if (!valor || isNaN(v) || v < 5) { setErro('Saque mínimo: R$ 5,00'); return; }
    if (v > saldo) { setErro('Saldo insuficiente'); return; }
    setLoading(true);
    try {
      const r = await apiService.solicitarSaque(v);
      setOk(r.message || 'Saque solicitado!');
      setValor('');
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao solicitar saque');
    } finally { setLoading(false); }
  }

  const inputCls = "w-full bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none placeholder:text-zinc-600";
  const statusBadge = (st: string) =>
    st === 'pago' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : st === 'rejeitado' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    : st === 'processando' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  const nomeBanco = (c: string | null) => BANCOS.find(b => b.c === c)?.n || c;

  const precisaCadastro = !dados?.completo || editando;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Sacar Ganhos via PIX</p>

      {precisaCadastro ? (
        <form onSubmit={salvarDados} className="space-y-2.5">
          <p className="text-[10px] text-zinc-500 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-primary" />Cadastre sua conta bancária uma única vez. O pagamento é feito direto pelo banco.</p>
          <select value={form.banco_codigo} onChange={e => setForm({ ...form, banco_codigo: e.target.value })} className={inputCls} required>
            <option value="">Selecione seu banco</option>
            {BANCOS.map(b => <option key={b.c} value={b.c}>{b.n} ({b.c})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Agência (sem dígito)" value={form.agencia} maxLength={4}
              onChange={e => setForm({ ...form, agencia: e.target.value.replace(/\D/g, '') })} className={inputCls} required />
            <input type="text" placeholder="Conta com dígito" value={form.conta} maxLength={13}
              onChange={e => setForm({ ...form, conta: e.target.value.replace(/[^0-9-]/g, '') })} className={inputCls} required />
          </div>
          <select value={form.tipo_conta} onChange={e => setForm({ ...form, tipo_conta: e.target.value })} className={inputCls}>
            <option value="CHECKING">Conta Corrente</option>
            <option value="SAVINGS">Poupança</option>
            <option value="PAYMENT">Conta Pagamento/Salário</option>
          </select>
          <input type="text" placeholder="Nome completo do titular" value={form.titular_nome}
            onChange={e => setForm({ ...form, titular_nome: e.target.value })} className={inputCls} required />
          <input type="text" placeholder="CPF do titular (só números)" value={form.titular_doc} maxLength={14}
            onChange={e => setForm({ ...form, titular_doc: e.target.value.replace(/\D/g, '') })} className={inputCls} required />
          <input type="text" placeholder="Sua chave PIX (conferência)" value={form.chave_pix}
            onChange={e => setForm({ ...form, chave_pix: e.target.value })} className={inputCls} required />
          {erro && <p className="text-xs text-rose-400 font-semibold">{erro}</p>}
          {ok && <p className="text-xs text-emerald-400 font-semibold">{ok}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm cursor-pointer disabled:opacity-60 hover:opacity-90 transition-all">
              {loading ? 'Salvando...' : 'Salvar Dados Bancários'}
            </button>
            {dados?.completo && (
              <button type="button" onClick={() => { setEditando(false); setErro(''); }}
                className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-bold cursor-pointer hover:text-white">Cancelar</button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-[10px] text-zinc-400">
              <p className="font-bold text-zinc-300">{nomeBanco(dados!.banco_codigo)} · Ag {dados!.agencia} · CC {dados!.conta}</p>
              <p className="text-zinc-600">{dados!.titular_nome}</p>
            </div>
            <button onClick={() => { setEditando(true); setOk(''); setErro(''); }}
              className="p-2 rounded-lg text-zinc-500 hover:text-white cursor-pointer" title="Editar dados bancários"><Pencil className="w-3.5 h-3.5" /></button>
          </div>
          <form onSubmit={solicitar} className="space-y-3">
            <input type="text" inputMode="decimal" placeholder="Valor do saque (mín. R$ 5,00)" value={valor}
              onChange={e => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
              className={inputCls + ' font-mono'} />
            {erro && <p className="text-xs text-rose-400 font-semibold">{erro}</p>}
            {ok && <p className="text-xs text-emerald-400 font-semibold">{ok}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 border border-zinc-700">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
              ) : (
                <><Banknote className="w-4 h-4" />Solicitar Saque</>
              )}
            </button>
            <p className="text-[10px] text-zinc-600">O valor é reservado na hora e cai na sua conta após a aprovação do pagamento.</p>
          </form>
        </div>
      )}

      {saques.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Meus Saques</p>
          {saques.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <span className="text-xs font-bold text-white font-mono">R$ {s.valor.toFixed(2).replace('.', ',')}</span>
                <p className="text-[9px] text-zinc-600">{s.criado_em}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border ${statusBadge(s.status)}`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
