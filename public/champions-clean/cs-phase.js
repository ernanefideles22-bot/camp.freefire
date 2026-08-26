(()=>{
  let csMatches=[];
  const rounds=[['R16','Oitavas'],['QF','Quartas'],['SF','Semifinais'],['F','Final']];
  const escCs=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const teamById=id=>(typeof teams!=='undefined'?teams:[]).find(t=>t.id===id)||null;
  const teamHtml=(id,winnerId,admin,round,mn)=>{
    const t=teamById(id);
    if(!t)return `<div class="cs-team cs-empty"><span>Aguardando...</span></div>`;
    const logo=t.logo_data?`<img src="${t.logo_data}" alt="">`:`<div class="cs-dot">${escCs((t.name||'?')[0])}</div>`;
    const cls=id===winnerId?' win':'';
    if(admin)return `<button type="button" class="cs-team cs-team-btn${cls}" onclick="setCsWinner('${round}',${mn},'${id}')">${logo}<span>${escCs(t.name)}</span>${id===winnerId?'<b>✓</b>':''}</button>`;
    return `<div class="cs-team${cls}">${logo}<span>${escCs(t.name)}</span>${id===winnerId?'<b>✓</b>':''}</div>`;
  };
  const matchCard=(m,admin=false)=>`<div class="cs-match"><div class="cs-match-label">Jogo ${m.match_number}</div>${teamHtml(m.team1_id,m.winner_id,admin,m.round,m.match_number)}<div class="cs-vs">VS</div>${teamHtml(m.team2_id,m.winner_id,admin,m.round,m.match_number)}</div>`;
  function ensureUi(){
    if(!document.getElementById('csPublic')){
      const rank=document.getElementById('rankingCards');
      const section=rank?.closest('section');
      if(section){
        const el=document.createElement('section');
        el.id='csPublic';el.className='cs-phase';
        el.innerHTML=`<div class="container"><div class="eyebrow">Segunda fase • Modo CS</div><h2>Chave CS</h2><div class="cs-info">Os 16 melhores do BR avançam para a fase eliminatória.</div><div id="csBracket" class="cs-bracket"></div><div id="csPodium"></div></div>`;
        section.insertAdjacentElement('afterend',el);
      }
    }
    const panel=document.getElementById('panel');
    const tabs=panel?.querySelector('.tabs');
    if(panel&&tabs&&!document.getElementById('csTabBtn')){
      const b=document.createElement('button');b.id='csTabBtn';b.className='tab';b.textContent='Fase CS';b.onclick=()=>tab('cs');tabs.appendChild(b);
      const p=document.createElement('div');p.id='cs';p.className='panel';p.innerHTML=`<div class="admin-cs"><button class="btn" style="width:100%" onclick="generateCsBracket()">Gerar chave CS com Top 16 do BR</button><small>Isso recria a chave usando a classificação BR atual.</small><div id="csAdminMsg" class="msg"></div><div id="csAdminMatches" class="cs-admin-list"></div></div>`;panel.appendChild(p);
    }
    if(!document.getElementById('cs-extra-style')){
      const s=document.createElement('style');s.id='cs-extra-style';s.textContent=`
      .cs-info{color:#9c919f;font-size:12px;margin:-12px 0 16px}.cs-bracket{grid-template-columns:repeat(4,minmax(235px,1fr))}.cs-round{min-width:235px}.cs-round-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}.cs-round-title span{font-size:10px;color:#766d7d}.cs-match-label{font-size:9px;color:#8f8496;text-transform:uppercase;letter-spacing:.08em}.cs-vs{text-align:center;color:#6d6373;font-size:9px;font-weight:800}.cs-team-btn{width:100%;color:#fff;text-align:left;font:inherit}.cs-team b{margin-left:auto;color:#ff8d2c}.cs-dot{width:30px;height:30px;border-radius:6px;background:#17111d;display:grid;place-items:center;font-family:'Russo One',sans-serif;color:#ff8b2c}.cs-admin-list{display:grid;gap:18px;margin-top:16px}.cs-admin-round{display:grid;gap:9px}.cs-admin-round h4{font-family:'Russo One',sans-serif;color:#ff9a3d;margin:0;text-transform:uppercase;font-weight:400}.cs-podium{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.cs-podium-card{padding:14px;border-radius:13px;border:1px solid #33283a;background:#0c0910}.cs-podium-card.gold{border-color:rgba(255,211,77,.55)}.cs-podium-card.bronze{border-color:rgba(217,130,63,.55)}.cs-podium-card small{display:block;color:#918794;text-transform:uppercase;font-size:9px}.cs-podium-card strong{display:block;margin-top:6px;font-family:'Russo One',sans-serif;font-weight:400}.cs-third{margin-top:14px}.cs-third h3{font-family:'Russo One',sans-serif;color:#d9823f;text-transform:uppercase;font-weight:400;font-size:14px}.cs-empty-state{padding:18px;border:1px dashed #392e40;border-radius:13px;color:#8f8496;text-align:center}.cs-team-btn:disabled{cursor:not-allowed;opacity:.7}@media(max-width:680px){.cs-podium{grid-template-columns:1fr}.cs-bracket{grid-template-columns:repeat(4,235px)}}`;
      document.head.appendChild(s);
    }
  }
  function renderCs(){
    ensureUi();
    const bracket=document.getElementById('csBracket');
    if(bracket){
      if(!csMatches.length){bracket.innerHTML='<div class="cs-empty-state">A fase CS ainda não foi gerada.</div>';}
      else bracket.innerHTML=rounds.map(([code,label])=>{
        const ms=csMatches.filter(m=>m.round===code).sort((a,b)=>a.match_number-b.match_number);
        return `<div class="cs-round"><div class="cs-round-title"><h3>${label}</h3><span>${ms.length} jogo${ms.length===1?'':'s'}</span></div>${ms.length?ms.map(m=>matchCard(m,false)).join(''):'<div class="cs-empty-state">Aguardando</div>'}</div>`;
      }).join('');
    }
    const third=csMatches.find(m=>m.round==='3P');
    const final=csMatches.find(m=>m.round==='F'&&m.match_number===1);
    const champion=final?.winner_id?teamById(final.winner_id):null;
    const thirdTeam=third?.winner_id?teamById(third.winner_id):null;
    const podium=document.getElementById('csPodium');
    if(podium){
      let html='';
      if(third)html+=`<div class="cs-third"><h3>Disputa de 3º lugar</h3>${matchCard(third,false)}</div>`;
      if(champion||thirdTeam)html+=`<div class="cs-podium">${champion?`<div class="cs-podium-card gold"><small>🏆 Campeão</small><strong>${escCs(champion.name)}</strong></div>`:''}${thirdTeam?`<div class="cs-podium-card bronze"><small>🥉 3º Lugar</small><strong>${escCs(thirdTeam.name)}</strong></div>`:''}</div>`;
      podium.innerHTML=html;
    }
    const adm=document.getElementById('csAdminMatches');
    if(adm){
      if(!csMatches.length)adm.innerHTML='<div class="cs-empty-state">Gere a chave para começar a fase CS.</div>';
      else{
        const adminRounds=[...rounds,['3P','3º Lugar']];
        adm.innerHTML=adminRounds.map(([code,label])=>{const ms=csMatches.filter(m=>m.round===code).sort((a,b)=>a.match_number-b.match_number);if(!ms.length)return'';return `<div class="cs-admin-round"><h4>${label}</h4>${ms.map(m=>matchCard(m,true)).join('')}</div>`}).join('');
      }
    }
  }
  async function loadCs(){
    try{
      ensureUi();
      const {data,error}=await db.from('flowfire_clean_cs_matches').select('*');
      if(error)throw error;
      csMatches=data||[];
      renderCs();
    }catch(e){console.error('CS:',e)}
  }
  window.generateCsBracket=async()=>{
    const msg=document.getElementById('csAdminMsg');if(msg)msg.textContent='Gerando chave...';
    try{await call({action:'generate_cs_bracket'});if(msg)msg.textContent='Chave criada com os 16 classificados do BR.';await loadCs()}catch(e){if(msg)msg.textContent=e.message||'Erro ao gerar chave.'}
  };
  window.setCsWinner=async(round,match_number,winner_id)=>{
    const t=teamById(winner_id);if(!t)return;
    if(!confirm(`Definir ${t.name} como vencedor deste confronto?`))return;
    try{await call({action:'set_cs_winner',round,match_number,winner_id});await loadCs()}catch(e){alert(e.message||'Erro ao salvar vencedor.')}
  };
  ensureUi();
  setTimeout(loadCs,900);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCs()});
})();