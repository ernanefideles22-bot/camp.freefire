import { Crown, Shield, Swords, Target, Trophy, Users } from 'lucide-react';

const frentes = [
  { nome: 'Linha de frente', funcao: 'CS // Controle e pressao', Icone: Swords, vagas: 4 },
  { nome: 'Elite Battle Royale', funcao: 'BR // Sobrevivencia e decisao', Icone: Target, vagas: 4 },
  { nome: 'Capitaes da tropa', funcao: 'Lideranca // Estrategia e uniao', Icone: Crown, vagas: 2 },
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
      <div className="ff-section-title"><div><span className="ff-kicker">O codigo da guilda</span><h2>UMA TROPA. VÁRIAS LENDAS.</h2></div><p>O painel vai registrar as line-ups oficiais e os feitos que cada membro construiu no jogo.</p></div>
      <div className="ff-guild-manifesto">
        <div><b>01</b><h3>Merito acima de tudo</h3><p>A vaga e conquistada em jogo: atitude, constancia e desempenho contam.</p></div>
        <div><b>02</b><h3>Times com identidade</h3><p>Cada line tera seu nome, emblema, jogadores e historia registrada.</p></div>
        <div><b>03</b><h3>Legado visivel</h3><p>Campeonatos, titulos e jogadas marcantes vao formar o arquivo da Guilda.</p></div>
      </div>
    </section>

    <section className="max-w-6xl mx-auto px-1">
      <div className="ff-section-title"><div><span className="ff-kicker">Line-ups oficiais</span><h2>A ESCALAÇÃO ESTÁ CHEGANDO.</h2></div><p>Os perfis serao revelados assim que os jogadores e seus emblemas forem definidos.</p></div>
      <div className="ff-guild-squads">
        {frentes.map(({ nome, funcao, Icone, vagas }) => <article className="ff-guild-squad" key={nome}>
          <div className="ff-guild-squad-head"><div className="ff-guild-icon"><Icone /></div><div><span>{funcao}</span><h3>{nome}</h3></div><em>{vagas} vagas</em></div>
          <div className="ff-guild-slots">{Array.from({ length: vagas }, (_, index) => <div className="ff-guild-slot" key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><b>Identidade em preparacao</b><small>Emblema e historia do jogador</small></div></div>)}</div>
        </article>)}
      </div>
    </section>

    <section className="ff-guild-archive max-w-6xl mx-auto"><div><span className="ff-kicker">Arquivo da guilda</span><h2>A HISTÓRIA COMEÇA<br />NA PRÓXIMA QUEDA.</h2><p>Quando voce enviar os nomes e emblemas, cada card vira um perfil oficial: funcao, time, conquistas e a historia do jogador no FlowFire.</p></div><Crown aria-hidden="true" /></section>
  </div>;
}
