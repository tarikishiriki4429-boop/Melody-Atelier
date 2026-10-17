'use strict';
/* Melody Atelier -> Music Atelier v0.9.2 compatibility exporter.
   No network or third-party dependencies; reads local project only. */
(()=>{
  const STORAGE_KEY='melody-atelier-project-v1';
  const MAX_MUSIC_BEATS=2400,MAX_MUSIC_SECONDS=360;
  const $=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  const crcTable=(()=>{const a=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;a[i]=c>>>0;}return a;})();
  const crc32=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  const encoder=new TextEncoder();
  function zip(entries){
    const parts=[],central=[];let offset=0;
    for(const [name,value] of entries){
      const n=encoder.encode(name),b=value instanceof Uint8Array?value:encoder.encode(value),check=crc32(b);
      const l=new Uint8Array(30+n.length),v=new DataView(l.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,0,true);
      v.setUint32(14,check,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);l.set(n,30);
      parts.push(l,b);
      const cd=new Uint8Array(46+n.length),d=new DataView(cd.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,check,true);
      d.setUint32(20,b.length,true);d.setUint32(24,b.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);cd.set(n,46);central.push(cd);
      offset+=l.length+b.length;
    }
    let total=0;for(const c of central){parts.push(c);total+=c.length;}
    const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,total,true);v.setUint32(16,offset,true);parts.push(end);
    return new Blob(parts,{type:'application/zip'});
  }
  const notesFor=s=>{
    const tabs=Array.isArray(s.melodyTabs)&&s.melodyTabs.length?s.melodyTabs:[{notes:s.notes||[]}];
    return tabs.flatMap(t=>Array.isArray(t.notes)?t.notes:[]).filter(n=>Number.isFinite(+n.pitch)&&Number.isFinite(+n.start)&&Number.isFinite(+n.dur)&&n.dur>0)
      .map(n=>({pitch:clamp(Math.round(n.pitch),20,110),start:clamp(n.start,0,4096),dur:clamp(n.dur,.0625,32),kana:String(n.kana||'')}))
      .sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  };
  function makeBridge(project){
    if(project?.version!==1||!Array.isArray(project.sections))throw Error('Melody Atelierの保存データが見つかりません。');
    const bpm=clamp(project.bpm,40,240),beats=[3,4,6].includes(+project.beats)?+project.beats:4;
    const sections=[];let cursor=0,noteCount=0;
    for(const s of project.sections){
      const notes=notesFor(s);noteCount+=notes.length;
      const clipLength=Array.isArray(s.chordClips)?Math.max(0,...s.chordClips.map(c=>(+c.start||0)+(+c.beats||0))):0;
      const stepsLen=(s.chords||[]).reduce((v,c)=>v+Math.max(0,+c.beats||0),0);
      const harmonyLen=Math.max(0,...(s.harmonies||[]).map(h=>(+h.start||0)+(+h.beats||0)));
      const melodyLen=Math.max(0,...notes.map(n=>n.start+n.dur));
      const raw=Math.max(melodyLen,clipLength,stepsLen,harmonyLen,+s.manualBeats||0);
      const length=raw?Math.ceil(raw/beats)*beats:0;
      sections.push({name:String(s.name||'ブロック').slice(0,40),lyrics:String(s.lyrics||''),reading:String(s.reading||''),startBeat:cursor,lengthBeats:Math.max(1,length),bars:Math.max(1,Math.ceil(length/beats)),root:clamp(s.root,0,11),mode:s.mode==='minor'?'minor':'major',notes,chords:Array.isArray(s.chords)?s.chords:[],harmonies:Array.isArray(s.harmonies)?s.harmonies:[]});
      cursor+=length+(length?clamp(s.gap,0,64):0);
    }
    if(noteCount===0&&!sections.some(s=>s.chords.length))throw Error('書き出す音符・コードがありません。');
    if(sections.length>40)throw Error('Music Atelierは最大40ブロックです。');
    if(cursor>MAX_MUSIC_BEATS)throw Error('Music Atelierの2400拍制限を超えています。');
    if(cursor*60/bpm>MAX_MUSIC_SECONDS)throw Error('Music Atelierは曲全体が6分以内です。');
    const bridge={format:'melody-voice-bridge',version:1,source:'Melody Atelier Music-compatible exporter',title:String(project.title||'新しい曲'),bpm,beats,sections};
    return {bridge,noteCount,beatsTotal:cursor};
  }
  const notify=s=>{const x=$('musicBridgeHint');if(x)x.textContent=s;const toast=$('toast');if(toast){toast.textContent=s;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4700);}};
  async function downloadMusic(){
    const button=$('exportMusicDirect');button.disabled=true;
    try{
      // Allow the existing 400ms auto-save debounce to flush before reading.
      await new Promise(resolve=>setTimeout(resolve,500));
      const raw=localStorage.getItem(STORAGE_KEY);if(!raw)throw Error('このURLの端末保存に曲がありません。プロジェクト保存を確認してください。');
      const project=JSON.parse(raw),{bridge,noteCount,beatsTotal}=makeBridge(project);
      const archive=zip([['bridge.json',JSON.stringify(bridge)],['melody-project.json',raw]]);
      const url=URL.createObjectURL(archive),a=document.createElement('a');a.href=url;a.download=(project.title||'melody').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,50)+'-Music連携.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      notify(`Music用ZIPを作成：${noteCount}音・${beatsTotal}拍。Music Atelierの「Melody Atelierから」で読み込めます。`);
    }catch(e){notify('Music連携ZIPの作成に失敗：'+(e?.message||String(e)));}
    finally{button.disabled=false;}
  }
  function boot(){
    if($('exportMusicDirect'))return;
    const source=$('exportVoice');if(!source)return;
    const button=document.createElement('button');button.id='exportMusicDirect';button.type='button';button.className=source.className||'outline small';button.textContent='↘ Music Atelierへ渡すZIP';button.addEventListener('click',downloadMusic);
    source.insertAdjacentElement('afterend',button);
    button.title='Voice用のガイド音声とは別形式。Music Atelierで編集できるメロディー音符とコード情報を保存します。';
    window.MelodyMusicBridgeTest={makeBridge,zip};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
