import { ArrowRight, Crown, Crosshair, Flame, Play, Shield, Swords, Trophy, Users } from 'lucide-react';

interface Props {
  onAbrirCampeonatos: () => void;
  onAbrirRanking: () => void;
  onAbrirGuilda: () => void;
}

const modos = [
  { icon: Crosshair, titulo: 'Individual', texto: 'Entre sozinho, prove sua mira e dispute cada posição.', marca: 'BR • SOLO' },
  { icon: Swords, titulo: 'Contra Squad', texto: 'Monte a line e encare CS de 1x1 até 4x4.', marca: 'CS • EQUIPE' },
  { icon: Trophy, titulo: 'Eventos especiais', texto: 'Quedas bônus, premiação e ranking que ficam salvos.', marca: 'BÔNUS • AO VIVO' },
];

export function Inicio({ onAbrirCampeonatos, onAbrirRanking, onAbrirGuilda }: Props) {
  return <div className="ff-home space-y-16 pb-8">
    <section className="ff-home-hero">
      <div className="ff-home-vignette" />
      <div className="ff-home-content">
        <div className="ff-kicker flex items-center gap-2"><Flame className="w-3.5 h-3.5" /> FlowFire Champions // Temporada 01</div>
        <h1>ONDE A TROPA<br /><span>VIRA LENDA.</span></h1>
        <p>Campeonatos de Free Fire com sua cara: CS, Battle Royale, ranking em tempo real e premiação por evento.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={onAbrirCampeonatos} className="ff-home-cta cursor-pointer"><Play className="w-4 h-4 fill-current" /> Entrar na arena</button>
          <button onClick={onAbrirRanking} className="ff-home-ghost cursor-pointer"><Trophy className="w-4 h-4" /> Ver ranking</button>
          <button onClick={onAbrirGuilda} className="ff-home-ghost cursor-pointer"><Crown className="w-4 h-4" /> Conhecer a Guilda</button>
        </div>
      </div>
      <div className="ff-home-hud"><span><i /> Arena online</span><b>SEASON<br />01</b></div>
    </section>

    <section className="ff-home-guild">
      <div className="ff-home-guild-copy"><span className="ff-kicker flex items-center gap-2"><Crown className="w-3.5 h-3.5" /> Destaque FlowFire</span><h2>A GUILDA JÁ<br /><span>ENTROU NA ARENA.</span></h2><p>Time Alfa e Time Beta representam os melhores da FlowFire. Conheça os emblemas, as formações e as histórias que estão construindo o legado da nossa irmandade.</p><div className="ff-home-guild-stats"><span><b>02</b> Times oficiais</span><span><b>08</b> Lendas escaladas</span></div><button onClick={onAbrirGuilda} className="ff-home-cta cursor-pointer"><Crown className="w-4 h-4" /> Conhecer a Guilda <ArrowRight className="w-4 h-4" /></button></div>
      <div className="ff-home-guild-art" aria-hidden="true"><img className="ff-home-guild-alfa" src="/guilda-time-alfa.jpeg" alt="" /><img className="ff-home-guild-beta" src="/guilda-time-beta.jpeg" alt="" /><div>FLOWFIRE<br /><b>GUILDA</b></div></div>
    </section>

    <section className="max-w-6xl mx-auto px-1">
      <div className="ff-section-title"><div><span className="ff-kicker">Escolha seu combate</span><h2>JOGUE DO SEU JEITO.</h2></div><p>Uma central de campeonato, três formas de entrar na disputa.</p></div>
      <div className="ff-home-modes">
        {modos.map(({ icon: Icon, titulo, texto, marca }, index) => <article className={`ff-home-mode ff-home-mode-${index + 1}`} key={titulo}>
          <div className="ff-home-mode-shade" />
          <div className="relative z-10"><div className="ff-home-mode-icon"><Icon className="w-5 h-5" /></div><span>{marca}</span><h3>{titulo}</h3><p>{texto}</p><button onClick={onAbrirCampeonatos} className="ff-home-link cursor-pointer">Explorar modo <ArrowRight className="w-4 h-4" /></button></div>
        </article>)}
      </div>
    </section>

    <section className="ff-home-player max-w-6xl mx-auto">
      <div className="ff-home-player-copy"><span className="ff-kicker">Tudo em um só lugar</span><h2>NÃO É SÓ ENTRAR.<br /><span>É SUBIR DE NÍVEL.</span></h2><p>Crie sua equipe, acompanhe salas e resultados, veja o ranking e receba sua premiação no mesmo lugar.</p><div className="ff-home-points"><span><Shield /> Salas protegidas</span><span><Users /> Inscrição por equipe</span><span><Trophy /> Ranking persistente</span></div><button onClick={onAbrirCampeonatos} className="ff-home-ghost cursor-pointer">Conhecer os campeonatos <ArrowRight className="w-4 h-4" /></button></div>
    </section>

    <section className="ff-home-final max-w-6xl mx-auto"><div><span className="ff-kicker">Pronto para a próxima queda?</span><h2>A ARENA ESTÁ<br />ESPERANDO VOCÊ.</h2></div><button onClick={onAbrirCampeonatos} className="ff-home-cta cursor-pointer">Ver eventos abertos <ArrowRight className="w-4 h-4" /></button></section>
  </div>;
}
