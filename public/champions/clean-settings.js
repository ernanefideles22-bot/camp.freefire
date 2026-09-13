(()=>{
  function metricStrong(label){
    const metric=[...document.querySelectorAll('.metric')].find(m=>m.querySelector('small')?.textContent.trim().toLowerCase()===label.toLowerCase());
    return metric?.querySelector('strong')||null;
  }
  function syncSettings(){
    const p=metricStrong('Período');
    const m=metricStrong('Modo');
    if(p)p.textContent=settings?.period||'';
    if(m)m.textContent=settings?.game_mode||'';
    const pi=document.getElementById('champPeriod');
    const mi=document.getElementById('champMode');
    if(pi && document.activeElement!==pi)pi.value=settings?.period||'';
    if(mi && document.activeElement!==mi)mi.value=settings?.game_mode||'';
  }
  function syncTop8Cs(){
    const info=document.querySelector('#csPublic .cs-info');
    if(info)info.textContent='Os 8 melhores do BR avançam para a fase eliminatória em CS.';
    const btn=[...document.querySelectorAll('#cs button.btn')].find(b=>b.textContent.includes('Gerar chave CS'));
    if(btn)btn.textContent='Gerar chave CS com Top 8 do BR';
    const small=document.querySelector('#cs .admin-cs small');
    if(small)small.textContent='Isso recria a chave usando os 8 melhores da classificação BR atual.';
    const msg=document.getElementById('csAdminMsg');
    if(msg && msg.textContent.includes('16 classificados'))msg.textContent=msg.textContent.replace('16 classificados','8 classificados');
    if(!document.getElementById('cs-top8-style')){
      const s=document.createElement('style');
      s.id='cs-top8-style';
      s.textContent='#csBracket{grid-template-columns:repeat(3,minmax(235px,1fr))!important}#csBracket .cs-round:first-child{display:none!important}@media(max-width:680px){#csBracket{grid-template-columns:repeat(3,235px)!important}}';
      document.head.appendChild(s);
    }
  }
  function install(){
    const tabs=document.querySelector('#panel .tabs');
    if(!tabs||document.getElementById('camp')){syncSettings();syncTop8Cs();return;}
    const b=document.createElement('button');
    b.className='tab'; b.type='button'; b.textContent='Campeonato'; b.onclick=()=>tab('camp');
    tabs.appendChild(b);
    const camp=document.createElement('div');
    camp.id='camp'; camp.className='panel';
    camp.innerHTML=`<div class="field"><label>Período</label><input id="champPeriod" placeholder="Ex.: 31 AGO — 06 SET"></div><div class="field"><label>Modo de jogo</label><input id="champMode" placeholder="Ex.: SQUAD, SOLO, DUO"></div><button class="btn" type="button" id="saveChampSettings">Salvar campeonato</button><div id="champSettingsMsg" class="msg"></div>`;
    const res=document.getElementById('res');
    res?.after(camp);
    document.getElementById('saveChampSettings').onclick=async()=>{
      const msg=document.getElementById('champSettingsMsg');
      msg.textContent='';
      try{
        await call({action:'save_settings',event_name:settings?.event_name||'Fusão Suprema',period:document.getElementById('champPeriod').value.trim(),game_mode:document.getElementById('champMode').value.trim(),kill_point:+(settings?.kill_point||0),placement_points:settings?.placement_points||{}});
        await load();
        syncSettings();
        msg.style.color='#8dffad';msg.textContent='Configurações salvas.';
      }catch(e){msg.style.color='#ffb5be';msg.textContent=e?.message||'Não foi possível salvar.'}
    };
    syncSettings();
    syncTop8Cs();
  }
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){oldRender();install();syncSettings();syncTop8Cs();};
  const oldOpen=window.openAdmin;
  if(typeof oldOpen==='function')window.openAdmin=function(){oldOpen();install();syncSettings();syncTop8Cs();};
  document.addEventListener('DOMContentLoaded',()=>{install();syncSettings();syncTop8Cs();});
  setInterval(syncTop8Cs,700);
  setTimeout(()=>{install();syncSettings();syncTop8Cs();},400);
})();