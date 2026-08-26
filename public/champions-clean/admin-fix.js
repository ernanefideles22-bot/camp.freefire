(()=>{
  const byId=id=>document.getElementById(id);
  let savingTeam=false;

  function getSaveButton(){
    return byId('cad')?.querySelector('button.btn') || [...document.querySelectorAll('#cad button')].find(b=>/cadastrar|salvar/i.test(b.textContent||'')) || null;
  }

  function resetTeamForm(){
    const nameEl=byId('name');
    const statusEl=byId('status');
    const logoEl=byId('logo');
    if(nameEl){nameEl.value='';nameEl.disabled=false;}
    if(statusEl){statusEl.value='Confirmada';statusEl.disabled=false;}
    if(logoEl){logoEl.value='';logoEl.disabled=false;}
    if(typeof logoData!=='undefined')logoData='';
    const btn=getSaveButton();
    if(btn){btn.disabled=false;btn.textContent='Cadastrar equipe';btn.removeAttribute('aria-busy');}
  }

  async function robustSaveTeam(){
    if(savingTeam)return;
    const nameEl=byId('name');
    const statusEl=byId('status');
    const msg=byId('teamMsg');
    const btn=getSaveButton();
    const teamName=(nameEl?.value||'').trim();

    if(msg){msg.style.color='#ffb5be';msg.textContent='';}
    if(!teamName){if(msg)msg.textContent='Digite o nome da equipe.';nameEl?.focus();return;}
    if(!key){if(msg)msg.textContent='Sessão de Admin expirada. Entre novamente.';return;}

    savingTeam=true;
    if(btn){btn.disabled=true;btn.textContent='Salvando...';btn.setAttribute('aria-busy','true');}

    try{
      await call({
        action:'save_team',
        name:teamName,
        status:statusEl?.value||'Confirmada',
        logo_data:typeof logoData!=='undefined'&&logoData?logoData:null
      });

      await load();
      resetTeamForm();
      if(typeof tab==='function')tab('cad');
      if(msg){msg.style.color='#8dffad';msg.textContent='Equipe cadastrada. Já pode cadastrar a próxima.';}
      setTimeout(()=>nameEl?.focus(),60);
    }catch(e){
      console.error('Cadastro de equipe:',e);
      if(msg){msg.style.color='#ffb5be';msg.textContent=e?.message||'Não foi possível cadastrar a equipe.';}
    }finally{
      savingTeam=false;
      const currentBtn=getSaveButton();
      if(currentBtn){currentBtn.disabled=false;currentBtn.textContent='Cadastrar equipe';currentBtn.removeAttribute('aria-busy');}
      if(nameEl)nameEl.disabled=false;
      if(statusEl)statusEl.disabled=false;
      const logoEl=byId('logo');if(logoEl)logoEl.disabled=false;
    }
  }

  window.saveTeam=robustSaveTeam;

  document.addEventListener('click',e=>{
    const b=e.target.closest('#cad button');
    if(!b)return;
    const isSave=b===getSaveButton() || /cadastrar equipe|salvando/i.test(b.textContent||'');
    if(!isSave)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    robustSaveTeam();
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Enter' && document.activeElement?.closest?.('#cad') && document.activeElement?.id!=='logo'){
      e.preventDefault();robustSaveTeam();
    }
  });
})();