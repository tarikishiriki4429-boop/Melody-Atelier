'use strict';
// Melody Atelier v0.7.4: compact, one-button audio tools without replacing app.js/transcribe.js.
// This file only rearranges existing UI nodes. Audio processing/storage remains unchanged.
(()=>{
  function boot(){
    const options=document.querySelector('.melodyTabOptions');
    const midiFold=document.querySelector('.maImportFold');
    const originalFold=document.querySelector('.hybridPanel');
    if(!options||!midiFold||!originalFold){
      console.warn('Melody Atelier compact audio UI: v0.7.3 audio panels were not found.');
      return;
    }
    if(document.getElementById('maAudioToolsToggle'))return;

    const css=document.createElement('style');
    css.textContent=`
      .maAudioToolsToggle{font-size:13px!important;font-weight:700!important;min-height:36px!important;padding:6px 14px!important;border:1px solid #83c5bc!important;color:#dffcf6!important;background:#254c52!important;border-radius:10px!important;white-space:nowrap;flex:0 0 auto}
      .maAudioToolsToggle[aria-expanded="true"]{background:#477a79!important;border-color:#a9e1d7!important}
      .maAudioToolsToggle:focus-visible,.maAudioToolsBar button:focus-visible{outline:2px solid #c0f5ec;outline-offset:2px}
      .maAudioWorkspace[hidden],.maAudioWorkspace [hidden]{display:none!important}
      .maAudioWorkspace{border:1px solid #465875;border-radius:11px;background:#111d30;padding:10px 12px;margin:8px 0 2px;min-width:0}
      .maAudioToolsBar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px}
      .maAudioToolsBar button{font-size:12px!important;padding:7px 12px!important;min-height:34px!important;border-radius:9px;border:1px solid #516583;background:#202d43;color:#dbe7f7;touch-action:manipulation}
      .maAudioToolsBar button[aria-selected="true"]{background:#4c7e76;border-color:#83d0bf;color:#fff;font-weight:700}
      .maAudioToolsBar .maAudioClose{margin-left:auto;background:#33314c;border-color:#74658c;color:#fff}
      .maAudioWorkspace .maImportFold,.maAudioWorkspace .hybridPanel{margin:0!important;border:0!important;background:transparent!important;padding:0!important;border-radius:0!important;box-shadow:none!important}
      .maAudioWorkspace .maImportFold>summary,.maAudioWorkspace .hybridPanel>summary{display:none!important}
      .maAudioWorkspace .externalNoteImport{padding:9px 10px!important;margin:8px 0 0!important}
      .maAudioWorkspace .transcribeRow{margin-top:0!important;padding-top:0!important}
      @media (max-width:650px){.maAudioToolsToggle{padding:6px 10px!important}.maAudioWorkspace{padding:8px}.maAudioToolsBar button{padding:7px 10px!important}}
    `;
    document.head.appendChild(css);

    const toggle=document.createElement('button');
    toggle.id='maAudioToolsToggle';
    toggle.className='maAudioToolsToggle';
    toggle.type='button';
    toggle.textContent='♫ 音源編集';
    toggle.setAttribute('aria-controls','maAudioWorkspace');
    toggle.setAttribute('aria-expanded','false');
    toggle.title='MIDI・WAV読み込み／録音クリップ編集';
    const after=document.getElementById('deleteMelodyTab');
    if(after&&after.parentNode===options)after.after(toggle);
    else options.appendChild(toggle);

    const workspace=document.createElement('div');
    workspace.id='maAudioWorkspace';
    workspace.className='maAudioWorkspace';
    workspace.hidden=true;
    midiFold.before(workspace);
    const tabs=document.createElement('div');
    tabs.className='maAudioToolsBar';
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','音源編集の種類');
    const midiButton=document.createElement('button');
    midiButton.type='button';midiButton.textContent='♫ MIDI / WAV';
    midiButton.id='maMidiTab';midiButton.setAttribute('role','tab');
    const originalButton=document.createElement('button');
    originalButton.type='button';originalButton.textContent='🎹 録音・原音を編集';
    originalButton.id='maOriginalTab';originalButton.setAttribute('role','tab');
    const close=document.createElement('button');
    close.type='button';close.className='maAudioClose';close.textContent='✕ 閉じる';
    tabs.append(midiButton,originalButton,close);
    workspace.append(tabs,midiFold,originalFold);
    midiFold.open=true;
    originalFold.open=true;
    let selected='midi';
    function show(which){
      selected=which;
      midiFold.hidden=which!=='midi';
      originalFold.hidden=which!=='original';
      midiButton.setAttribute('aria-selected',String(which==='midi'));
      originalButton.setAttribute('aria-selected',String(which==='original'));
      midiButton.tabIndex=which==='midi'?0:-1;
      originalButton.tabIndex=which==='original'?0:-1;
    }
    function setOpen(open){
      workspace.hidden=!open;
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent=open?'♫ 音源編集 ▲':'♫ 音源編集';
      if(open)show(selected);
    }
    midiButton.onclick=()=>show('midi');
    originalButton.onclick=()=>show('original');
    toggle.onclick=()=>setOpen(workspace.hidden);
    close.onclick=()=>{
      setOpen(false);
      toggle.focus({preventScroll:true});
      // Return the editing surface to view after closing a long waveform panel.
      document.getElementById('melodyCanvas')?.scrollIntoView({block:'nearest',behavior:'auto'});
    };
    tabs.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();
      const which=selected==='midi'?'original':'midi';
      show(which);(which==='midi'?midiButton:originalButton).focus();
    });
    show('midi');
    setOpen(false);
    document.querySelectorAll('.branding small,.footer b').forEach(node=>{
      if(/^v0\.7\.\d+$/.test((node.textContent||'').trim()))node.textContent='v0.7.4';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
