
'use strict';
// Stand-alone browser audio reference. No remote requests, project mutation or export integration.
(()=>{
  const el=id=>document.getElementById(id);
  const widget=el('referenceWidget');
  if(!widget)return;
  const audio=el('referenceAudio'),input=el('referenceInput'),body=el('referenceBody');
  const toggle=el('referenceToggle'),smallPlay=el('referencePlayCompact'),play=el('referencePlay');
  const seek=el('referenceSeek'),current=el('referenceCurrent'),duration=el('referenceDuration');
  const fileName=el('referenceFileName'),indicator=el('referenceIndicator'),remove=el('referenceRemove');
  const hint=el('referenceHint'),volume=el('referenceVolume'),speed=el('referenceSpeed');
  let objectUrl=null,hasFile=false,draggingSeek=false;
  const stamp=sec=>{if(!Number.isFinite(sec)||sec<0)return '--:--';const s=Math.floor(sec);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  const setHint=str=>{hint.textContent=str;};
  const setExpanded=expanded=>{
    body.hidden=!expanded;widget.classList.toggle('is-collapsed',!expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    el('referenceCaret').textContent=expanded?'▼':'▲';
  };
  const updateState=()=>{
    const isPlaying=hasFile&&!audio.paused&&!audio.ended;
    const symbol=isPlaying?'Ⅱ':'▶';
    play.textContent=symbol;smallPlay.textContent=symbol;
    play.setAttribute('aria-label',isPlaying?'参考音声を一時停止':'参考音声を再生');
    smallPlay.setAttribute('aria-label',isPlaying?'参考音声を一時停止':'参考音声を再生');
    smallPlay.hidden=!hasFile;remove.hidden=!hasFile;play.disabled=!hasFile;
    indicator.className='referenceIndicator'+(isPlaying?' is-playing':hasFile?' is-ready':'');
  };
  const updateTime=()=>{
    current.textContent=stamp(audio.currentTime||0);
    duration.textContent=stamp(audio.duration);
    const valid=Number.isFinite(audio.duration)&&audio.duration>0;
    seek.disabled=!hasFile||!valid;
    if(!draggingSeek)seek.value=valid?String(Math.round(1000*Math.min(1,audio.currentTime/audio.duration))):'0';
  };
  const clearFile=()=>{
    audio.pause();audio.removeAttribute('src');audio.load();
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
    hasFile=false;fileName.textContent='未選択';fileName.title='';input.value='';
    current.textContent='0:00';duration.textContent='--:--';seek.value='0';seek.disabled=true;
    setHint('iPad内の音声を再生。曲の編集データには追加されません。');updateState();
  };
  el('referenceChoose').addEventListener('click',()=>input.click());
  toggle.addEventListener('click',()=>setExpanded(body.hidden));
  input.addEventListener('change',()=>{
    const f=input.files&&input.files[0];if(!f)return;
    // Don't decode or copy the entire file. Use a local blob URL so long recordings remain practical.
    clearFile();hasFile=true;objectUrl=URL.createObjectURL(f);
    fileName.textContent=f.name;fileName.title=f.name;
    audio.src=objectUrl;audio.preload='metadata';audio.playbackRate=Number(speed.value)||1;
    try{audio.volume=Number(volume.value)/100;}catch(e){}
    audio.load();setExpanded(true);updateState();updateTime();
    setHint('再生待機中。ファイルは外部送信されません。');
  });
  const togglePlay=async()=>{
    if(!hasFile){setExpanded(true);setHint('先に音声ファイルを選んでください。');return;}
    if(!audio.paused){audio.pause();updateState();return;}
    try{await audio.play();setHint('再生中。メロディーの編集はそのままできます。');}
    catch(e){setHint('再生できません。Safariが対応するWAV・M4A・MP3を試してください。');}
    updateState();
  };
  play.addEventListener('click',togglePlay);smallPlay.addEventListener('click',togglePlay);
  remove.addEventListener('click',clearFile);
  audio.addEventListener('loadedmetadata',()=>{updateTime();setHint('読み込み完了。▶で再生できます。');});
  audio.addEventListener('durationchange',updateTime);
  audio.addEventListener('timeupdate',updateTime);
  audio.addEventListener('play',updateState);
  audio.addEventListener('pause',updateState);
  audio.addEventListener('ended',()=>{updateState();updateTime();setHint('再生が終わりました。');});
  audio.addEventListener('error',()=>{if(hasFile)setHint('この形式を再生できません。WAV・M4A・MP3などを確認してください。');});
  seek.addEventListener('pointerdown',()=>{draggingSeek=true;});
  const scrub=()=>{if(!hasFile||!Number.isFinite(audio.duration)||audio.duration<=0)return;const time=audio.duration*Number(seek.value)/1000;try{audio.currentTime=time;}catch(e){}current.textContent=stamp(time);};
  seek.addEventListener('input',scrub);
  seek.addEventListener('change',()=>{scrub();draggingSeek=false;updateTime();});
  seek.addEventListener('pointerup',()=>{draggingSeek=false;updateTime();});
  seek.addEventListener('pointercancel',()=>{draggingSeek=false;updateTime();});
  volume.addEventListener('input',()=>{try{audio.volume=Number(volume.value)/100;}catch(e){setHint('このiPadでは本体の音量ボタンで調節してください。');}});
  speed.addEventListener('change',()=>{audio.playbackRate=Number(speed.value)||1;});
  window.addEventListener('pagehide',()=>{audio.pause();});
  updateState();setExpanded(false);
})();
