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
  return <div className="space-y-5 ff-event-command">
    <div className="ff-command-hero">
      <div className="relative z-10"><p className="ff-kicker">Centro de comando</p><h2>Eventos e campeonatos</h2><p>Configure a proxima disputa, acompanhe inscricoes e mantenha cada modalidade sob controle.</p></div>
      <div className="ff-command-code relative z-10">EVENT<br /><b>OPS</b></div>
    </div>
    <div className="ff-command-tabs max-w-full">
      {opcoes.map(({ id, label, Icone }) => <button key={id} onClick={() => setCategoria(id)} className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${categoria === id ? 'is-active' : ''}`}><Icone className="w-3.5 h-3.5" />{label}</button>)}
    </div>
    {categoria === 'individual' && <AdminPago onAddToast={onAddToast} />}
    {categoria === 'equipes' && <AdminEquipes onAddToast={onAddToast} />}
    {categoria === 'bonus' && <AdminBonus onAddToast={onAddToast} />}
  </div>;
}
