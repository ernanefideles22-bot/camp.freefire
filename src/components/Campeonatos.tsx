import { useState } from 'react';
import { Gift, Swords, Trophy } from 'lucide-react';
import { QuedaBonus } from './QuedaBonus';
import { CampeonatosEquipe } from './CampeonatosEquipe';
import type { Jogador } from '../services/api';

type Categoria = 'bonus' | 'individual' | 'equipes';

interface Props {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const opcoes: { id: Categoria; titulo: string; descricao: string; Icone: typeof Gift }[] = [
  { id: 'bonus', titulo: 'Grátis', descricao: 'Quedas bônus', Icone: Gift },
  { id: 'individual', titulo: 'Individual', descricao: 'Torneios pagos', Icone: Trophy },
  { id: 'equipes', titulo: 'Equipes', descricao: 'CS e BR', Icone: Swords },
];

export function Campeonatos({ currentUser, onAddToast }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('individual');

  return (
    <div className="space-y-6">
      <div className="max-w-3xl mx-auto text-center space-y-2">
        <h1 className="text-2xl font-black text-white">Campeonatos</h1>
        <p className="text-sm text-zinc-500">Escolha o formato em que quer jogar.</p>
      </div>
      <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-2">
        {opcoes.map(({ id, titulo, descricao, Icone }) => (
          <button key={id} onClick={() => setCategoria(id)} className={`rounded-xl px-3 py-3 text-left transition-all cursor-pointer ${categoria === id ? 'bg-primary text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
            <Icone className="w-4 h-4 mb-2" />
            <span className="block text-xs font-black">{titulo}</span>
            <span className={`block text-[10px] mt-0.5 ${categoria === id ? 'text-white/75' : 'text-zinc-600'}`}>{descricao}</span>
          </button>
        ))}
      </div>
      {categoria === 'bonus' && <QuedaBonus currentUser={currentUser} onAddToast={onAddToast} />}
      {categoria === 'individual' && <QuedaBonus tipo="pago" currentUser={currentUser} onAddToast={onAddToast} />}
      {categoria === 'equipes' && <CampeonatosEquipe currentUser={currentUser} onAddToast={onAddToast} />}
    </div>
  );
}
