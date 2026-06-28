import { useState, useEffect, useCallback } from 'react';
import { Banknote } from 'lucide-react';
import { apiService } from '../services/api';
import type { SaqueRequisicao } from '../services/api';

const TIPOS = [
  { v: 'cpf', label: 'CPF' },
  { v: 'email', label: 'E-mail' },
  { v: 'telefone', label: 'Telefone' },
  { v: 'aleatoria', label: 'Aleatoria' },
];

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

export default function PixSaque({ saldoSacavel, saldo = 0 }: { saldoSacavel: number; saldo?: number }) {
  const [valor, setValor] = useState('');
  const [chave, setChave] = useState('');
  const [tipo, setTipo] = useState('cpf');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [saques, setSaques] = useState<SaqueRequisicao[]>([]);

  // Pela propria chave CPF saca TUDO (deposito + premio); por outras chaves, so o premio.
  const limite = tipo === 'cpf' ? saldo : saldoSacavel;

  const carregar = useCallback(async () => {
    try { setSaques(await apiService.meusSaques()); } catch { /* silencioso */ }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setOk('');
    const v = parseFloat(valor.replace(',', '.'));
    if (!valor || isNaN(v) || v < 5) { setErro('Saque minimo: R$ 5,00'); return; }
    if (tipo !== 'cpf' && !chave.trim()) { setErro('Informe sua chave PIX'); return; }
    if (v > limite) {
      setErro(tipo === 'cpf'
        ? `Valor acima do seu saldo (${brl(saldo)}).`
        : `Por essa chave voce so saca premios: ${brl(saldoSacavel)}. Use sua chave CPF para sacar o deposito.`);
      return;
    }
    setLoading(true);
    try {
      const r = await apiService.solicitarSaque(v, tipo === 'cpf' ? '' : chave.trim(), tipo);
      setOk(r.message || 'Saque solicitado!');
      setValor(''); setChave('');
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao solicitar saque');
    } finally {
      setLoading(false);
    }
  }

  const statusBadge = (st: string) =>
    st === 'pago' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : st === 'rejeitado' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    : st === 'processando' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Sacar via PIX</p>
      <div className="text-[10px] text-zinc-500 mb-3 space-y-0.5">
        <p>Premios (qualquer chave): <span className="font-mono font-bold text-emerald-400">{brl(saldoSacavel)}</span></p>
        <p>Total incl. deposito (so pra sua chave CPF): <span className="font-mono font-bold text-emerald-400">{brl(saldo)}</span></p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" inputMode="decimal" placeholder="Valor (min. R$ 5,00)" value={valor}
          onChange={e => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none font-mono placeholder:text-zinc-600" />
        <div className="grid grid-cols-4 gap-1.5">
          {TIPOS.map(t => (
            <button key={t.v} type="button" onClick={() => setTipo(t.v)}
              className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                tipo === t.v ? 'bg-primary border-primary text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}>{t.label}</button>
          ))}
        </div>
        {tipo === 'cpf' ? (
          <div className="text-[10px] text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
            Vai direto pro seu CPF cadastrado (o do deposito). Nao precisa digitar.
          </div>
        ) : (
          <input type="text" placeholder="Sua chave PIX" value={chave} onChange={e => setChave(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none placeholder:text-zinc-600" />
        )}
        {erro && <p className="text-xs text-rose-400 font-semibold">{erro}</p>}
        {ok && <p className="text-xs text-emerald-400 font-semibold">{ok}</p>}
        <button type="submit" disabled={loading || limite < 5}
          className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 border border-zinc-700">
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
          ) : (
            <><Banknote className="w-4 h-4" />Solicitar Saque</>
          )}
        </button>
        <p className="text-[10px] text-zinc-600">
          <strong>Chave CPF (a sua):</strong> saca tudo, inclusive o deposito.{' '}
          <strong>Outras chaves:</strong> so os premios ganhos. Deposito recente pode ficar
          retido alguns dias por seguranca (anti-estorno).
        </p>
      </form>
      {saques.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Meus Saques</p>
          {saques.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <span className="text-xs font-bold text-white font-mono">{brl(s.valor)}</span>
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
