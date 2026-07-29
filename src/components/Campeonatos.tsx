import { useEffect, useState } from 'react';
import { Gift, Swords, Trophy } from 'lucide-react';
import { QuedaBonus } from './QuedaBonus';
import { CampeonatosEquipe } from './CampeonatosEquipe';
import type { Jogador } from '../services/api';

type Categoria = 'bonus' | 'individual' | 'equipes';

interface Props {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const opcoes: { id: Categoria; titulo: string; descricao: string; detalhe: string; Icone: typeof Gift }[] = [
  { id: 'bonus', titulo: 'Grátis', descricao: 'Quedas bônus', detalhe: 'Entrada livre', Icone: Gift },
  { id: 'individual', titulo: 'Individual', descricao: 'Torneios pagos', detalhe: 'Ranking por evento', Icone: Trophy },
  { id: 'equipes', titulo: 'Equipes', descricao: 'CS e BR', detalhe: '1x1 até Squad', Icone: Swords },
];

export function Campeonatos({ currentUser, onAddToast }: Props) {
  const categoriaDoLink = (): Categoria => {
    const categoriaLink = window.location.hash.split('/')[1] as Categoria;
    return ['bonus', 'individual', 'equipes'].includes(categoriaLink) ? categoriaLink : 'individual';
  };
  const [categoria, setCategoria] = useState<Categoria>(categoriaDoLink);

  useEffect(() => {
    const sincronizarLink = () => setCategoria(categoriaDoLink());
    window.addEventListener('hashchange', sincronizarLink);
    return () => window.removeEventListener('hashchange', sincronizarLink);
  }, []);

  return (
    <div className="space-y-6">
      <div className="ff-hero ff-hero-art max-w-5xl mx-auto">
        <div className="ff-hero-copy relative z-10 space-y-2">
          <span className="ff-kicker">Central de combate</span>
          <h1 className="text-4xl sm:text-5xl font-black leading-[.92] text-white">A temporada começa <span className="text-gradient-neon">aqui.</span></h1>
          <p className="text-sm text-zinc-300 max-w-md">Entre na arena, forme sua equipe e suba no ranking de cada evento.</p>
          <div className="ff-hero-stats"><div className="ff-hero-stat"><b>03</b><span>Modos de jogo</span></div><div className="ff-hero-stat"><b>CS + BR</b><span>Formatos livres</span></div><div className="ff-hero-stat"><b>AO VIVO</b><span>Ranking por evento</span></div></div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
        {opcoes.map(({ id, titulo, descricao, detalhe, Icone }) => (
          <button key={id} onClick={() => setCategoria(id)} className={`ff-mode-card rounded-xl px-4 py-4 text-left transition-all cursor-pointer ${categoria === id ? 'is-active text-white' : 'text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${categoria === id ? 'bg-white/15 text-accent-cyan' : 'bg-zinc-900 text-zinc-500'}`}><Icone className="w-5 h-5" /></div>
            <span className="block text-sm font-black uppercase tracking-wide">{titulo}</span>
            <span className={`block text-[11px] mt-1 ${categoria === id ? 'text-white/70' : 'text-zinc-600'}`}>{descricao}</span>
            <span className={`inline-block mt-3 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${categoria === id ? 'bg-black/20 text-accent-cyan' : 'bg-zinc-900 text-zinc-500'}`}>{detalhe}</span>
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
