import { useState } from 'react';
import { Crown, Shield, Trophy, Users, X } from 'lucide-react';

type Membro = { nome: string; funcao: string; titulo: string; valores: string; historia: string; lema: string; posicao: string; arte: string };
type Time = { nome: string; tipo: string; arte: string; lema: string; membros: Membro[] };

const times: Time[] = [
  {
    nome: 'Time Alfa', tipo: 'FlowFire — Time Alfa', arte: '/guilda-time-alfa.jpeg', lema: 'Os primeiros a entrar. Os ultimos a recuar.',
    membros: [
      { nome: '_.miguel.x77', funcao: 'Capitao', titulo: 'A Fenix Imperial', valores: 'Lideranca • Coragem • Superacao', historia: 'Dizem que a Fenix nao vence porque nunca perde. Ela vence porque sempre renasce mais forte. Miguel e o comandante do Time Alfa. Enquanto muitos enxergam apenas a troca de tiros, ele ve o campo de batalha inteiro. Sua lideranca transforma jogadores em equipe, e sua presenca inspira confianca mesmo nas partidas mais dificeis.', lema: 'Um lider nunca pede para seguirem seu caminho. Ele abre o caminho.', posicao: '14%', arte: '/guilda-time-alfa.jpeg' },
      { nome: 'Dantez', funcao: 'Assaltante', titulo: 'A Sombra de Guerra', valores: 'Agressividade • Foco • Impacto', historia: 'Dantez e quem rompe as linhas inimigas. Silencioso antes da batalha e implacavel quando ela comeca, sua velocidade decide confrontos antes mesmo que o adversario consiga reagir.', lema: 'Quando voce me ve, ja e tarde.', posicao: '39%', arte: '/guilda-time-alfa.jpeg' },
      { nome: 'LP Precose', funcao: 'Treinador', titulo: 'O Leao Imperial', valores: 'Estrategia • Visao • Lideranca', historia: 'Toda grande equipe precisa de alguem que enxergue alem do presente. LP Precose e o estrategista da FlowFire. Enquanto os jogadores lutam, ele calcula possibilidades, estuda adversarios e prepara cada batalha. Sua arma nao e a mira, mas a inteligencia.', lema: 'Quem domina a estrategia, domina a guerra.', posicao: '63%', arte: '/guilda-time-alfa.jpeg' },
      { nome: 'CRD Puro', funcao: 'Suporte', titulo: 'O Guardiao', valores: 'Suporte • Lealdade • Confianca', historia: 'Nem toda vitoria pertence a quem faz mais eliminacoes. CRD Puro protege seus companheiros, cobre avancos e mantem o Time Alfa unido. Sua disciplina permite que os outros brilhem.', lema: 'A maior forca de uma equipe e permanecer unida.', posicao: '87%', arte: '/guilda-time-alfa.jpeg' },
    ],
  },
  {
    nome: 'Time Beta', tipo: 'FlowFire — Time Beta', arte: '/guilda-time-beta.jpeg', lema: 'Forjados para desafiar qualquer limite.',
    membros: [
      { nome: '777-666', funcao: 'Capitao', titulo: 'O Lobo Negro', valores: 'Lider • Foco • Agressividade', historia: 'O Lobo Negro lidera pelo exemplo. Determinado, feroz e leal ao seu grupo, conduz o Time Beta com coragem e disciplina, sempre buscando provar que a segunda formacao pode superar qualquer expectativa.', lema: 'A alcateia e tao forte quanto seu lider.', posicao: '14%', arte: '/guilda-time-beta.jpeg' },
      { nome: 'Dreezy', funcao: 'Atirador', titulo: 'O Cacador Fantasma', valores: 'Precisao • Calma • Eficiencia', historia: 'Poucos percebem sua presenca ate que seja tarde. Dreezy e paciente, preciso e letal. Cada disparo e calculado para decidir o combate.', lema: 'Uma bala. Um destino.', posicao: '39%', arte: '/guilda-time-beta.jpeg' },
      { nome: 'DNBRAM_OFIXU', funcao: 'Suporte', titulo: 'O Corvo Guardiao', valores: 'Protecao • Lealdade • Estrategia', historia: 'Sempre atento ao campo de batalha, protege seus aliados e identifica oportunidades antes dos adversarios. Sua lealdade faz do Time Beta uma equipe dificil de quebrar.', lema: 'Quem observa primeiro, sobrevive por ultimo.', posicao: '63%', arte: '/guilda-time-beta.jpeg' },
      { nome: 'Bruxo', funcao: 'Estrategista', titulo: 'O Arcanista das Sombras', valores: 'Inteligencia • Visao • Controle', historia: 'Bruxo e imprevisivel. Gosta de criar jogadas incomuns, surpreender adversarios e encontrar caminhos que ninguem imaginava.', lema: 'Toda batalha e vencida primeiro na mente.', posicao: '87%', arte: '/guilda-time-beta.jpeg' },
    ],
  },
];

export function GuildaFlowFire() {
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);

  return <div className="ff-guild space-y-12 pb-8">
    <section className="ff-guild-hero">
      <div className="ff-guild-signal"><i /> RECRUTAMENTO SELETIVO</div>
      <div className="relative z-10 ff-guild-copy">
        <p className="ff-kicker flex items-center gap-2"><Crown className="w-3.5 h-3.5" /> Guilda oficial FlowFire</p>
        <h1>NEM TODO MUNDO<br /><span>ENTRA PARA A LENDA.</span></h1>
        <p>Somente os melhores jogadores do FlowFire conquistam a honra de vestir este emblema. Aqui, cada time e cada jogador tera sua propria historia dentro da arena.</p>
        <div className="ff-guild-badges"><span><Shield /> Disciplina</span><span><Trophy /> Resultado</span><span><Users /> Tropa</span></div>
      </div>
      <div className="ff-guild-mark" aria-hidden="true">FF<br /><b>GUILD</b></div>
    </section>

    <section className="max-w-6xl mx-auto px-1">
      <div className="ff-section-title"><div><span className="ff-kicker">O codigo da guilda</span><h2>UMA TROPA. VARIAS LENDAS.</h2></div><p>O painel registra as line-ups oficiais e os feitos que cada membro construiu no jogo.</p></div>
      <div className="ff-guild-manifesto">
        <div><b>01</b><h3>Merito acima de tudo</h3><p>A vaga e conquistada em jogo: atitude, constancia e desempenho contam.</p></div>
        <div><b>02</b><h3>Times com identidade</h3><p>Cada line tem seu emblema, seus jogadores e sua propria assinatura.</p></div>
        <div><b>03</b><h3>Legado visivel</h3><p>Campeonatos, titulos e jogadas marcantes vao formar o arquivo da Guilda.</p></div>
      </div>
    </section>

    <section className="max-w-6xl mx-auto px-1 space-y-9">
      <div className="ff-section-title"><div><span className="ff-kicker">Line-ups oficiais</span><h2>A TROPA JA ESTA ESCALADA.</h2></div><p>Toque em um integrante para abrir sua historia na Guilda.</p></div>
      {times.map((time) => <article className="ff-guild-team" key={time.nome}>
        <div className="ff-guild-team-art"><img src={time.arte} alt={`Emblemas oficiais do ${time.nome} FlowFire`} /><div><span>{time.tipo}</span><h3>{time.nome}</h3><p>{time.lema}</p></div></div>
        <div className="ff-guild-roster">{time.membros.map((membro, index) => <button type="button" className="ff-guild-player" key={membro.nome} onClick={() => setMembroSelecionado(membro)} aria-label={`Abrir historia de ${membro.nome}`}>
          <div className="ff-guild-player-art" style={{ backgroundImage: `url(${membro.arte})`, backgroundPosition: `${membro.posicao} 48%` }}><span>0{index + 1}</span></div>
          <div className="ff-guild-player-copy"><p>{membro.funcao}</p><h4>{membro.nome}</h4><b>{membro.titulo}</b><small>{membro.valores}</small><em>Ler historia →</em></div>
        </button>)}</div>
      </article>)}
    </section>

    <section className="ff-guild-archive max-w-6xl mx-auto"><div><span className="ff-kicker">Lema oficial da FlowFire</span><h2>UMA IRMANDADE<br />DE CAMPEOES.</h2><p>“Nao somos apenas jogadores. Somos uma irmandade. Onde houver fogo, havera FlowFire. Onde houver batalha, havera campeoes.”</p></div><Crown aria-hidden="true" /></section>

    {membroSelecionado && <div className="ff-guild-modal" role="presentation" onClick={() => setMembroSelecionado(null)}>
      <section className="ff-guild-profile" role="dialog" aria-modal="true" aria-label={`Historia de ${membroSelecionado.nome}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ff-guild-close" onClick={() => setMembroSelecionado(null)} aria-label="Fechar historia"><X /></button>
        <div className="ff-guild-profile-art" style={{ backgroundImage: `url(${membroSelecionado.arte})`, backgroundPosition: `${membroSelecionado.posicao} 48%` }} />
        <div className="ff-guild-profile-copy"><p className="ff-kicker">{membroSelecionado.funcao}</p><h3>{membroSelecionado.nome}</h3><h4>{membroSelecionado.titulo}</h4><p>{membroSelecionado.historia}</p><blockquote>“{membroSelecionado.lema}”</blockquote></div>
      </section>
    </div>}
  </div>;
}
