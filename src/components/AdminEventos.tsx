import { useState } from 'react';
import { Gift, Swords, Trophy } from 'lucide-react';
import { AdminBonus } from './AdminBonus';
import { AdminEquipes } from './AdminEquipes';
import { AdminPago } from './AdminPago';

type Categoria = 'bonus' | 'individual' | 'equipes';
interface Props { onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void; }

export function AdminEventos({ onAddToast }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('individual');
  const opcoes: { id: Categoria; label: string; Icone: typeof Gift }[] = [
    { id: 'individual', label: 'Individual', Icone: Trophy },
    { id: 'equipes', label: 'Equipes', Icone: Swords },
    { id: 'bonus', label: 'Bônus', Icone: Gift },
  ];
  return <div className="space-y-5">
    <div><h2 className="text-lg font-black text-white">Eventos e campeonatos</h2><p className="text-xs text-zinc-500 mt-1">Crie e acompanhe todos os formatos em um só lugar.</p></div>
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-1.5 gap-1">
      {opcoes.map(({ id, label, Icone }) => <button key={id} onClick={() => setCategoria(id)} className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${categoria === id ? 'bg-primary text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Icone className="w-3.5 h-3.5" />{label}</button>)}
    </div>
    {categoria === 'individual' && <AdminPago onAddToast={onAddToast} />}
    {categoria === 'equipes' && <AdminEquipes onAddToast={onAddToast} />}
    {categoria === 'bonus' && <AdminBonus onAddToast={onAddToast} />}
  </div>;
}
