import { Crown, Shield, Trophy, Users } from 'lucide-react';

type Membro = { nome: string; funcao: string; valores: string; posicao: string };
type Time = { nome: string; tipo: string; arte: string; lema: string; membros: Membro[] };

const times: Time[] = [
  {
    nome: 'Time Alfa', tipo: 'Line-up oficial // FlowFire Guilda', arte: '/guilda-time-alfa.jpeg', lema: 'Juntos somos mais fortes.',
    membros: [
      { nome: '_.MIGUEL.X77', funcao: 'Capitao', valores: 'Lideranca • Coragem • Superacao', posicao: '14%' },
      { nome: 'DANTEZ', funcao: 'Assault', valores: 'Agressividade • Foco • Impacto', posicao: '39%' },
      { nome: 'LP PRECOSE', funcao: 'Treinador', valores: 'Estrategia • Visao • Lideranca', posicao: '63%' },
      { nome: 'CRD PURO', funcao: 'Suporte', valores: 'Suporte • Lealdade • Confianca', posicao: '87%' },
    ],
  },
  {
    nome: 'Time Beta', tipo: 'Line-up oficial // FlowFire Guilda', arte: '/guilda-time-beta.jpeg', lema: 'Precisao, protecao e controle.',
    membros: [
      { nome: '777-666', funcao: 'Capitao', valores: 'Lider • Foco • Agressividade', posicao: '14%' },
      { nome: 'DREEZY', funcao: 'Atirador', valores: 'Precisao • Calma • Eficiencia', posicao: '39%' },
      { nome: 'DNBRAM.OFIXU', funcao: 'Suporte', valores: 'Protecao • Lealdade • Estrategia', posicao: '63%' },
      { nome: 'BRUXO', funcao: 'Estrategista', valores: 'Inteligencia • Visao • Controle', posicao: '87%' },
    ],
  },
];

export function GuildaFlowFire() {
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
      <div className="ff-section-title"><div><span className="ff-kicker">Line-ups oficiais</span><h2>A TROPA JÁ ESTÁ ESCALADA.</h2></div><p>Dois times, oito identidades e uma so bandeira: FlowFire.</p></div>
      {times.map((time) => <article className="ff-guild-team" key={time.nome}>
        <div className="ff-guild-team-art"><img src={time.arte} alt={`Emblemas oficiais do ${time.nome} FlowFire`} /><div><span>{time.tipo}</span><h3>{time.nome}</h3><p>{time.lema}</p></div></div>
        <div className="ff-guild-roster">{time.membros.map((membro, index) => <article className="ff-guild-player" key={membro.nome}>
          <div className="ff-guild-player-art" style={{ backgroundImage: `url(${time.arte})`, backgroundPosition: `${membro.posicao} 48%` }}><span>0{index + 1}</span></div>
          <div className="ff-guild-player-copy"><p>{membro.funcao}</p><h4>{membro.nome}</h4><small>{membro.valores}</small><em>Historia em breve</em></div>
        </article>)}</div>
      </article>)}
    </section>

    <section className="ff-guild-archive max-w-6xl mx-auto"><div><span className="ff-kicker">Arquivo da guilda</span><h2>A HISTORIA COMECA<br />NA PROXIMA QUEDA.</h2><p>Os emblemas e a escalação oficial ja estao aqui. Quando voce enviar as historias, cada perfil vai receber seu capitulo dentro da Guilda FlowFire.</p></div><Crown aria-hidden="true" /></section>
  </div>;
}
