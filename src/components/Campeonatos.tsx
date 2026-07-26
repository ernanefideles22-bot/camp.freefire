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
      <div className="ff-hero max-w-5xl mx-auto">
        <div className="relative z-10 max-w-xl space-y-2">
          <span className="ff-kicker">Central de combate</span>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Escolha sua <span className="text-gradient-neon">arena</span>.</h1>
          <p className="text-sm text-zinc-400">Entre na modalidade, acompanhe o placar ao vivo e lute pela premiação.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
        {opcoes.map(({ id, titulo, descricao, Icone }) => (
          <button key={id} onClick={() => setCategoria(id)} className={`ff-mode-card rounded-xl px-4 py-4 text-left transition-all cursor-pointer ${categoria === id ? 'is-active text-white' : 'text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${categoria === id ? 'bg-white/15 text-accent-cyan' : 'bg-zinc-900 text-zinc-500'}`}><Icone className="w-5 h-5" /></div>
            <span className="block text-sm font-black uppercase tracking-wide">{titulo}</span>
            <span className={`block text-[11px] mt-1 ${categoria === id ? 'text-white/70' : 'text-zinc-600'}`}>{descricao}</span>
            <span className={`block mt-4 text-[10px] font-black uppercase tracking-[.15em] ${categoria === id ? 'text-accent-cyan' : 'text-zinc-700'}`}>{categoria === id ? 'Selecionado // jogar' : 'Selecionar modo'}</span>
          </button>
        ))}
      </div>
      {categoria === 'bonus' && <QuedaBonus currentUser={currentUser} onAddToast={onAddToast} />}
      {categoria === 'individual' && <QuedaBonus tipo="pago" currentUser={currentUser} onAddToast={onAddToast} />}
      {categoria === 'equipes' && <CampeonatosEquipe currentUser={currentUser} onAddToast={onAddToast} />}
    </div>
  );
}
