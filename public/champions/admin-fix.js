(()=>{
  const byId=id=>document.getElementById(id);
  async function robustSaveTeam(){
    const nameEl=byId('name');
    const statusEl=byId('status');
    const logoEl=byId('logo');
    const msg=byId('teamMsg');
    const btn=[...document.querySelectorAll('button')].find(b=>/cadastrar equipe/i.test(b.textContent||''));
    const teamName=(nameEl?.value||'').trim();
    if(msg)msg.textContent='';
    if(!teamName){if(msg)msg.textContent='Digite o nome da equipe.';nameEl?.focus();return;}
    if(!key){if(msg)msg.textContent='Sessão de Admin expirada. Entre novamente.';return;}
    const old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Salvando...';}
    try{
      await call({
        action:'save_team',
        name:teamName,
        status:statusEl?.value||'Confirmada',
        logo_data:typeof logoData!=='undefined'&&logoData?logoData:null
      });
      if(nameEl)nameEl.value='';
      if(logoEl)logoEl.value='';
      if(typeof logoData!=='undefined')logoData='';
      if(msg){msg.style.color='#8dffad';msg.textContent='Equipe cadastrada com sucesso.';}
      await load();
      if(typeof loadCs==='function')try{await loadCs()}catch{}
      if(typeof tab==='function')tab('res');
    }catch(e){
      console.error('Cadastro de equipe:',e);
      if(msg){msg.style.color='#ffb5be';msg.textContent=e?.message||'Não foi possível cadastrar a equipe.';}
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'Cadastrar equipe';}
    }
  }
  window.saveTeam=robustSaveTeam;
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b||!/cadastrar equipe/i.test(b.textContent||''))return;
    e.preventDefault();e.stopImmediatePropagation();robustSaveTeam();
  },true);
})();