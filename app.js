'use strict';
(()=>{
  const $ = id => document.getElementById(id);
  const el = $('melodyCanvas'), viewport=$('canvasScroller');
  const CTX = window.AudioContext||window.webkitAudioContext;
  const ROOTS=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  // Fixed-do display names; pitch values, chord symbols, playback and MIDI remain unchanged.
  const SOLFEGE=['ド','ド♯','レ','ミ♭','ミ','ファ','ファ♯','ソ','ラ♭','ラ','シ♭','シ'];
  const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];

  // All presets are original, procedural starting shapes; none are transcriptions of songs.
  const MOODS=[
    {id:'crystal',name:'透明感',icon:'◇',tag:'透き通る高音・滑らかな上昇',mode:'major',bpm:94,base:1,rhythm:[1,1,1.5,.5,1,2],contour:[0,1,2,4,3,2,1,3],gap:0.0},
    {id:'melancholy',name:'切なさ',icon:'☂',tag:'ためらい・ゆるやかな下降',mode:'minor',bpm:78,base:0,rhythm:[1.5,.5,1.25,.75,2,1],contour:[4,3,2,1,2,0,-1,0],gap:.2},
    {id:'fragile',name:'儚さ',icon:'☁',tag:'余韻・小さく揺れる短いフレーズ',mode:'minor',bpm:80,base:2,rhythm:[.5,1.5,1,.5,2,1],contour:[2,3,2,1,0,2,1,-1],gap:.28},
    {id:'rush',name:'疾走感',icon:'➶',tag:'刻むリズム・駆け上がる音',mode:'major',bpm:162,base:1,rhythm:[.5,.5,.5,1,.5,.75,.75],contour:[0,1,2,4,3,4,5,6],gap:0},
    {id:'epic',name:'壮大',icon:'✺',tag:'広い音域・大きな跳躍・長い余韻',mode:'major',bpm:106,base:0,rhythm:[2,1,1,2,1,3],contour:[0,4,3,5,4,7,5,4],gap:.05},
    {id:'tension',name:'緊張感',icon:'△',tag:'短い音の反復・落ち着かない動き',mode:'minor',bpm:136,base:1,rhythm:[.5,.5,1,.5,.5,1.5],contour:[2,3,2,4,3,2,5,3],gap:0},
    {id:'unease',name:'不穏',icon:'◈',tag:'不規則な間・先が読めない音程',mode:'minor',bpm:92,base:-1,rhythm:[1,.75,.5,1.5,.5,2],contour:[1,0,3,-1,2,1,-2,3],gap:.22},
    {id:'hope',name:'希望',icon:'☀',tag:'明るい上昇・語尾を開く',mode:'major',bpm:120,base:1,rhythm:[1,1,.5,.5,2,1],contour:[0,1,2,3,4,5,6,4],gap:0},
    {id:'warm',name:'温もり',icon:'☕',tag:'穏やかな隣接音・自然な呼吸',mode:'major',bpm:86,base:0,rhythm:[1.5,1,1,.5,2,1],contour:[2,1,2,3,2,1,0,1],gap:.13},
    {id:'night',name:'夜景',icon:'☾',tag:'低めの音から静かに浮かぶ',mode:'minor',bpm:72,base:-1,rhythm:[2,1,.5,1.5,1,2],contour:[2,1,0,2,4,3,1,0],gap:.12},
    {id:'journey',name:'旅立ち',icon:'↗',tag:'踏み出すリズム・前へ進む線',mode:'major',bpm:128,base:1,rhythm:[1,.5,.5,1,2,.5,.5],contour:[0,2,1,3,4,2,5,4],gap:0},
    {id:'dream',name:'幻想',icon:'✧',tag:'浮遊する音程・不思議な回り道',mode:'minor',bpm:89,base:3,rhythm:[1.5,.5,1,1.5,.5,2],contour:[0,3,2,5,4,2,6,3],gap:.14},
    {id:'rock',name:'ロック',icon:'⚡',tag:'強い拍・反復・サビで跳ね上がる',mode:'minor',bpm:150,base:1,rhythm:[.5,.5,1,1,.5,.5,2],contour:[0,0,3,3,2,4,5,3],gap:0},
    {id:'silence',name:'静寂',icon:'○',tag:'音の少なさ・長い休符を生かす',mode:'minor',bpm:64,base:0,rhythm:[2,1.5,2.5,1,3],contour:[1,0,1,-1,0,2,1,0],gap:.5},
    {id:'release',name:'解放感',icon:'✹',tag:'サビ向け・高く開けるフレーズ',mode:'major',bpm:132,base:2,rhythm:[.5,.5,1,1,2,1,3],contour:[0,2,4,3,5,7,6,7],gap:0},
    {id:'lyrical',name:'叙情',icon:'❋',tag:'歌心のある揺れ・長短の対比',mode:'minor',bpm:96,base:1,rhythm:[1,1.5,.5,1,2,1],contour:[3,4,2,1,3,2,0,1],gap:.12}
  ];
  const SHAPES=[
    {name:'素直に流れる',summary:'起伏を抑えて、言葉を自然に流す',twist:0,rhythm:0},
    {name:'細かく刻む',summary:'短い音を多めに、軽やかに刻む',twist:1,rhythm:1},
    {name:'少しずつ上る',summary:'一音ずつ高まる期待を作る',twist:2,rhythm:2},
    {name:'静かに降りる',summary:'歌い終わりに向かって落ち着く',twist:3,rhythm:3},
    {name:'大胆に跳ねる',summary:'音の高低差をつけて印象を残す',twist:4,rhythm:4},
    {name:'同じ音を返す',summary:'反復で覚えやすい歌い出しに',twist:5,rhythm:5},
    {name:'間を置いて歌う',summary:'息継ぎと余白で表情をつける',twist:6,rhythm:6},
    {name:'最後に開く',summary:'終盤で大きく音域を広げる',twist:7,rhythm:7}
  ];
  let moodSelected=MOODS[0].id,moodSearch='',moodReroll=0;
  const moodById=id=>MOODS.find(m=>m.id===id)||MOODS[0];
  const limitValue=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  function stableRandom(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
  function presetId(mood,shape){return `${mood.id}:${shape}`;}
  function pitchDegree(deg,root,mode){const scale=mode==='minor'?MINOR:MAJOR;let oct=Math.floor(deg/7),index=((deg%7)+7)%7;return 60+root+oct*12+scale[index];}
  function candidateNotes(mood,shapeIndex,preview=false){
    const s=getSection(),raw=parseMora(s.reading||tryRead(s.lyrics).reading),syllables=preview?(raw.length>=10?raw.slice(0,16):Array.from({length:14},(_,i)=>raw.length?raw[i%raw.length]:'ら')):raw;
    if(!syllables.length)return [];
    const variant=SHAPES[shapeIndex],seed=(MOODS.indexOf(mood)+1)*9389+(shapeIndex+1)*2677+moodReroll*91121+(preview?0:0),rng=stableRandom(seed);
    const notes=[];let cursor=0,previousPitch=null;
    syllables.forEach((kana,i)=>{
      const phrase=i%8,step=Math.floor(i/8),rawDegree=mood.contour[(phrase+step+(moodReroll%4))%mood.contour.length],a=(i%4),jitter=rng()>.66?1:0;
      let deg=rawDegree+mood.base+(jitter?(rng()>.5?1:-1):0);
      if(shapeIndex===1)deg+=i%3===1?1:0;
      if(shapeIndex===2)deg+=Math.floor(phrase/2)-1;
      if(shapeIndex===3)deg-=Math.floor(phrase/2)-1;
      if(shapeIndex===4)deg+=(i%4===2?3:i%4===0?-1:0);
      if(shapeIndex===5)deg=previousPitch!==null&&i%3===1?previousPitch:deg;
      if(shapeIndex===6)deg+=(i%5===0?-1:0);
      if(shapeIndex===7)deg+=(phrase>=5?2:0);
      deg=limitValue(deg,-6,13);previousPitch=deg;
      let dur=mood.rhythm[(i+(moodReroll%3))%mood.rhythm.length];
      if(variant.rhythm===1)dur*=.55;
      if(variant.rhythm===2&&i%4===3)dur*=1.65;
      if(variant.rhythm===3&&i%4===3)dur*=1.4;
      if(variant.rhythm===4)dur*=i%3===0?1.4:.75;
      if(variant.rhythm===5)dur=i%4===1?.5:dur;
      if(variant.rhythm===6)dur*=i%4===3?1.45:.9;
      if(variant.rhythm===7&&i%8===7)dur*=2;
      dur=Math.max(.25,Math.round(dur*(rng()>.83?1.2:1)*4)/4);
      let gap=(phrase===3||phrase===7)?mood.gap:0;
      if(shapeIndex===6&&i%4===3)gap+=.75;
      if(shapeIndex===3&&i%8===7)gap+=.25;
      gap=Math.round(gap*4)/4;
      let pitch=limitValue(pitchDegree(deg,s.root,$('moodChangeMode')?.checked?mood.mode:s.mode),MIDI_MIN,MIDI_MAX);
      notes.push({id:preview?'preview'+i:makeId(),kana,pitch,start:roundBeat(cursor),dur});cursor+=dur+gap;
    });
    return notes;
  }
  function renderMoods(){
    const cats=$('moodCategoryGrid'),grid=$('moodPresetGrid');if(!cats||!grid)return;
    const matching=MOODS.filter(m=>!moodSearch||`${m.name} ${m.tag} ${SHAPES.map(s=>s.name).join(' ')}`.includes(moodSearch));
    $('moodResultCount').textContent=`${matching.length*SHAPES.length}種類の候補`;
    if(matching.length&&!matching.some(m=>m.id===moodSelected))moodSelected=matching[0].id;
    cats.replaceChildren();matching.forEach(m=>{const b=document.createElement('button');b.type='button';b.className='moodCategory'+(moodSelected===m.id?' on':'');b.dataset.mood=m.id;b.textContent=m.icon+' '+m.name;cats.append(b);});
    const chosen=matching.find(m=>m.id===moodSelected);grid.replaceChildren();
    if(!chosen){$('moodDescription').textContent='該当する雰囲気がありません。別の言葉で検索してみてね。';return;}
    $('moodDescription').textContent=`${chosen.icon} ${chosen.name} — ${chosen.tag}。目安：BPM ${chosen.bpm}（現在のBPMは変更しません）`;
    SHAPES.forEach((variant,i)=>{const c=document.createElement('div');c.className='moodPreset';c.innerHTML=`<div class="moodPresetTop"><span class="moodIndex"></span><strong></strong></div><p></p><div class="moodPresetActions"><button type="button" data-action="preview" class="outline tiny">▶ 試聴</button><button type="button" data-action="apply" class="accent tiny">＋ この形を使う</button></div>`;c.dataset.shape=String(i);c.querySelector('.moodIndex').textContent=String(i+1).padStart(2,'0');c.querySelector('strong').textContent=variant.name;c.querySelector('p').textContent=variant.summary;grid.append(c);});
  }
  function applyMood(shape){const s=getSection(),m=moodById(moodSelected),notes=candidateNotes(m,shape,false);if(!notes.length){message('先に歌詞・よみがなを入力してください。漢字の読みは確認してね。');return;}if(s.notes.length&&!confirm(`「${s.name}」の音程と長さを、${m.name}／${SHAPES[shape].name}の案に置き換えますか？（元に戻す可能）`))return;
    if($('moodChangeMode').checked)s.mode=m.mode;
    s.notes=notes;s.lastMood=`${m.name}・${SHAPES[shape].name}`;selectedNote=s.notes[0]?.id||null;
    checkpoint();renderAll();message(`「${s.name}」に ${m.name} のメロディーを当てはめたよ。音程と長さは自由に動かせます。`,5400);}
  function bindMoods(){
    $('moodCategoryGrid').onclick=e=>{const target=e.target.closest('[data-mood]');if(!target)return;moodSelected=target.dataset.mood;renderMoods();};
    $('moodPresetGrid').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;const i=Number(b.closest('[data-shape]').dataset.shape);if(b.dataset.action==='preview')startPlay('preset',candidateNotes(moodById(moodSelected),i,true));else applyMood(i);};
    $('moodSearch').oninput=e=>{moodSearch=e.target.value.trim();renderMoods();};
    $('moodReroll').onclick=()=>{moodReroll++;message('同じ雰囲気の別案を生成します。「試聴」で聴き比べてみてね。');};
    $('moodChangeMode').onchange=()=>renderMoods();renderMoods();
  }
  const SECTION_COLORS=['#b6a1ff','#7fd2db','#efbb83','#ef96be','#91d7a5','#d8a2d5','#93afe7'];
  const MIDI_MIN=36,MIDI_MAX=108,ROW=30,LEFT=73,MAX_SECTION_BEATS=4096;
  const LOCAL_KEY='melody-atelier-project-v1';
  let selectedTimedChord=null, chordLanePixels=25, chordTrackPointer=null;
  let uid=1,history=[],historyIndex=-1,saveTimer=0,toastTimer=0;
  let selectedNote=null,drag=null,ctx2=null,playing=null,drawPending=false,practice=false;
  const HOLD_MS=550,DRAG_THRESHOLD=6;let tapAudioNodes=[];let audioBus=null;
  // iPad Safari can report a running AudioContext despite an inaudible output path.
  // Native WAV playback is provided as an independent output path (also used by default on iOS).
  const isIOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let outputMode=isIOS?'native':'web';let nativePlayer=null,nativeURL=null;
  const useNative=()=>outputMode==='native';
  function releaseNative(){if(nativePlayer){nativePlayer.pause();nativePlayer.removeAttribute('src');nativePlayer.load();$('pulseDots').querySelectorAll('span').forEach(x=>x.classList.remove('on'));}if(nativeURL){URL.revokeObjectURL(nativeURL);nativeURL=null;}}
  function playNativeBlob(blob,label){
    releaseNative();if(!nativePlayer){nativePlayer=document.createElement('audio');nativePlayer.preload='auto';nativePlayer.setAttribute('playsinline','');nativePlayer.style.display='none';document.body.appendChild(nativePlayer);}
    nativeURL=URL.createObjectURL(blob);nativePlayer.src=nativeURL;nativePlayer.volume=1;
    const promise=nativePlayer.play();$('audioStatus').textContent='音声：音声ファイル方式で再生中';
    nativePlayer.ontimeupdate=()=>{if(!nativePlayer)return;const sec=nativePlayer.currentTime;
      $('timeDisplay').textContent=stamp(sec)+' / '+stamp(Number.isFinite(nativePlayer.duration)?nativePlayer.duration:0);
      const dots=[...$('pulseDots').children],i=Math.floor(sec*st.bpm/60)%st.beats;
      dots.forEach((dot,index)=>dot.classList.toggle('on',i===index));};
    if(promise&&typeof promise.catch==='function')promise.catch(e=>{$('audioStatus').textContent='音声：再生が拒否されました';message('音が鳴りません：'+e.message+'。Safariで再度再生ボタンを押してください。',7000);});
    nativePlayer.onended=()=>{$('audioStatus').textContent='音声：再生終了（音声ファイル方式）';$('pulseDots').querySelectorAll('span').forEach(x=>x.classList.remove('on'));};
    if(label)message('♪ '+label,1400);
  }
  // Offline soft acoustic-piano approximation. All sounds are synthesized locally;
  // these are NOT recordings of an acoustic piano. Partials include string stiffness,
  // three nearly unison strings, felt-hammer attack and the decay of a soundboard.
  const PIANO_TAIL=.82;
  function pianoSample(hz,t,keyLength,kind='piano',rate=24000){
    if(t<0)return 0;
    const warm=kind==='warm',mild=warm?0.82:1;
    const B=Math.min(.001,.000075+.000000000065*hz*hz);
    const tau=2*Math.PI*hz*t;
    const stiffness=n=>n*Math.sqrt((1+B*n*n)/(1+B));
    const detune=.00045+Math.min(.00045,hz*.00000018);
    const body=.62*Math.exp(-t/(warm?5.1:4.5))+.38*Math.exp(-t/(warm?1.35:1.12));
    const attack=1-Math.exp(-t/(warm?.008:.0044));
    const release=t>keyLength?Math.exp(-(t-keyLength)/(warm?.24:.21)):1;
    // Three piano strings, gently beating rather than one pure synth oscillator.
    let wave=(Math.sin(tau*(1-detune))*.37+Math.sin(tau*(1+detune))*.36+Math.sin(tau)*.30);
    const partials=warm?[[2,.105,1.65],[3,.038,.75],[4,.012,.29],[5,.0035,.17]]:
      [[2,.19,1.85],[3,.076,.87],[4,.027,.39],[5,.011,.23],[6,.004,.16]];
    for(const [n,weight,decay] of partials){
      if(hz*n>rate*.43)continue;
      wave+=Math.sin(tau*stiffness(n)+n*.13)*weight*Math.exp(-t/decay);
    }
    // Soft attack of a felt-covered hammer; rapidly vanishes rather than buzzing.
    if(t<.07&&hz*7<rate*.45){wave+=mild*.038*Math.sin(tau*6.43+.5)*Math.exp(-t/.013);}
    // Fade the end of a released note smoothly so that WAV playback has no click.
    const fade=t>keyLength+PIANO_TAIL-.10?Math.max(0,(keyLength+PIANO_TAIL-t)/.10):1;
    return wave*attack*body*release*fade*.92;
  }
  // it plays through Safari's standard HTML audio media output.
  function renderNativeBlob(notes=[],chords=[],seconds=1,metronome=false){
    const dur=Math.min(900,Math.max(.12,seconds)),rate=dur>240?16000:24000,frames=Math.ceil((dur+.12)*rate);
    const samples=new Float32Array(frames),volume=Math.max(0,st.volume/100);
    const add=(pitch,begin,length,amp,type)=>{
      const off=Math.max(0,Math.floor(begin*rate));if(off>=frames)return;
      const len=Math.max(.06,length),tail=type==='pure'?.11:PIANO_TAIL;
      const count=Math.max(0,Math.min(frames-off,Math.ceil((len+tail)*rate)));
      const freq=440*Math.pow(2,(pitch-69)/12);
      for(let j=0;j<count;j++){
        const t=j/rate;
        const v=type==='pure'?Math.sin(Math.PI*2*freq*t)*Math.min(1,t/.014)*(t>len?Math.exp(-(t-len)/.055):1):pianoSample(freq,t,len,type,rate);
        samples[off+j]+=v*amp*volume;
      }
    };
    for(const n of notes)add(n.pitch,Math.max(0,n.at||0),Math.max(.08,n.dur||.6),.50,st.sound);
    for(const chord of chords)for(const pitch of chord.pitches||[])add(pitch,Math.max(0,chord.at||0),Math.max(.12,chord.dur||1),.15*(chord.velocity||1),'piano');
    if(metronome){const beat=60/st.bpm;for(let b=0;b<dur/beat;b++){const off=Math.floor(b*beat*rate),count=Math.min(1500,frames-off);
      if(off<0||off>=frames)break;
      const freq=b%st.beats===0?1050:710;
      for(let j=0;j<count;j++)samples[off+j]+=Math.sin(Math.PI*2*freq*j/rate)*.12*Math.exp(-j/(rate*.015))*volume;
    }}
    let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(samples[i]));const gain=peak>.97?.97/peak:1;
    const raw=new ArrayBuffer(44+frames*2),dv=new DataView(raw);const word=(at,str)=>{for(let i=0;i<str.length;i++)dv.setUint8(at+i,str.charCodeAt(i));};
    word(0,'RIFF');dv.setUint32(4,36+frames*2,true);word(8,'WAVE');word(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,rate,true);dv.setUint32(28,rate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);word(36,'data');dv.setUint32(40,frames*2,true);
    for(let i=0;i<frames;i++)dv.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]*gain))*32767),true);
    return new Blob([raw],{type:'audio/wav'});
  }
  function nativePitch(pitch,dur=.65){playNativeBlob(renderNativeBlob([{pitch,at:0,dur}],[],dur+PIANO_TAIL+.12),'音符を試聴');}
  function nativeChord(steps,section){stopPlay();const bp=60/st.bpm,chords=[];let cursor=0;for(const step of steps){const dur=Math.max(.15,step.beats*bp*.88);if(cursor>30)break;const ev=rhythmChords([{beat:cursor/bp,duration:step.beats,pitches:chordTones(step,section)}],{blocks:[{section,length:step.beats,start:cursor/bp}]});for(const e of ev)chords.push({at:e.beat*bp,dur:e.duration*bp,pitches:e.pitches.map(n=>n+12),velocity:e.velocity||1});cursor+=step.beats*bp;}
    playNativeBlob(renderNativeBlob([],chords,Math.max(1,cursor+PIANO_TAIL+.12)),'コードを試聴');
  }
  function nativeStartPlay(mode,presetNotes){
    stopPlay();stopChordPreview();const proj=projectEvents(),sec=getSection(),block=proj.blocks.find(b=>b.section.id===st.selectedSection),startBeat=mode==='section'?(block?.start||0):mode==='selected'?(block?.start||0)+(getNote()?.start||0):0;
    const bp=60/st.bpm,limit=mode==='section'?(block?.length||0):Math.max(0,proj.totalBeats-startBeat);
    let notes=proj.events.filter(n=>n.beat>=startBeat && (mode!=='section'||n.sectionId===sec.id) && (tabPlayback==='all'||n.tabId===activeTab(n.sectionId===sec.id?sec:(st.sections.find(x=>x.id===n.sectionId)||sec)).id)).map(n=>({pitch:n.pitch,at:(n.beat-startBeat)*bp,dur:n.duration*bp*.93}));
    if(mode==='preset'){notes=(presetNotes||[]).map(n=>({pitch:n.pitch,at:n.start*bp,dur:n.dur*bp*.93}));}
    let chords=[];if(st.chordAlong&&mode!=='metro'&&mode!=='preset')chords=rhythmChords(chordTimelineEvents(proj,startBeat,mode==='section'?startBeat+limit:Infinity,mode==='section'),proj).map(c=>({at:(c.beat-startBeat)*bp,dur:c.duration*bp*.9,pitches:c.pitches.map(n=>n+12),velocity:c.velocity||1}));
    if(mode!=='metro'&&!notes.length&&!chords.length){message('メロディーまたはコードを追加してください。');return;}
    const total=mode==='metro'?st.beats*4*bp:mode==='preset'?Math.max(st.beats*bp,...notes.map(n=>n.at+n.dur)):Math.max(limit*bp,...notes.map(n=>n.at+n.dur),0);
    if(total>900){message('試聴は15分までです。');return;}
    playNativeBlob(renderNativeBlob(notes,chords,Math.max(.5,total),mode==='metro'||st.metro),'曲を試聴');
    if(mode==='metro')message('メトロノーム4小節を再生（再度押すと繰り返せます）',3100);
  }
  
  const initialNames=['Aメロ','Bメロ','サビ','ラスサビ'];
  const st={title:'新しい曲',bpm:100,beats:4,sound:'piano',volume:85,metro:true,chordAlong:true,snap:true,zoom:1,grid:.125,pitchNotation:'letter',sections:[],selectedSection:null};
  let groupMode=false,groupIds=new Set(),marquee=null;
  const NOTE_GRID_VALUES=[1,.5,.25,.125,.0625];
  const snapGrid=x=>Math.round((x+1e-9)/st.grid)*st.grid;
  const fineNote=x=>Math.round(x*10000)/10000;
  // Chord progressions use scale degrees so they can be reused in any key.
  const CHORD_LIBRARY_KEY='melody-atelier-custom-chords-v1';
  const CHORD_QUALITIES=['auto','maj','m','7','maj7','m7','sus4','add9','dim','aug'];
  const CHORD_QUALITY_TEXT={auto:'音階に合わせる',maj:'メジャー',m:'マイナー',7:'セブンス',maj7:'メジャー7',m7:'マイナー7',sus4:'sus4',add9:'add9',dim:'dim',aug:'aug'};
  const CHORD_FEELS=[{id:'sustain',name:'伸ばす（従来どおり）'},{id:'slow',name:'ゆっくり刻む（2拍）'},{id:'quarter',name:'1拍ごとに刻む'},{id:'eighth',name:'半拍で刻む'},{id:'sixteenth',name:'¼拍で細かく刻む'},{id:'arpeggio',name:'流れるアルペジオ'},{id:'dramatic',name:'激情的・強弱をつけて刻む'},{id:'sparkle',name:'透明感・きらめく分散和音'}];
  let customChords=[],chordCategory='fragile',chordSearch='',chordDraft=[],editingCustomId=null,chordPreviewNodes=[],chordPreviewTimer=null;
  function chordStepSafe(step){
    const o=step&&typeof step==='object'?step:{};
    return {degree:Math.round(num(o.degree,1,7,1)),alter:Math.round(num(o.alter,-2,2,0)),quality:CHORD_QUALITIES.includes(o.quality)?o.quality:'auto',beats:num(o.beats,.25,16,4)};
  }
  function normalizeSteps(steps){if(!Array.isArray(steps))return[];return steps.slice(0,32).map(chordStepSafe);}
  function tokenToStep(token){const [body,dur]=String(token).split('@'),[degreeToken,quality='auto']=body.split(':'),match=/^(\d)(?:\^([+-]?\d))?$/.exec(degreeToken);return chordStepSafe({degree:match?Number(match[1]):1,alter:match?Number(match[2]||0):0,quality,beats:dur?Number(dur):st.beats});}
  function templateSteps(t){return t.steps.map(tokenToStep);}
  function chordLibraryClean(data){if(!Array.isArray(data))return [];return data.slice(0,300).filter(p=>p&&typeof p==='object'&&Array.isArray(p.steps)&&p.steps.length).map((p,i)=>({id:String(p.id||`custom-${i}`).slice(0,100),name:String(p.name||'名称なし').slice(0,55),mood:String(p.mood||'オリジナル').slice(0,35),steps:normalizeSteps(p.steps)}));}
  function readChordLibrary(){try{customChords=chordLibraryClean(JSON.parse(localStorage.getItem(CHORD_LIBRARY_KEY)||'[]'));}catch(e){customChords=[];}}
  function saveChordLibrary(){try{localStorage.setItem(CHORD_LIBRARY_KEY,JSON.stringify(customChords));return true;}catch(e){message('ライブラリの端末保存に失敗しました。保存ファイルを必ず作成してください。',6000);return false;}}
  function chordScaleRoot(step,s){const scale=s.mode==='minor'?MINOR:MAJOR;return 48+s.root+scale[step.degree-1]+(step.alter||0);}
  function chordTones(step,s){
    const scale=s.mode==='minor'?MINOR:MAJOR,degree=step.degree-1,base=chordScaleRoot(step,s);
    const semi=index=>scale[(index)%7]+Math.floor(index/7)*12-scale[degree];
    const thirds=[0,semi(degree+2),semi(degree+4)];
    let intervals=thirds;
    const q=step.quality;
    if(q==='maj')intervals=[0,4,7];else if(q==='m')intervals=[0,3,7];
    else if(q==='7')intervals=[0,4,7,10];else if(q==='maj7')intervals=[0,4,7,11];
    else if(q==='m7')intervals=[0,3,7,10];else if(q==='sus4')intervals=[0,5,7];
    else if(q==='add9')intervals=[...thirds,14];else if(q==='dim')intervals=[0,3,6];else if(q==='aug')intervals=[0,4,8];
    return intervals.map(interval=>base+interval);
  }
  function chordLabel(step,s){
    const bass=ROOTS[((chordScaleRoot(step,s)%12)+12)%12];
    const intervals=chordTones(step,s).map(p=>p-chordScaleRoot(step,s));
    const flavor=step.quality!=='auto'?({maj:'',m:'m','7':'7',maj7:'maj7',m7:'m7',sus4:'sus4',add9:'add9',dim:'dim',aug:'aug'}[step.quality]||''):(intervals[1]===3&&intervals[2]===6?'dim':intervals[1]===3?'m':'');
    return bass+flavor;
  }
  function stopChordPreview(){clearTimeout(chordPreviewTimer);chordPreviewTimer=null;chordPreviewNodes.forEach(o=>{try{o.stop(0);}catch{}});chordPreviewNodes=[];}
  async function previewChordSteps(steps,section=getSection()){
    if(useNative()){try{nativeChord(steps,section);}catch(e){message('コード試聴でエラー：'+e.message,6000);}return;}
    stopChordPreview();stopPlay();if(!steps.length)return message('先にコードを追加してください。');
    try{const ctx=await audio(),start=ctx.currentTime+.09,secPerBeat=60/st.bpm;let beat=0;
      for(const step of steps){if(beat*secPerBeat>30)break;
        const d=Math.min(step.beats*secPerBeat*.88,5);const at=start+beat*secPerBeat;
        const ev=rhythmChords([{beat,duration:step.beats,pitches:chordTones(step,section)}],{blocks:[{section,start:beat,length:step.beats}]});
        for(const ch of ev)for(const pitch of ch.pitches)chordPreviewNodes.push(...tone(ctx,pitch+12,start+ch.beat*secPerBeat,Math.max(.08,ch.duration*secPerBeat),Math.pow(st.volume/100,.72)*.23*(ch.velocity||1),'piano'));
        beat+=step.beats;
      }
      $('audioStatus').textContent='音声：コード試聴中';message(st.volume===0?'音量が0%です。音量スライダーを上げてください。':'♪ コード進行を試聴しています',2600);chordPreviewTimer=setTimeout(()=>{stopChordPreview();$('audioStatus').textContent='音声：使用可能';},Math.min(31500,beat*secPerBeat*1000+500));
    }catch(e){$('audioStatus').textContent='音声：コード試聴失敗';message('コードを試聴できません：'+e.message,6500);}
  }
  function renderChordDraft(){const dst=$('chordDraftRows');if(!dst)return;dst.replaceChildren();
    const s=getSection();$('chordKeyLabel').textContent=`${ROOTS[s.root]} ${s.mode==='minor'?'マイナー':'メジャー'}に置き換えて表示しています（ブロックごとに転調可）`;
    chordDraft.forEach((step,i)=>{
      const row=document.createElement('div');row.className='chordStep';row.dataset.index=i;
      const numSpan=document.createElement('span');numSpan.className='chordNumber';numSpan.textContent=String(i+1);
      const degree=document.createElement('select');degree.className='chordDegree';degree.setAttribute('aria-label',`${i+1}番目のコードの度数`);
      for(let k=1;k<=7;k++)degree.add(new Option(`${k} → ${chordLabel({degree:k,quality:step.quality},s)}`,String(k)));
      degree.value=String(step.degree);
      const alter=document.createElement('select');alter.className='chordAlter';alter.setAttribute('aria-label',`${i+1}番目の半音変化`);for(const [v,t] of [[-2,'♭♭'],[-1,'♭'],[0,'±0'],[1,'♯'],[2,'♯♯']])alter.add(new Option(t,String(v)));alter.value=String(step.alter||0);
      const quality=document.createElement('select');quality.className='chordQuality';quality.setAttribute('aria-label',`${i+1}番目のコード種類`);
      for(const q of CHORD_QUALITIES)quality.add(new Option(CHORD_QUALITY_TEXT[q],q));quality.value=step.quality;
      const beats=document.createElement('select');beats.className='chordBeats';beats.setAttribute('aria-label',`${i+1}番目のコードの長さ`);
      for(const b of [.25,.5,.75,1,1.5,2,3,4,6,8,12,16])beats.add(new Option(b+'拍',String(b)));beats.value=String(step.beats);
      for(const [label,act,cname] of [['↑','up','stepMove'],['↓','down','stepMove'],['×','delete','stepRemove']]){
        const button=document.createElement('button');button.type='button';button.className='outline '+cname;button.dataset.chordAction=act;button.textContent=label;button.title=act==='delete'?'このコードを削除':'順序を変える';row.append(button);
      }
      const buttons=[...row.children];row.replaceChildren(numSpan,degree,alter,quality,beats,...buttons);dst.append(row);
    });
  }
  function renderChordCards(){const cat=$('chordCategories'),cards=$('chordCards');if(!cat||!cards)return;
    cat.replaceChildren();for(const mood of window.MELODY_CHORD_MOODS||[]){const button=document.createElement('button');button.type='button';button.className='chordCategory'+(chordCategory===mood.id?' on':'');button.dataset.chordCat=mood.id;button.textContent=mood.icon+' '+mood.name;cat.append(button);}
    const allMine=document.createElement('button');allMine.type='button';allMine.className='chordCategory'+(chordCategory==='mine'?' on':'');allMine.dataset.chordCat='mine';allMine.textContent=`★ 自作 (${customChords.length})`;cat.prepend(allMine);
    let list=chordCategory==='mine'?customChords.map(c=>({...c,custom:true})):(window.MELODY_CHORD_TEMPLATES||[]).filter(t=>chordSearch||t.mood===chordCategory);
    if(chordSearch)list=list.filter(x=>`${x.title||x.name} ${x.moodName||x.mood} ${window.MELODY_CHORD_MOODS?.find(m=>m.id===x.mood)?.tag||''} ${Array.isArray(x.steps)?x.steps.join(' '):''}`.toLowerCase().includes(chordSearch.toLowerCase()));
    cards.replaceChildren();$('chordCounter').textContent=chordCategory==='mine'?`自作 ${customChords.length}件中 ${list.length}件`:`${window.MELODY_CHORD_TEMPLATES.length}種類中 ${list.length}件`;
    if(!list.length){const empty=document.createElement('p');empty.className='chordEmpty';empty.textContent=chordCategory==='mine'?'まだ保存したコードがありません。下のエディターで作って「自作進行として保存」を押してください。':'該当するコード進行がありません。';cards.append(empty);return;}
    for(const item of list){const custom=!!item.custom,steps=custom?normalizeSteps(item.steps):templateSteps(item),c=document.createElement('div');c.className='chordCard';c.dataset.chordId=item.id;
      const title=document.createElement('strong');title.textContent=item.title||item.name;
      const subtitle=document.createElement('small');subtitle.textContent=(item.moodName||item.mood||'')+(custom?' / 自作':' / テンプレート');
      const chordSymbols=document.createElement('div');chordSymbols.className='chordSymbols';steps.forEach(step=>{const b=document.createElement('span');b.textContent=chordLabel(step,getSection());chordSymbols.append(b);});
      const actions=document.createElement('div');actions.className='chordCardActions';const buttons=custom?[['▶ 試聴','preview'],['✎ 編集','edit'],['＋ 適用','apply'],['削除','delete']]:[['▶ 試聴','preview'],['✎ 編集','edit'],['＋ 適用','apply']];
      for(const [label,act] of buttons){const b=document.createElement('button');b.type='button';b.dataset.chordOp=act;b.className=act==='apply'?'accent tiny':'outline tiny';b.textContent=label;actions.append(b);}
      c.append(title,subtitle,chordSymbols,actions);cards.append(c);
    }
  }
  function renderChordApplied(){const s=getSection(),out=$('appliedChordLabel');if(!out)return;
    out.textContent=s.chords?.length?`「${s.name}」に適用中：${s.chordName||'自作進行'}　${s.chords.map(c=>chordLabel(c,s)).join(' → ')}`:`「${s.name}」：コード未設定。コードを選んで「適用」を押すと伴奏になります。`;
  }
  function renderChords(){renderChordCards();renderChordDraft();renderChordApplied();$('chordFeel').value=getSection().chordFeel||'sustain';}
  function replaceChordDraft(steps,name='新しいコード進行',mood='',existingId=null){chordDraft=normalizeSteps(steps);editingCustomId=existingId;$('chordDraftName').value=String(name).slice(0,55);$('chordDraftMood').value=String(mood).slice(0,35);renderChordDraft();}
  function applyChordSteps(steps,label){const s=getSection();if(!steps.length)return message('コードを1つ以上追加してください。');s.chords=normalizeSteps(steps);s.chordClips=null;s.harmonies=[];selectedTimedChord=null;s.chordName=String(label||'自作進行').slice(0,55);if(label&&/細か|疾走|連打|刻む|煽る|衝動/.test(label))s.chordFeel='eighth';checkpoint();renderAll();message(`「${s.name}」にコードを適用しました。歌詞と音程はそのままです。`);}
  function saveCurrentChord(){if(!chordDraft.length)return message('先に1つ以上コードを追加してね。');const name=$('chordDraftName').value.trim().slice(0,55)||'新しいコード進行',mood=$('chordDraftMood').value.trim().slice(0,35)||'自作';
    let id=editingCustomId||('chord-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
    const p={id,name,mood,steps:normalizeSteps(chordDraft)};const index=customChords.findIndex(c=>c.id===id);if(index>=0)customChords[index]=p;else{if(customChords.length>=300)return message('自作進行は300件までです。ライブラリを保存して整理してください。');customChords.push(p);}
    editingCustomId=id;saveChordLibrary();chordCategory='mine';chordSearch='';$('chordSearch').value='';renderChordCards();message('★ 「'+name+'」を自作ライブラリに保存しました。別のブロックや曲でも使えます。',5000);
  }
  function exportChordLibrary(){const data={type:'melody-atelier-custom-chord-library',version:1,progressions:customChords};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'melody-atelier-my-chords.json');message('自作コード進行のライブラリを書き出しました。');}
  async function importChordLibrary(file){if(!file)return;if(file.size>1024*1024)return message('ファイルが大きすぎます（1MBまで）。');let incoming;
    try{const data=JSON.parse(await file.text());if(data.type!=='melody-atelier-custom-chord-library'||data.version!==1||!Array.isArray(data.progressions))throw Error('not a chord library');incoming=chordLibraryClean(data.progressions);}catch(e){return message('Melody Atelierの自作コード進行ライブラリJSONを選んでください。');}
    if(!confirm(`${incoming.length}件のコード進行を取り込みます。現在の自作ライブラリと統合しますか？`))return;
    let added=0;for(const entry of incoming){if(customChords.length>=300)break;const key=entry.name+'|'+JSON.stringify(entry.steps);if(customChords.some(p=>p.name+'|'+JSON.stringify(p.steps)===key))continue;const copy=typeof structuredClone==='function'?structuredClone(entry):JSON.parse(JSON.stringify(entry));copy.id='import-'+Date.now()+'-'+added;customChords.push(copy);added++;}
    saveChordLibrary();chordCategory='mine';renderChordCards();message(`${added}件を取り込みました。既存データは残しています。`,5000);
  }
  function chordTimelineEvents(proj,baseBeat=0,limitEnd=Infinity,selectedOnly=false){let events=[];
    for(const block of proj.blocks){if(selectedOnly&&block.section.id!==st.selectedSection)continue;const section=block.section,steps=section.chords;if(!block.length)continue;
      const limit=block.start+block.length,baseEvents=[];let beat=block.start,idx=0,safety=0;
      if(Array.isArray(section.chordClips)){
        for(const entry of section.chordClips){const clip=timedChordSafe(entry),at=block.start+clip.start;
          if(at>=limit)continue;baseEvents.push({beat:at,duration:Math.min(clip.beats,limit-at),pitches:chordTones(clip,section),step:clip,clipId:clip.id});}
      }else if(Array.isArray(steps)&&steps.length){while(beat<limit-.01&&safety++<32000){const step=chordStepSafe(steps[idx%steps.length]),duration=Math.min(step.beats,limit-beat);
          baseEvents.push({beat,duration,pitches:chordTones(step,section),step});beat+=duration;idx++;}}
      // In legacy projects, harmonized spans override the repeated progression.
      let combined=baseEvents;
      if(!Array.isArray(section.chordClips))for(const raw of (section.harmonies||[]).slice().sort((a,b)=>a.start-b.start)){
        const h=safeAutoChord(raw),from=block.start+h.start,to=Math.min(limit,from+h.beats);
        if(to<=from)continue;const kept=[];
        for(const event of combined){const end=event.beat+event.duration;
          if(end<=from||event.beat>=to){kept.push(event);continue;}
          if(event.beat<from)kept.push({...event,duration:from-event.beat});
          if(end>to)kept.push({...event,beat:to,duration:end-to});}
        kept.push({beat:from,duration:to-from,pitches:chordTones(h,section),step:h});combined=kept;
      }
      events.push(...combined.filter(e=>e.beat+e.duration>baseBeat&&e.beat<limitEnd).map(e=>{const beat=Math.max(baseBeat,e.beat);return {...e,beat,duration:Math.min(e.beat+e.duration,limitEnd)-beat};}).filter(e=>e.duration>.0001));
    }
    return events.sort((a,b)=>a.beat-b.beat);
  }
  // Melody-to-harmony: monophonic notes admit many chords, so present 3 editable options.
  let autoRange={sectionId:null,start:0,end:0},autoPickMode=false,autoCandidates=[],autoRendering=false;
  function safeAutoChord(c){return {...chordStepSafe(c),start:roundBeat(num(c.start,0,MAX_SECTION_BEATS)),beats:roundBeat(num(c.beats,.25,32))};}
  function autoSelectedRange(){const s=getSection(),end=Math.max(st.beats,getLength(s));if(autoRange.sectionId!==s.id)autoRange={sectionId:s.id,start:0,end};
    autoRange.start=roundBeat(num(autoRange.start,0,MAX_SECTION_BEATS));autoRange.end=roundBeat(num(autoRange.end,autoRange.start+.25,MAX_SECTION_BEATS));
    if(autoRange.end<=autoRange.start)autoRange.end=autoRange.start+.25;
    return autoRange;}
  function notesInRange(start,end){return getSection().notes.filter(n=>n.start<end&&n.start+n.dur>start).sort((a,b)=>a.start-b.start);}
  function renderAutoHarmony(){if(autoRendering)return;autoRendering=true;try{
    const s=getSection(),r=autoSelectedRange();$('autoFrom').value=r.start;$('autoTo').value=r.end;
    $('autoSelectedLabel').textContent=`${r.start}〜${r.end}拍・${notesInRange(r.start,r.end).length}音を対象`;
    $('autoPickMode').classList.toggle('on',autoPickMode);$('autoPickMode').textContent=autoPickMode?'ドラッグして選択中…':'✋ グラフで範囲を選ぶ';
    const results=$('autoChordResults');results.replaceChildren();for(const [i,item] of autoCandidates.entries()){
      const row=document.createElement('div');row.className='autoCandidate';row.dataset.index=i;row.innerHTML='<div><strong></strong><small></small></div><div class="autoActions"><button class="outline tiny" data-do="preview">♪ 試聴</button><button class="outline tiny" data-do="edit">✎ 編集</button><button class="accent tiny" data-do="apply">この範囲に採用</button></div>';
      row.querySelector('strong').textContent=item.name;row.querySelector('small').textContent=item.steps.map(c=>chordLabel(c,s)).join(' → ');results.append(row);
    }
    const assigned=$('autoAppliedChords');assigned.replaceChildren();(s.harmonies||[]).sort((a,b)=>a.start-b.start).forEach((ch,i)=>{
      const d=document.createElement('div');d.className='autoChordUnit';d.dataset.index=i;d.innerHTML='<span></span><select class="autoDegree"></select><select class="autoQuality"></select><b></b><button data-do="delete" class="outline tiny danger">×</button>';
      d.querySelector('span').textContent=`${ch.start}〜${roundBeat(ch.start+ch.beats)}拍`;
      const degree=d.querySelector('.autoDegree');for(let k=1;k<=7;k++)degree.add(new Option(`${k}度`,k));degree.value=ch.degree;
      const quality=d.querySelector('.autoQuality');for(const q of CHORD_QUALITIES)quality.add(new Option(CHORD_QUALITY_TEXT[q],q));quality.value=ch.quality;
      d.querySelector('b').textContent=chordLabel(ch,s);assigned.append(d);
    });
    if(!(s.harmonies||[]).length)assigned.textContent='このブロックには、まだメロディー由来のコードがありません。';
  }finally{autoRendering=false;}}
  function autoRangeInputs(){const from=roundBeat(num($('autoFrom').value,0,MAX_SECTION_BEATS)),to=roundBeat(num($('autoTo').value,0,MAX_SECTION_BEATS));if(to<=from){message('終了拍は開始拍より後に設定してください。');return false;}
    autoRange={sectionId:getSection().id,start:from,end:to};autoCandidates=[];renderAutoHarmony();drawCanvas();return true;}
  function autoChordAffinity(step,start,end){const s=getSection(),chpcs=new Set(chordTones(step,s).map(p=>(p%12+12)%12)),notes=notesInRange(start,end);if(!notes.length)return -.25;
    let score=0,weight=0;for(const n of notes){const overlap=Math.min(end,n.start+n.dur)-Math.max(start,n.start);if(overlap<=0)continue;
      const isStart=Math.abs(n.start-start)<.3,w=overlap*(isStart?1.6:1),pc=(n.pitch%12+12)%12;
      score+=w*(chpcs.has(pc)?4.5:-.5);weight+=w;}
    return score/Math.max(.01,weight);}
  function autoCompose(style){const s=getSection(),r=autoSelectedRange(),size=st.beats*Number($('autoChordRate').value||1),slots=[];
    for(let start=r.start;start<r.end-.01;start+=size){slots.push({start:roundBeat(start),beats:roundBeat(Math.min(size,r.end-start))});if(slots.length>=32)break;}
    const qualities=slot=>Array.from({length:7},(_,j)=>{const degree=j+1,triad=chordTones({degree,quality:'auto'},s).map(p=>p-chordScaleRoot({degree},s));const isMajor=triad[1]===4;
      let quality='auto';if(style===1)quality=triad[1]===4?'maj7':triad[1]===3?'m7':'auto';if(style===2)quality=isMajor?(degree===5?'sus4':'add9'):triad[1]===3?'m7':'auto';
      return {degree,quality,beats:slot.beats};});
    const grid=slots.map(qualities),values=grid.map((a,i)=>a.map(c=>autoChordAffinity(c,slots[i].start,slots[i].start+slots[i].beats)));
    const dp=[],parents=[];for(let i=0;i<slots.length;i++){dp[i]=[];parents[i]=[];for(let j=0;j<7;j++){
      if(!i){dp[i][j]=values[i][j]+(j===0?.8:0);parents[i][j]=-1;continue;}
      let best=-1e9,from=0;for(let k=0;k<7;k++){
        const prev=grid[i-1][k],curr=grid[i][j],diff=(chordScaleRoot(curr,s)-chordScaleRoot(prev,s)+12)%12;
        const samePcs=new Set(chordTones(prev,s).map(n=>n%12)),shared=chordTones(curr,s).filter(p=>samePcs.has(p%12)).length;
        const relation=shared*.17+([5,7].includes(diff)?.48:0)+(j===k?-.48:0)+(style===2&&diff===7?.18:0),score=dp[i-1][k]+relation;
        if(score>best){best=score;from=k;}
      }dp[i][j]=best+values[i][j];parents[i][j]=from;
    }}
    let last=0,highest=-1e9;for(let j=0;j<7;j++){const v=dp[slots.length-1][j]+(j===0&&r.end>=getLength(s)-.25?1.4:0);if(v>highest){last=j;highest=v;}}
    const steps=Array(slots.length);for(let i=slots.length-1;i>=0;i--){steps[i]=grid[i][last];last=parents[i][last];}
    return steps;
  }
  function generateAutoHarmony(){if(!autoRangeInputs())return;const r=autoSelectedRange();if(!notesInRange(r.start,r.end).length)return message('この範囲にはまだ音がありません。音程を作ってから選択してください。');
    autoCandidates=[{name:'自然に支える',steps:autoCompose(0)},{name:'少し切ない余韻',steps:autoCompose(1)},{name:'広がりのある響き',steps:autoCompose(2)}];renderAutoHarmony();message('3つのコード進行候補を作成しました。まず試聴して選んでください。');}
  function applyAutoCandidate(steps){const s=getSection(),r=autoSelectedRange();if(!steps.length)return;
    if(Array.isArray(s.chordClips)){
      const retained=[];for(const entry of s.chordClips){const c=timedChordSafe(entry),end=c.start+c.beats;
        if(end<=r.start||c.start>=r.end){retained.push(c);continue;}
        if(c.start<r.start)retained.push({...c,beats:roundBeat(r.start-c.start)});
        if(end>r.end)retained.push({...c,id:makeId('c'),start:r.end,beats:roundBeat(end-r.end)});
      }
      let at=r.start;for(const original of steps){const step=chordStepSafe(original),dur=Math.min(step.beats,r.end-at);if(dur<=.0001)break;
        retained.push({...step,id:makeId('c'),start:roundBeat(at),beats:Math.max(.25,roundBeat(dur))});at+=dur;}
      s.chordClips=retained;selectedTimedChord=null;
    }else{
      const keep=[];for(const original of (s.harmonies||[])){const ch=safeAutoChord(original),end=ch.start+ch.beats;
        if(end<=r.start||ch.start>=r.end){keep.push(ch);continue;}
        if(ch.start<r.start)keep.push({...ch,beats:roundBeat(r.start-ch.start)});
        if(end>r.end)keep.push({...ch,start:r.end,beats:roundBeat(end-r.end)});}
      let pos=r.start;for(const original of steps){const step=chordStepSafe(original),duration=Math.min(step.beats,r.end-pos);if(duration<=0)break;keep.push({...step,start:roundBeat(pos),beats:roundBeat(duration)});pos+=duration;}
      s.harmonies=keep.sort((a,b)=>a.start-b.start);
    }
    checkpoint();renderAll();message('選んだ範囲だけにコードを適用しました。ほかのコードとメロディーは保持します。',5200);
  }
  function bindAutoHarmony(){
    $('autoFrom').onchange=autoRangeInputs;$('autoTo').onchange=autoRangeInputs;
    $('autoPickMode').onclick=()=>{autoPickMode=!autoPickMode;renderAutoHarmony();drawCanvas();};
    $('autoWholeSection').onclick=()=>{autoRange={sectionId:getSection().id,start:0,end:Math.max(st.beats,getLength(getSection()))};autoCandidates=[];renderAutoHarmony();drawCanvas();};
    $('autoFromSelectedNote').onclick=()=>{const n=getNote();if(!n)return message('まずグラフで開始音を選んでください。');autoRange={sectionId:getSection().id,start:n.start,end:Math.max(n.start+.25,getLength(getSection()))};autoCandidates=[];renderAutoHarmony();drawCanvas();};
    $('autoMakeChords').onclick=generateAutoHarmony;
    $('autoChordRate').onchange=()=>{autoCandidates=[];renderAutoHarmony();};
    $('autoChordResults').onclick=e=>{const btn=e.target.closest('[data-do]');if(!btn)return;const x=autoCandidates[Number(btn.closest('[data-index]').dataset.index)];if(!x)return;
      if(btn.dataset.do==='preview')void previewChordSteps(x.steps);else if(btn.dataset.do==='apply')applyAutoCandidate(x.steps);
      else{replaceChordDraft(x.steps,`メロディーから作った進行`,'自動提案');$('chordPanel').open=true;$('chordDraftRows').scrollIntoView({behavior:'smooth',block:'center'});message('上のコード編集欄に候補をコピーしました。編集・試聴・自作進行として保存できます。');}};
    $('autoAppliedChords').onchange=e=>{const row=e.target.closest('[data-index]');if(!row)return;const chord=getSection().harmonies[Number(row.dataset.index)];if(!chord)return;chord.degree=Number(row.querySelector('.autoDegree').value);chord.quality=row.querySelector('.autoQuality').value;checkpoint();renderAutoHarmony();renderChordTimeline();};
    $('autoAppliedChords').onclick=e=>{const btn=e.target.closest('[data-do="delete"]');if(!btn)return;getSection().harmonies.splice(Number(btn.closest('[data-index]').dataset.index),1);checkpoint();renderAll();};
    $('autoClearHarmony').onclick=()=>{const s=getSection();if(!s.harmonies?.length)return;if(!confirm('このブロックのメロディー由来コードをすべて消しますか？'))return;s.harmonies=[];checkpoint();renderAll();};
  }

  function bindChords(){readChordLibrary();replaceChordDraft([{degree:1,quality:'auto',beats:4},{degree:5,quality:'auto',beats:4},{degree:6,quality:'auto',beats:4},{degree:4,quality:'auto',beats:4}]);
    $('chordCategories').onclick=e=>{const b=e.target.closest('[data-chord-cat]');if(!b)return;chordCategory=b.dataset.chordCat;renderChordCards();};
    $('myChordTab').onclick=()=>{chordCategory='mine';$('chordPanel').open=true;renderChordCards();};
    $('chordSearch').oninput=e=>{chordSearch=e.target.value.trim();renderChordCards();};
    $('chordCards').onclick=e=>{const b=e.target.closest('[data-chord-op]');if(!b)return;const itemId=b.closest('[data-chord-id]')?.dataset.chordId;const item=chordCategory==='mine'?customChords.find(c=>c.id===itemId):window.MELODY_CHORD_TEMPLATES.find(t=>t.id===itemId);if(!item)return;const custom=chordCategory==='mine',steps=custom?normalizeSteps(item.steps):templateSteps(item),name=item.name||item.title,mood=item.moodName||item.mood;
      switch(b.dataset.chordOp){case'preview':void previewChordSteps(steps);break;case'apply':applyChordSteps(steps,name);break;case'edit':replaceChordDraft(steps,name,mood,custom?item.id:null);$('chordDraftRows').scrollIntoView({behavior:'smooth',block:'nearest'});break;
        case'delete':if(!confirm(`保存したコード進行「${name}」を削除しますか？`))return;customChords=customChords.filter(c=>c.id!==item.id);if(editingCustomId===item.id)editingCustomId=null;saveChordLibrary();renderChordCards();message('ライブラリから削除しました。適用済みブロックには残ります。');break;}
    };
    $('chordDraftRows').onchange=e=>{const row=e.target.closest('[data-index]');if(!row)return;const i=Number(row.dataset.index);if(e.target.classList.contains('chordDegree'))chordDraft[i].degree=Number(e.target.value);
      if(e.target.classList.contains('chordAlter'))chordDraft[i].alter=Number(e.target.value);
      if(e.target.classList.contains('chordQuality'))chordDraft[i].quality=e.target.value;
      if(e.target.classList.contains('chordBeats'))chordDraft[i].beats=Number(e.target.value);
      renderChordDraft();};
    $('chordDraftRows').onclick=e=>{const b=e.target.closest('[data-chord-action]');if(!b)return;const i=Number(b.closest('[data-index]')?.dataset.index),act=b.dataset.chordAction;
      if(act==='delete')chordDraft.splice(i,1);else if(act==='up'&&i>0)[chordDraft[i],chordDraft[i-1]]=[chordDraft[i-1],chordDraft[i]];else if(act==='down'&&i<chordDraft.length-1)[chordDraft[i],chordDraft[i+1]]=[chordDraft[i+1],chordDraft[i]];
      renderChordDraft();};
    $('newChordDraft').onclick=()=>replaceChordDraft([{degree:1,quality:'auto',beats:st.beats}]);
    $('addChordStep').onclick=()=>{if(chordDraft.length>=32)return message('コードは1進行32個までです。');chordDraft.push({degree:1,quality:'auto',beats:st.beats});renderChordDraft();};
    $('tryChordDraft').onclick=()=>void previewChordSteps(chordDraft);
    $('applyChordDraft').onclick=()=>applyChordSteps(chordDraft,$('chordDraftName').value.trim());
    $('applyDraftToRange').onclick=()=>{if(!chordDraft.length)return message('先にコードを1つ以上作ってください。');const r=autoSelectedRange();if(r.end<=r.start)return message('開始と終了の拍を設定してください。');const steps=[];let total=0;while(total<r.end-r.start-.0001&&steps.length<180){for(const chord of chordDraft){const step=chordStepSafe(chord);steps.push(step);total+=step.beats;if(total>=r.end-r.start-.0001||steps.length>=180)break;}}applyAutoCandidate(steps);};
    $('saveChordDraft').onclick=saveCurrentChord;
    $('exportChordLibrary').onclick=exportChordLibrary;
    $('importChordLibrary').onclick=()=>$('chordImportInput').click();
    $('chordImportInput').onchange=e=>{void importChordLibrary(e.target.files?.[0]);e.target.value='';};
    $('chordFeel').onchange=e=>{getSection().chordFeel=e.target.value;checkpoint();renderChords();};
    $('chordAlong').onchange=e=>{st.chordAlong=e.target.checked;checkpoint();};
  }

  // Chord timeline. Legacy progressions are visualized without editing or migrating them.
  const timedChordSafe=c=>({...chordStepSafe(c),start:roundBeat(num(c.start,0,MAX_SECTION_BEATS)),beats:Math.max(.25,roundBeat(num(c.beats,.25,128))),id:String(c.id||'').slice(0,90)});
  function sectionVisibleChordClips(s,block){const p={blocks:[{section:s,start:0,length:block.length}]},raw=chordTimelineEvents(p);return raw.slice(0,1000).map((e,i)=>({...chordStepSafe(e.step),id:e.clipId||`legacy-${i}`,start:roundBeat(e.beat),beats:roundBeat(e.duration)}));}
  function ensureTimedChords(s){if(Array.isArray(s.chordClips))return;
    const block={length:getLength(s)},visible=sectionVisibleChordClips(s,block);
    s.manualBeats=Math.max(s.manualBeats||0,block.length); // Editing a chord must not unexpectedly move later sections.
    s.chordClips=visible.map(c=>({...timedChordSafe(c),id:makeId('c')}));s.chords=[];s.harmonies=[];
  }
  function selectedTimed(){if(!selectedTimedChord)return null;const s=st.sections.find(x=>x.id===selectedTimedChord.sectionId);return s&&Array.isArray(s.chordClips)?{s,c:s.chordClips.find(c=>c.id===selectedTimedChord.id)}:null;}
  function renderChordTimeline(){const p=projectEvents(),scroll=$('chordTrackScroller'),world=$('chordTrackWorld'),bar=$('chordTrackRuler'),sections=$('chordTrackSections'),clips=$('chordTrackClips');if(!world)return;
    const left=12,total=p.totalBeats,width=Math.max(scroll.clientWidth-25,Math.min(90000,Math.ceil((total+1)*chordLanePixels)+left+14));world.style.width=width+'px';bar.replaceChildren();sections.replaceChildren();clips.replaceChildren();
    for(let beat=0;beat<=total+.01;beat+=st.beats){const label=document.createElement('span');label.className='chordTick';label.style.left=(left+beat*chordLanePixels)+'px';label.textContent=''+(Math.floor(beat/st.beats)+1)+'小節';bar.append(label);if(bar.childElementCount>800)break;}
    let totalClips=0;for(const b of p.blocks){if(!b.length)continue;const s=b.section,x=left+b.start*chordLanePixels,w=b.length*chordLanePixels,header=document.createElement('button');header.type='button';header.className='chordSection'+(s.id===st.selectedSection?' selected':'');header.style.left=x+'px';header.style.width=Math.max(4,w)+'px';header.textContent=s.name;header.title=`${s.name}：${b.length}拍。押すとブロックを選択`;header.dataset.sectionId=s.id;sections.append(header);
      const entries=sectionVisibleChordClips(s,b);totalClips+=entries.length;
      for(const c of entries){const chip=document.createElement('div');chip.className='timedChord'+(selectedTimedChord?.id===c.id&&selectedTimedChord.sectionId===s.id?' selected':'')+(s.id===st.selectedSection?' activeSection':'');chip.dataset.sectionId=s.id;chip.dataset.chordId=c.id;
        const localX=x+c.start*chordLanePixels,chipW=Math.max(9,c.beats*chordLanePixels-2);chip.style.left=localX+'px';chip.style.width=chipW+'px';if(chipW<45)chip.classList.add('compact');chip.title=`${s.name} ${chordLabel(c,s)}：${c.start}拍から${c.beats}拍（タップで編集）`;
        const title=document.createElement('span');title.textContent=chordLabel(c,s);chip.append(title);const handle=document.createElement('span');handle.className='timedChordHandle';handle.dataset.handle='resize';handle.textContent='⋮';chip.append(handle);clips.append(chip);
      }
    }
    $('chordTrackSummary').textContent=`全${totalClips}個のコード区間を表示。${stamp(total*60/st.bpm)}の曲構成。灰色の空白にはコードがありません。`;
    const picked=selectedTimed(),panel=$('chordClipInspector');panel.hidden=!picked?.c;if(picked?.c){const {s,c}=picked;panel.querySelector('#chordClipTitle').textContent=`${s.name}：${chordLabel(c,s)} を編集`;
      $('chordClipStart').value=c.start;$('chordClipLength').value=c.beats;$('chordClipDegree').value=c.degree;$('chordClipAlter').value=c.alter;$('chordClipQuality').value=c.quality;}
    $('sectionBars').value=Math.max(1,Math.ceil(getLength(getSection())/st.beats))||8;
  }
  function selectTimedChord(sectionId,clipId){let s=st.sections.find(s=>s.id===sectionId);if(!s)return;if(st.selectedSection!==sectionId)selectSection(sectionId);
    if(!Array.isArray(s.chordClips)){ensureTimedChords(s);const i=Number(clipId.split('-').pop());clipId=s.chordClips[i]?.id;} // legacy id matches displayed index
    selectedTimedChord={sectionId,id:clipId};renderChordTimeline();renderChords();}
  function changeTimedChord(field,raw){const cur=selectedTimed();if(!cur?.c)return;const {s,c}=cur;let v=Number(raw);
    if(field==='start')c.start=roundBeat(num(v,0,MAX_SECTION_BEATS));if(field==='beats')c.beats=Math.max(.25,roundBeat(num(v,.25,128)));
    if(field==='degree')c.degree=Math.round(num(v,1,7));if(field==='alter')c.alter=Math.round(num(v,-2,2));if(field==='quality'&&CHORD_QUALITIES.includes(raw))c.quality=raw;
    if(s.chordClips?.length>800)s.chordClips.length=800;checkpoint();renderAll();}
  function addTimedChord(){const s=getSection();ensureTimedChords(s);if(s.chordClips.length>=800)return message('このブロックのコードは800個までです。');let x=0;if(s.chordClips.length)x=Math.max(...s.chordClips.map(c=>c.start+c.beats));x=Math.min(x,MAX_SECTION_BEATS-1);
    const c={...chordStepSafe({degree:1,beats:st.beats}),id:makeId('c'),start:roundBeat(x)};s.chordClips.push(c);selectedTimedChord={sectionId:s.id,id:c.id};checkpoint();renderAll();message('コードを追加しました。下の編集欄で音と長さを選んでください。');}
  function removeTimedChord(){const cur=selectedTimed();if(!cur?.c)return;cur.s.chordClips=cur.s.chordClips.filter(c=>c.id!==cur.c.id);selectedTimedChord=null;checkpoint();renderAll();}
  function insertInstrumental(name){if(st.sections.length>=40)return message('Voice Atelier連携のため、ブロックは40個までにしてください。');const old=st.sections.findIndex(s=>s.id===st.selectedSection),index=name==='イントロ'?0:name==='アウトロ'?st.sections.length:old+1;
    const s=makeSection(name,st.sections.length);s.manualBeats=st.beats*(name==='イントロ'?4:8);s.chordClips=[];s.lyrics='';s.reading='';st.sections.splice(index,0,s);st.selectedSection=s.id;selectedTimedChord=null;selectedNote=null;checkpoint();renderAll();$('chordTrackPanel').scrollIntoView({block:'nearest',behavior:'smooth'});message(`「${name}」を追加しました。メロディーや歌詞がなくてもコードを配置できます。`);}
  function previewTimedChords(){const p=projectEvents(),b=p.blocks.find(b=>b.section.id===st.selectedSection);if(!b?.length)return message('ブロックを作成してください。');
    const chords=rhythmChords(chordTimelineEvents(p,b.start,b.start+b.length,true),p);if(!chords.length)return message('このブロックにコードがありません。');if(b.length*60/st.bpm>150)return message('コード単独試聴は一度に2分30秒まで。ブロックを分けてください。');
    const sec=60/st.bpm;const list=chords.map(c=>({at:(c.beat-b.start)*sec,dur:c.duration*sec*.9,pitches:c.pitches.map(n=>n+12),velocity:c.velocity||1}));
    playNativeBlob(renderNativeBlob([],list,Math.max(.8,b.length*sec)),`「${b.section.name}」のコードだけを試聴`);
  }
  // Independent chord audition from the editor, unaffected by the chordAlong mix toggle.
  // Every preview uses the same beat origin as melody playback, so the selected note
  // and the chord arrangement stay synchronized.
  function playEditorChords(mode){
    stopPlay();stopChordPreview();
    const proj=projectEvents(),block=proj.blocks.find(b=>b.section.id===st.selectedSection);
    if(!block)return message('先にブロックを選択してください。');
    if(mode==='selected'&&!getNote())return message('ピアノロールで再生開始位置の音符を選択してください。');
    const startBeat=mode==='all'?0:mode==='selected'?block.start+getNote().start:block.start;
    const endBeat=mode==='section'?block.start+block.length:proj.totalBeats;
    if(endBeat<=startBeat)return message('再生する範囲がありません。');
    const events=rhythmChords(chordTimelineEvents(proj,startBeat,endBeat,mode==='section'),proj)
      .filter(c=>c.beat+c.duration>startBeat&&c.beat<endBeat);
    if(!events.length)return message('この範囲にコードがありません。コード進行を設定してください。');
    const bp=60/st.bpm,seconds=(endBeat-startBeat)*bp;
    if(seconds>900)return message('コードの試聴は15分以内にしてください。');
    const notes=events.map(c=>({at:Math.max(0,c.beat-startBeat)*bp,dur:Math.min(c.duration,c.beat+c.duration-startBeat)*bp*.9,pitches:c.pitches.map(n=>n+12),velocity:c.velocity||1}));
    try{playNativeBlob(renderNativeBlob([],notes,Math.max(.5,seconds),false),'コード進行を試聴');
      message('♫ '+(mode==='all'?'曲全体':mode==='section'?'このブロック':'選択した音の位置から')+'のコード進行を再生しています。',3000);
    }catch(e){message('コード再生エラー：'+e.message,6500);}
  }
  function bindChordTimeline(){for(let i=1;i<=7;i++)$('chordClipDegree').add(new Option(i+'度',i));for(const q of CHORD_QUALITIES)$('chordClipQuality').add(new Option(CHORD_QUALITY_TEXT[q],q));
    $('chordLaneZoom').onchange=e=>{chordLanePixels=Number(e.target.value)||25;renderChordTimeline();};
    $('insertIntro').onclick=()=>insertInstrumental('イントロ');$('insertInterlude').onclick=()=>insertInstrumental('間奏');$('insertOutro').onclick=()=>insertInstrumental('アウトロ');
    $('playChordTrack').onclick=previewTimedChords;$('addTimedChord').onclick=addTimedChord;$('editChordLibrary').onclick=()=>{$('chordPanel').open=true;$('chordPanel').scrollIntoView({block:'start',behavior:'smooth'});};
    $('setSectionBars').onclick=()=>{const s=getSection();s.manualBeats=st.beats*Math.round(num($('sectionBars').value,1,48));checkpoint();renderAll();message('ブロックの最低小節数を変更しました。');};
    $('deleteTimedChord').onclick=removeTimedChord;
    for(const [id,key] of [['chordClipStart','start'],['chordClipLength','beats'],['chordClipDegree','degree'],['chordClipAlter','alter'],['chordClipQuality','quality']])$(id).onchange=e=>changeTimedChord(key,e.target.value);
    for(const [id,key,offset] of [['timedChordLeft','start',-.25],['timedChordRight','start',.25],['timedChordShorter','beats',-.25],['timedChordLonger','beats',.25]])$(id).onclick=()=>{const cur=selectedTimed();if(cur?.c)changeTimedChord(key,cur.c[key]+offset);};
    $('testTimedChord').onclick=()=>{const cur=selectedTimed();if(cur?.c)void previewChordSteps([cur.c],cur.s);};
    $('chordTrackSections').addEventListener('click',e=>{const t=e.target.closest('[data-section-id]');if(t)selectSection(t.dataset.sectionId);});
    const container=$('chordTrackClips'),scroll=$('chordTrackScroller');
    container.addEventListener('pointerdown',e=>{const t=e.target.closest('.timedChord');if(!t)return;const cId=t.dataset.chordId,sectionId=t.dataset.sectionId,kind=e.target.closest('[data-handle]')?'resize':'move';chordTrackPointer={pointerId:e.pointerId,startX:e.clientX,sectionId,cId,kind,moved:false,initialWidth:t.getBoundingClientRect().width,t};try{t.setPointerCapture(e.pointerId);}catch(_){}});
    container.addEventListener('pointermove',e=>{const p=chordTrackPointer;if(!p||p.pointerId!==e.pointerId)return;const delta=e.clientX-p.startX;p.moved=p.moved||Math.abs(delta)>5;if(!p.moved)return;const shift=roundBeat(delta/chordLanePixels),moving=Math.round(shift*chordLanePixels);if(p.kind==='resize')p.t.style.width=Math.max(9,p.initialWidth+moving)+'px';else p.t.style.transform=`translateX(${moving}px)`;});
    function endPointer(e){const p=chordTrackPointer;if(!p||p.pointerId!==e.pointerId)return;chordTrackPointer=null;if(!p.moved){selectTimedChord(p.sectionId,p.cId);return;}
      const s=st.sections.find(s=>s.id===p.sectionId);if(!s)return;if(!Array.isArray(s.chordClips))ensureTimedChords(s);
      let c=s.chordClips.find(c=>c.id===p.cId);if(!c&&p.cId.startsWith('legacy-'))c=s.chordClips[Number(p.cId.slice(7))];if(!c)return renderChordTimeline();
      const delta=roundBeat((e.clientX-p.startX)/chordLanePixels);if(p.kind==='resize')c.beats=Math.max(.25,roundBeat(num(c.beats+delta,.25,128)));else c.start=roundBeat(num(c.start+delta,0,MAX_SECTION_BEATS));
      selectedTimedChord={sectionId:s.id,id:c.id};st.selectedSection=s.id;checkpoint();renderAll();}
    container.addEventListener('pointerup',endPointer);container.addEventListener('pointercancel',e=>{chordTrackPointer=null;renderChordTimeline();});
  }
  const makeId=(kind='n')=>kind+(uid++);
  const num=(x,lo,hi,otherwise=lo)=>Math.min(hi,Math.max(lo,Number.isFinite(Number(x))?Number(x):otherwise));
  const roundBeat=x=>Math.round(x*4)/4;
  const rootName=i=>(st.pitchNotation==='solfege'?SOLFEGE:ROOTS)[((i%12)+12)%12];
  const noteName=m=>rootName(m)+(Math.floor(m/12)-1);
  function refreshPitchNotation(){
    $('pitchNotation').value=st.pitchNotation;
    for(const option of $('keyRoot').options)option.textContent=rootName(Number(option.value));
    for(const option of $('notePitch').options)option.textContent=noteName(Number(option.value));
    $('jumpC4').textContent=st.pitchNotation==='solfege'?'● 中央のド（ド4）':'● 中央のド C4';
  }
  const getSection=()=>st.sections.find(s=>s.id===st.selectedSection)||st.sections[0];
  // Each section has its own independently editable melody layers. Legacy notes remain the active layer.
  let tabPlayback='all';
  const tabColors=['#a89cff','#54c9b4','#efbb74','#f08fba','#87b9fa','#c9dc85'];
  function ensureTabs(section){
    if(!section.melodyTabs?.length)section.melodyTabs=[{id:makeId('t'),name:'主旋律',notes:section.notes||[]}];
    if(!section.activeMelodyTab||!section.melodyTabs.some(t=>t.id===section.activeMelodyTab))section.activeMelodyTab=section.melodyTabs[0].id;
    return section.melodyTabs;
  }
  function activeTab(section=getSection()){return ensureTabs(section).find(t=>t.id===section.activeMelodyTab);}
  function syncTab(section){if(!section)return;activeTab(section).notes=section.notes;}
  function allTabNotes(section){syncTab(section);return ensureTabs(section).flatMap(t=>t.notes.map(n=>({...n,tabId:t.id})));}
  function selectTab(id){const section=getSection();syncTab(section);const tab=ensureTabs(section).find(t=>t.id===id);if(!tab)return;section.activeMelodyTab=id;section.notes=tab.notes;selectedNote=section.notes[0]?.id||null;groupIds.clear();renderTabs();renderKeyControls();renderInspector();resizeCanvas();saveSoon();}
  function renderTabs(){const section=getSection(),bar=$('melodyTabBar');if(!bar||!section)return;syncTab(section);bar.replaceChildren();ensureTabs(section).forEach((tab,i)=>{const button=document.createElement('button');button.type='button';button.className='melodyTab'+(tab.id===section.activeMelodyTab?' active':'');button.textContent=tab.name;button.style.setProperty('--tab-color',tabColors[i%tabColors.length]);button.setAttribute('aria-pressed',String(tab.id===section.activeMelodyTab));button.onclick=()=>selectTab(tab.id);bar.append(button);});$('tabPlaybackMode').value=tabPlayback;}
  function addTab(){const section=getSection();syncTab(section);if(section.melodyTabs.length>=12)return message('1ブロックにつき最大12タブです。');const tab={id:makeId('t'),name:'メロディー'+(section.melodyTabs.length+1),notes:[]};section.melodyTabs.push(tab);section.activeMelodyTab=tab.id;section.notes=tab.notes;selectedNote=null;checkpoint();renderAll();}
  function tabAction(kind){const section=getSection(),tab=activeTab(section);syncTab(section);if(kind==='rename'){const name=prompt('タブ名',tab.name);if(name===null)return;tab.name=name.trim().slice(0,28)||tab.name;}
    if(kind==='duplicate'){if(section.melodyTabs.length>=12)return message('最大12タブです。');const clone={id:makeId('t'),name:tab.name+' コピー',notes:tab.notes.map(n=>({...n,id:makeId()}))};section.melodyTabs.splice(section.melodyTabs.indexOf(tab)+1,0,clone);section.activeMelodyTab=clone.id;section.notes=clone.notes;selectedNote=null;}
    if(kind==='delete'){if(section.melodyTabs.length===1)return message('最低1タブ必要です。');if(!confirm('「'+tab.name+'」を削除しますか？（元に戻す可能）'))return;section.melodyTabs=section.melodyTabs.filter(t=>t.id!==tab.id);section.activeMelodyTab=section.melodyTabs[0].id;section.notes=section.melodyTabs[0].notes;selectedNote=null;}
    checkpoint();renderAll();}
  const getNote=()=>getSection()?.notes.find(n=>n.id===selectedNote);
  const copy=o=>JSON.parse(JSON.stringify(o));
  const projectSnapshot=()=>{st.sections.forEach(syncTab);return {version:1,title:st.title,bpm:st.bpm,beats:st.beats,sound:st.sound,volume:st.volume,metro:st.metro,chordAlong:st.chordAlong,snap:st.snap,zoom:st.zoom,grid:st.grid,pitchNotation:st.pitchNotation,sections:copy(st.sections),selectedSection:st.selectedSection};};
  function message(msg,ms=3500){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);}
  function saveSoon(){ $('saveStatus').textContent='変更を保存中…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(LOCAL_KEY,JSON.stringify(projectSnapshot()));$('saveStatus').textContent='この端末に自動保存済み';}catch(e){$('saveStatus').textContent='保存できません（JSONで保存してください）';message('端末保存に失敗しました。プロジェクト保存でファイルを書き出してください。');}},400);}
  function checkpoint(){const x=JSON.stringify(projectSnapshot());if(history[historyIndex]===x)return;history=history.slice(0,historyIndex+1);history.push(x);if(history.length>45)history.shift();historyIndex=history.length-1;updateHistoryButtons();saveSoon();}
  function restoreHistory(index){if(index<0||index>=history.length)return;stopPlay();historyIndex=index;loadData(JSON.parse(history[index]));renderAll();saveSoon();}
  function updateHistoryButtons(){$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
  function makeSection(name,idx){return{id:makeId('s'),name,lyrics:'',reading:'',notes:[],root:0,mode:'major',chords:[],chordClips:null,manualBeats:0,harmonies:[],chordFeel:'sustain',chordName:'',gap:0,color:SECTION_COLORS[idx%SECTION_COLORS.length]};}
  function initDemo(){st.sections=initialNames.map(makeSection);st.sections[0].lyrics='今';st.sections[0].reading='いま';st.sections[0].notes=[{id:makeId(),kana:'い',pitch:64,start:0,dur:1},{id:makeId(),kana:'ま',pitch:67,start:1,dur:1.5}];st.selectedSection=st.sections[0].id;selectedNote=st.sections[0].notes[0].id;}
  function loadData(data){if(!data||data.version!==1||!Array.isArray(data.sections)||data.sections.length>75)throw Error('対応するMelody Atelierのプロジェクトではありません。');
    st.title=String(data.title||'新しい曲').slice(0,80);st.bpm=num(data.bpm,40,240,100);st.beats=[3,4,6].includes(+data.beats)?+data.beats:4;st.sound=['warm','piano','pure'].includes(data.sound)?data.sound:'piano';st.volume=num(data.volume,0,100,65);st.metro=data.metro!==false;st.chordAlong=data.chordAlong!==false;st.snap=data.snap!==false;st.zoom=num(data.zoom,.25,5,1);st.grid=NOTE_GRID_VALUES.includes(+data.grid)?+data.grid:.125;st.pitchNotation=data.pitchNotation==='solfege'?'solfege':'letter';
    st.sections=data.sections.map((s,i)=>({id:String(s.id||makeId('s')),name:String(s.name||'パート').slice(0,45),lyrics:String(s.lyrics||'').slice(0,12000),reading:String(s.reading||'').slice(0,12000),root:num(s.root,0,11),mode:s.mode==='minor'?'minor':'major',gap:num(s.gap,0,64),lastMood:String(s.lastMood||'').slice(0,100),chords:normalizeSteps(s.chords),chordClips:Array.isArray(s.chordClips)?s.chordClips.slice(0,800).map((c,j)=>({...chordStepSafe(c),id:String(c.id||makeId('c')).slice(0,90),start:num(c.start,0,MAX_SECTION_BEATS),beats:num(c.beats,.25,128)})):null,manualBeats:num(s.manualBeats,0,MAX_SECTION_BEATS),harmonies:Array.isArray(s.harmonies)?s.harmonies.slice(0,512).map(safeAutoChord):[],chordFeel:CHORD_FEELS.some(f=>f.id===s.chordFeel)?s.chordFeel:'sustain',chordName:String(s.chordName||'').slice(0,55),color:SECTION_COLORS[i%SECTION_COLORS.length],notes:Array.isArray(s.notes)?s.notes.slice(0,3000).map(n=>({id:String(n.id||makeId()),kana:String(n.kana||'ラ').slice(0,8),pitch:num(n.pitch,MIDI_MIN,MIDI_MAX),start:num(n.start,0,MAX_SECTION_BEATS),dur:num(n.dur,.0625,32)})):[]}));
    for(const section of st.sections){const original=data.sections.find(x=>String(x.id)===section.id);if(Array.isArray(original?.melodyTabs)&&original.melodyTabs.length){section.melodyTabs=original.melodyTabs.slice(0,12).map(t=>({id:String(t.id||makeId('t')).slice(0,80),name:String(t.name||'メロディー').slice(0,28),notes:Array.isArray(t.notes)?t.notes.slice(0,3000).map(n=>({id:String(n.id||makeId()),kana:String(n.kana||'ラ').slice(0,8),pitch:num(n.pitch,MIDI_MIN,MIDI_MAX),start:num(n.start,0,MAX_SECTION_BEATS),dur:num(n.dur,.0625,32)})):[]}));section.activeMelodyTab=section.melodyTabs.some(t=>t.id===original.activeMelodyTab)?original.activeMelodyTab:section.melodyTabs[0].id;section.notes=section.melodyTabs.find(t=>t.id===section.activeMelodyTab).notes;}else{section.melodyTabs=[{id:makeId('t'),name:'主旋律',notes:section.notes}];section.activeMelodyTab=section.melodyTabs[0].id;}}
    if(!st.sections.length)st.sections=[makeSection('Aメロ',0)];const ids=st.sections.flatMap(s=>[s.id,...ensureTabs(s).flatMap(t=>[t.id,...t.notes.map(n=>n.id)]),...(s.chordClips||[]).map(c=>c.id)]);uid=Math.max(uid,...ids.map(x=>Number(String(x).replace(/^[^0-9]*/,''))||0))+1;
    selectedTimedChord=null;groupIds.clear();groupMode=false;st.selectedSection=st.sections.some(s=>s.id===data.selectedSection)?data.selectedSection:st.sections[0].id;selectedNote=getSection().notes[0]?.id||null;syncInputs();}
  const hiragana=s=>String(s).normalize('NFKC').replace(/[ァ-ヶ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0x60));
  const DICT={'今':'いま','私':'わたし','僕':'ぼく','君':'きみ','世界':'せかい','未来':'みらい','明日':'あした','昨日':'きのう','今日':'きょう','夜':'よる','朝':'あさ','光':'ひかり','空':'そら','海':'うみ','風':'かぜ','夢':'ゆめ','声':'こえ','歌':'うた','心':'こころ','愛':'あい','花':'はな','涙':'なみだ','星':'ほし','月':'つき','街':'まち','道':'みち','手':'て','日':'ひ','雨':'あめ','雪':'ゆき','影':'かげ','春':'はる','夏':'なつ','秋':'あき','冬':'ふゆ','何':'なに','誰':'だれ','遠い':'とおい','強い':'つよい','小さな':'ちいさな','大きな':'おおきな','青い':'あおい','白い':'しろい','黒い':'くろい','赤い':'あかい','生きる':'いきる','笑う':'わらう','泣く':'なく','帰る':'かえる','見える':'みえる','言える':'いえる','始まる':'はじまる','終わる':'おわる','響く':'ひびく','届く':'とどく','歩く':'あるく','走る':'はしる','消える':'きえる','忘れる':'わすれる','覚えて':'おぼえて','歌う':'うたう'};
  const dictKeys=Object.keys(DICT).sort((a,b)=>b.length-a.length);
  function tryRead(text){let result='',unknown=[];const raw=String(text).replace(/[\r\n]/g,' ');for(let i=0;i<raw.length;){const ch=raw[i];if(/[\u4e00-\u9fff々]/.test(ch)){const key=dictKeys.find(w=>raw.startsWith(w,i));if(key){result+=DICT[key];i+=key.length;}else{unknown.push(ch);i++;}}else{result+=ch;i++;}}return{reading:hiragana(result),unknown};}
  const HEP={'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'o','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do','ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゃ':'ya','ゅ':'yu','ょ':'yo','ゔ':'vu','っ':'xtsu','ー':'—'};
  const COMBO={'し':'sh','ち':'ch','じ':'j','ぢ':'j','ふ':'f','て':'t','で':'d','つ':'ts','き':'ky','ぎ':'gy','に':'ny','ひ':'hy','び':'by','ぴ':'py','み':'my','り':'ry'};
  function moraSplit(read){const s=hiragana(read).replace(/[\s　,、。！？!?.…「」『』（）()・]/g,'');const result=[];for(const c of s){if(/[ぁぃぅぇぉゃゅょゎ]/.test(c)&&result.length){result[result.length-1]+=c;}else if(HEP[c]!==undefined){result.push(c);}}return result;}
  function romaji(k){if(k.length===1)return HEP[k]||k;const first=k[0],last=k.slice(1);if(last==='ゃ'||last==='ゅ'||last==='ょ'){let base=COMBO[first];if(!base){let standard=HEP[first]||'';base=standard.replace(/[aiueo]$/,'y');}return base+({ゃ:'a',ゅ:'u',ょ:'o'}[last]);}if(first==='ふ')return 'f'+({ぁ:'a',ぃ:'i',ぇ:'e',ぉ:'o'}[last]||'u');if(first==='て'||first==='で'||first==='と'||first==='ど'){return (first==='て'?'t':first==='で'?'d':first==='と'?'t':'d')+({ぃ:'i',ぅ:'u',ぇ:'e',ぁ:'a',ぉ:'o'}[last]||'o');}return (HEP[first]||'')+(HEP[last]||last);}
  function parseMora(s){return moraSplit(s).slice(0,1200);}
  function snapPitch(m,section){m=Math.round(num(m,MIDI_MIN,MIDI_MAX));if(!st.snap)return m;const intervals=section.mode==='minor'?MINOR:MAJOR;const allowed=p=>intervals.includes((((p%12)+12)%12-section.root+12)%12);if(allowed(m))return m;for(let d=1;d<13;d++){if(m-d>=MIDI_MIN&&allowed(m-d))return m-d;if(m+d<=MIDI_MAX&&allowed(m+d))return m+d;}return m;}
  const getLength=s=>{const notes=allTabNotes(s),melody=notes.length?Math.max(...notes.map(n=>n.start+n.dur)):0,chords=Array.isArray(s.chordClips)?Math.max(0,...s.chordClips.map(c=>c.start+c.beats)):(s.chords?.reduce((a,c)=>a+c.beats,0)||0);const harmony=Math.max(0,...(s.harmonies||[]).map(h=>h.start+h.beats)),n=Math.max(melody,chords,harmony,s.manualBeats||0);return n?Math.ceil(n/st.beats)*st.beats:0;};
  function timeline(){let cursor=0;const blocks=[];for(const s of st.sections){const length=getLength(s);blocks.push({section:s,start:cursor,length});cursor+=length+ (length?num(s.gap,0,64):0);}return{blocks,totalBeats:cursor};}
  function projectEvents(){const t=timeline(),events=[];for(const b of t.blocks){for(const n of allTabNotes(b.section)){events.push({beat:b.start+n.start,duration:n.dur,pitch:n.pitch,kana:n.kana,sectionId:b.section.id,noteId:n.id,tabId:n.tabId});}}return {events:events.sort((a,b)=>a.beat-b.beat),totalBeats:t.totalBeats,blocks:t.blocks};}
  function syncInputs(){ $('projectTitle').value=st.title;$('bpm').value=st.bpm;$('beats').value=st.beats;$('soundType').value=st.sound;$('masterVolume').value=st.volume;$('volumeReadout').textContent=st.volume+'%';$('metroToggle').checked=st.metro;$('chordAlong').checked=st.chordAlong;$('snapKey').checked=st.snap;const s=getSection();$('lyricsInput').value=s.lyrics;$('readingInput').value=s.reading;$('selectedSectionName').textContent=`${s.name} の言葉`;$('keyRoot').value=s.root;$('keyMode').value=s.mode;}
  function renderSections(){const dest=$('sectionList');dest.replaceChildren();st.sections.forEach((s,i)=>{const card=document.createElement('div');card.className='sectionCard'+(s.id===st.selectedSection?' selected':'');card.dataset.id=s.id;card.innerHTML=`<div class="sectionMain"><div class="sectionLabel" data-action="select"><span class="sectionBadge" style="background:${s.color}"></span><strong></strong></div><div class="sectionBtns"><button data-action="up" title="上に移動">↑</button><button data-action="down" title="下に移動">↓</button><button data-action="copy" title="複製">⧉</button><button data-action="delete" title="削除" class="trash">×</button></div></div><div class="sectionMeta"></div>`;card.querySelector('strong').textContent=s.name;card.querySelector('.sectionMeta').textContent=`${s.notes.length}音 ・ ${getLength(s)}拍 ・ ${ROOTS[s.root]} ${s.mode==='minor'?'マイナー':'メジャー'}${s.lastMood?' · '+s.lastMood:''}`;dest.append(card);});}
  function renderChips(){const s=getSection(),m=parseMora(s.reading);const dst=$('moraChips');dst.replaceChildren();m.slice(0,80).forEach(k=>{const chip=document.createElement('span');chip.className='moraChip';chip.innerHTML='<b></b><small></small>';chip.querySelector('b').textContent=k;chip.querySelector('small').textContent=romaji(k);dst.append(chip);});if(m.length>80){dst.append(document.createTextNode(` 他 ${m.length-80}音`));}if(!m.length){dst.textContent='よみがなを入力すると、ここに音が並びます。';}const d=tryRead(s.lyrics);$('readWarning').textContent=d.unknown.length?'漢字の読みが確定できない箇所があります。よみがなを入力してください。':'';}
  function renderArrangement(){const parent=$('arrangement');parent.replaceChildren();for(const s of st.sections){const d=document.createElement('div');d.className='arrangeBlock'+(s.id===st.selectedSection?' sel':'');d.dataset.id=s.id;d.innerHTML='<strong></strong><small></small><div class="gapCtrl"><span>次までの間</span><input type="number" min="0" max="64" step="0.25" aria-label="次のブロックまでの空白（拍）"><span>拍</span></div>';d.querySelector('strong').textContent=s.name;d.querySelector('small').textContent=`${getLength(s)}拍 · ${ROOTS[s.root]} ${s.mode==='minor'?'m':'Maj'}`;d.querySelector('input').value=s.gap;d.querySelector('input').disabled=!getLength(s);d.querySelector('strong').onclick=()=>selectSection(s.id);parent.append(d);}}
  function renderKeyControls(){const s=getSection();$('keyRoot').value=s.root;$('keyMode').value=s.mode;$('keyInfo').textContent=`${rootName(s.root)} ${s.mode==='major'?'メジャー':'マイナー'} （ブロック別に転調可）`;$('noteCount').textContent=`音の数：${s.notes.length}`;$('durationInfo').textContent=`長さ：${getLength(s)}拍`;}
  function renderInspector(){const n=getNote(),disabled=!n;$('nudgeBeatLeft').textContent=`← ${st.grid}拍`;$('nudgeBeatRight').textContent=`${st.grid}拍 →`;renderGroupStatus();$('selectedNoteTitle').textContent=n?`「${n.kana} / ${romaji(n.kana)}」 — ${noteName(n.pitch)}`:'空白をタップして音を追加';for(const id of ['notePitch','noteStart','noteDur','deleteNote','playNote','playFromSelected','playFromInspector'])$(id).disabled=disabled;if(n){$('noteStart').step=String(st.grid);$('noteDur').step=String(st.grid);$('notePitch').value=n.pitch;$('noteStart').value=n.start;$('noteDur').value=n.dur;}else{$('noteStart').value='';$('noteDur').value='';}}
  function renderAll(){syncInputs();refreshPitchNotation();$('gridStep').value=String(st.grid);renderGroupStatus();renderSections();renderChips();renderArrangement();renderKeyControls();renderInspector();renderTabs();resizeCanvas();updateZoom();renderChords();renderAutoHarmony();renderChordTimeline();updateHistoryButtons();const secs=timeline().totalBeats*60/st.bpm;$('timeDisplay').textContent=`00:00 / ${stamp(secs)}`;$('songLength').textContent=`曲全体 ${stamp(secs)} / ガイド音声は最大15:00`;}
  function selectSection(id){if(!st.sections.some(s=>s.id===id))return;selectedTimedChord=null;groupIds.clear();marquee=null;st.selectedSection=id;selectedNote=getSection().notes[0]?.id||null;syncInputs();renderSections();renderChips();renderArrangement();renderKeyControls();renderInspector();renderTabs();resizeCanvas(true);renderChords();renderChordTimeline();autoRange.sectionId=null;autoCandidates=[];renderAutoHarmony();saveSoon();}
  function sectionReorder(id,dir){const i=st.sections.findIndex(s=>s.id===id),j=i+dir;if(i<0||j<0||j>=st.sections.length)return;[st.sections[i],st.sections[j]]=[st.sections[j],st.sections[i]];checkpoint();renderAll();}
  function sectionDuplicate(id){const src=st.sections.find(s=>s.id===id);if(!src)return;if(st.sections.length>=50)return message('ブロックは最大50個までです。');const old=st.sections.findIndex(s=>s.id===id),s=copy(src);s.id=makeId('s');s.name=src.name+'②';if(s.melodyTabs){const oldActive=s.activeMelodyTab;for(const tab of s.melodyTabs){const prevId=tab.id;tab.id=makeId('t');if(prevId===oldActive)s.activeMelodyTab=tab.id;for(const n of tab.notes)n.id=makeId();}s.notes=s.melodyTabs.find(t=>t.id===s.activeMelodyTab).notes;}else s.notes.forEach(n=>n.id=makeId());if(s.chordClips)s.chordClips.forEach(c=>c.id=makeId('c'));st.sections.splice(old+1,0,s);st.selectedSection=s.id;selectedNote=s.notes[0]?.id||null;checkpoint();renderAll();message('歌詞・音程・長さをまとめて複製しました。');}
  function addSection(){if(st.sections.length>=50)return message('ブロックは最大50個までです。');const name=prompt('追加するブロック名を入力（例：Aメロ②、間奏、サビ）','Aメロ②');if(name===null)return;const s=makeSection(name.trim().slice(0,40)||'新しいブロック',st.sections.length);st.sections.push(s);st.selectedSection=s.id;selectedNote=null;checkpoint();renderAll();}
  function removeSection(id){if(st.sections.length===1)return message('最低1個のブロックが必要です。');const s=st.sections.find(s=>s.id===id);if(!confirm(`「${s.name}」を削除しますか？ 音程・歌詞も削除されます（元に戻すで復元可能）。`))return;st.sections=st.sections.filter(s=>s.id!==id);if(st.selectedSection===id){st.selectedSection=st.sections[0].id;selectedNote=null;}checkpoint();renderAll();}
  function regenerate(){const s=getSection(),m=parseMora(s.reading);if(!m.length)return message('先に「よみがな」を入れてください。');if(m.length>500)return message('1つのブロックは500音までにしてください。');const before=s.notes;let cursor=0;s.notes=m.map((k,i)=>{const prev=before[i],dur=prev?prev.dur:1;const start=prev?prev.start:cursor;cursor=Math.max(cursor,start+dur);return{id:prev?.id||makeId(),kana:k,pitch:prev?.pitch??snapPitch(64+(i%5)*2,s),start,dur};});selectedNote=s.notes[0]?.id||null;checkpoint();renderAll();message(`「${s.name}」を ${m.length} 音に分けました。音の高さと長さを調整してみてね。`);}
  function autoRead(){const s=getSection(),data=tryRead(s.lyrics);if(data.unknown.length){message('読みの不明な漢字があります。よみがな欄で補ってください。');}if(data.reading){s.reading=data.reading;checkpoint();$('readingInput').value=s.reading;renderChips();}}
  function updateSectionLyrics(field,value){const s=getSection();s[field]=value.slice(0,12000);saveSoon();if(field==='reading')renderChips();}
  function changeNote(prop,val){const n=getNote();if(!n)return;const s=getSection();if(prop==='pitch')n.pitch=Math.round(num(Number(val),MIDI_MIN,MIDI_MAX));if(prop==='start')n.start=fineNote(num(val,0,MAX_SECTION_BEATS));if(prop==='dur')n.dur=fineNote(num(val,.0625,32));checkpoint();renderKeyControls();renderInspector();renderArrangement();resizeCanvas();}
  function nudgeNote(pitchStep,beatStep){
    const n=getNote();if(!n)return message('先に動かす音を選んでください。');
    if(pitchStep)n.pitch=Math.round(num(n.pitch+pitchStep,MIDI_MIN,MIDI_MAX));
    if(beatStep)n.start=fineNote(num(n.start+beatStep,0,MAX_SECTION_BEATS));
    checkpoint();renderInspector();renderArrangement();drawCanvas();
    if(worldY(n.pitch)<viewport.scrollTop+ROW||worldY(n.pitch)>viewport.scrollTop+viewport.clientHeight-ROW*2)
      viewport.scrollTop=Math.max(0,worldY(n.pitch)-viewport.clientHeight/2);
    if(LEFT+n.start*BEATPX()<viewport.scrollLeft+LEFT||LEFT+n.start*BEATPX()>viewport.scrollLeft+viewport.clientWidth-65)
      viewport.scrollLeft=Math.max(0,LEFT+n.start*BEATPX()-viewport.clientWidth/2);
    drawCanvas();
  }
  function deleteNote(){const s=getSection(),n=getNote();if(!n)return;s.notes=s.notes.filter(x=>x.id!==n.id);selectedNote=s.notes[0]?.id||null;checkpoint();renderAll();}
  function changeKey(which,value){const s=getSection();s[which]=which==='root'?num(value,0,11):(value==='minor'?'minor':'major');checkpoint();renderKeyControls();renderSections();renderArrangement();drawCanvas();renderChords();renderAutoHarmony();}
  function transpose(amount){const s=getSection();if(!s.notes.length)return message('先に歌詞を音に分けてください。');for(const n of s.notes)n.pitch=num(n.pitch+amount,MIDI_MIN,MIDI_MAX);checkpoint();renderInspector();drawCanvas();}
  function changeZoom(amount){st.zoom=num(st.zoom+amount,.25,5);resizeCanvas();updateZoom();saveSoon();}
  function updateZoom(){$('zoomVal').textContent=Math.round(st.zoom*100)+'%';}
  const BEATPX=()=>Math.max(12,Math.round(77*st.zoom));
  const worldY=p=>(MIDI_MAX-p)*ROW+3;
  const worldWidth=()=>{const s=getSection(),max=Math.max(st.beats*2,...allTabNotes(s).map(n=>n.start+n.dur));return Math.max(viewport.clientWidth,LEFT+Math.ceil(max+8)*BEATPX());};
  function resizeCanvas(center=false){
    const space=$('canvasSpace'),cw=Math.max(1,viewport.clientWidth),ch=Math.max(1,viewport.clientHeight),worldH=(MIDI_MAX-MIDI_MIN+1)*ROW;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    space.style.width=worldWidth()+'px';space.style.height=worldH+'px';
    el.style.width=cw+'px';el.style.height=ch+'px';
    const w=Math.round(cw*dpr),h=Math.round(ch*dpr);
    if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
    if(center){const n=getNote();viewport.scrollTop=Math.max(0,worldY(n?.pitch??65)-ch/2);viewport.scrollLeft=0;}
    drawCanvas();
  }
  function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  // Paint only the viewable pixels, even for many minutes of notes and 6 octaves.
  function drawCanvas(){
    const ctx=el.getContext('2d');if(!ctx)return;
    const dpr=el.width/(parseFloat(el.style.width)||1),W=parseFloat(el.style.width),H=parseFloat(el.style.height),px=BEATPX(),s=getSection();
    const sx=viewport.scrollLeft,sy=viewport.scrollTop,xEnd=sx+W,yEnd=sy+H;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#11192b';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(-sx,-sy);
    const scale=s.mode==='minor'?MINOR:MAJOR;
    const lo=Math.max(MIDI_MIN,Math.floor(MIDI_MAX-(yEnd+4)/ROW)-1),hi=Math.min(MIDI_MAX,Math.ceil(MIDI_MAX-(sy-4)/ROW)+1);
    for(let p=lo;p<=hi;p++){
      const y=worldY(p)-3,off=((p%12)-s.root+12)%12,inKey=scale.includes(off);
      ctx.fillStyle=p===60?'#3b302a':p%12===0?'#243149':inKey?'#182238':'#121a2d';ctx.fillRect(sx,y,W,ROW);
      ctx.strokeStyle=p===60?'#e8b970':'#29334a';ctx.lineWidth=p===60?2:.7;ctx.beginPath();ctx.moveTo(sx,y+ROW);ctx.lineTo(xEnd,y+ROW);ctx.stroke();
    }
    const minBeat=Math.max(0,Math.floor((sx-LEFT)/px)),maxBeat=Math.ceil((xEnd-LEFT)/px);
    // Sub-beat guide lines show the chosen rhythmic grid without changing any saved note.
    if(px*st.grid>=6){
      ctx.beginPath();ctx.lineWidth=.5;ctx.strokeStyle='#586d9430';
      const from=Math.max(0,Math.floor(minBeat/st.grid)),to=Math.min(Math.ceil(maxBeat/st.grid),from+1600);
      for(let k=from;k<=to;k++){const beat=k*st.grid;if(Math.abs(beat-Math.round(beat))<.00001)continue;const xx=LEFT+beat*px;ctx.moveTo(xx,sy);ctx.lineTo(xx,yEnd);}
      ctx.stroke();
    }
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='11px system-ui';
    for(let beat=minBeat;beat<=maxBeat;beat++){
      const x=LEFT+beat*px,major=beat%st.beats===0;
      ctx.strokeStyle=major?'#67617f':'#333e57';ctx.lineWidth=major?1.5:1;ctx.beginPath();ctx.moveTo(x,sy);ctx.lineTo(x,yEnd);ctx.stroke();
      if(major){ctx.fillStyle='#a7a1c5';ctx.fillText(String(Math.floor(beat/st.beats)+1),x+12,sy+13);}
    }
    // Ghost notes are noninteractive: the current tab is always drawn on top.
    ensureTabs(s).forEach((tab,i)=>{if(tab.id===s.activeMelodyTab)return;for(const n of tab.notes){const x=LEFT+n.start*px,y=worldY(n.pitch),w=Math.max(26,n.dur*px-3);if(x+w<sx||x>xEnd||y+ROW<sy||y>yEnd)continue;ctx.globalAlpha=.23;ctx.fillStyle=tabColors[i%tabColors.length];rounded(ctx,x,y,w,ROW-5,5);ctx.fill();ctx.globalAlpha=1;}});
    const visible=[...s.notes].filter(n=>{
      const x=LEFT+n.start*px,y=worldY(n.pitch);
      return x+Math.max(26,n.dur*px)>=sx-30&&x<=xEnd+30&&y+ROW>=sy-4&&y<=yEnd+4;
    }).sort((a,b)=>a.start-b.start);
    if(visible.length){ctx.beginPath();ctx.strokeStyle='#89e7d6';ctx.lineWidth=3;ctx.lineJoin='round';visible.forEach((n,i)=>{
      const x=LEFT+(n.start+n.dur*.5)*px,y=worldY(n.pitch)+9;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });ctx.stroke();}
    for(const n of visible){
      const x=LEFT+n.start*px,y=worldY(n.pitch),w=Math.max(26,n.dur*px-3),h=ROW-5,sel=n.id===selectedNote,multi=groupIds.has(n.id);
      ctx.fillStyle=multi?'#34a6a0':sel?'#bc9cff':'#7267ba';rounded(ctx,x,y,w,h,6);ctx.fill();
      ctx.strokeStyle=multi?'#d1fff7':sel?'#eee1ff':'#b9b2e9';ctx.lineWidth=sel?2:1;ctx.stroke();
      ctx.fillStyle='#f5f2ff';ctx.font='bold 12px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.save();ctx.beginPath();ctx.rect(x+5,y,Math.max(0,w-16),h);ctx.clip();ctx.fillText(`${n.kana} / ${romaji(n.kana)}`,x+8,y+h/2);ctx.restore();
      ctx.fillStyle=sel?'#e1fff8':'#c3f6e8';ctx.beginPath();ctx.arc(x+w-8,y+h/2,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#4c7285';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=sel?'#fff3ff':'#d5ceff';ctx.beginPath();ctx.arc(x+w/2,y+h/2,2,0,2*Math.PI);ctx.fill();
    }
    if(marquee){const a=marquee.start,b=marquee.end;ctx.fillStyle='#78e8c32a';ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));ctx.strokeStyle='#91ffdb';ctx.lineWidth=2;ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
    if(autoPickMode||autoRange.sectionId===s.id){const r=autoSelectedRange(),a=LEFT+r.start*px,b=LEFT+r.end*px;
      ctx.fillStyle=autoPickMode?'#9aeecc31':'#ad94ff1e';ctx.fillRect(a,sy,Math.max(2,b-a),H);
      ctx.lineWidth=2;ctx.strokeStyle='#a0ead9';for(const xx of [a,b]){if(xx<sx||xx>xEnd)continue;ctx.beginPath();ctx.moveTo(xx,sy);ctx.lineTo(xx,yEnd);ctx.stroke();}}
    if(playing&&playing.highlightSection===s.id){const beat=(ctx2.currentTime-playing.audioStart)*(st.bpm/60)-playing.sectionStartBeat,x=LEFT+beat*px;
      if(x>=sx&&x<xEnd){ctx.strokeStyle='#ffd792';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,sy);ctx.lineTo(x,yEnd);ctx.stroke();}}
    // Fixed piano labels remain on the left while scrolling the melody.
    ctx.fillStyle='#12192aef';ctx.fillRect(sx,sy,LEFT,H);
    for(let p=lo;p<=hi;p++){
      const y=worldY(p)-3;
      ctx.fillStyle=p===60?'#87662f':[1,3,6,8,10].includes(p%12)?'#2f3449':'#464b60';ctx.fillRect(sx,y,LEFT-4,ROW-1);
      ctx.textAlign='right';ctx.fillStyle=p===60?'#fff1bd':'#f0edfc';ctx.font=p===60?'bold 12px system-ui':'11px system-ui';ctx.fillText(p===60?(st.pitchNotation==='solfege'?'ド4 ●':'C4 ●'):noteName(p),sx+LEFT-11,y+ROW/2);
    }
    ctx.restore();
  }
  const canvasPos=e=>{const rect=el.getBoundingClientRect();return{x:e.clientX-rect.left+viewport.scrollLeft,y:e.clientY-rect.top+viewport.scrollTop};};
  // The handle occupies only the last 11px; short notes retain a generous draggable body.
  // Previously a 25px-wide handle target covered nearly the entire short note.
  function hitNote(x,y){
    const notes=getSection().notes,px=BEATPX();
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i],nx=LEFT+n.start*px,ny=worldY(n.pitch),w=Math.max(26,n.dur*px-3);
      if(x<nx-2||x>nx+w+3||y<ny-2||y>ny+ROW-2)continue;
      return{note:n,edge:x>=nx+w-11};
    }
    return null;
  }
  function renderGroupStatus(){if(!$('groupStatus'))return;
    $('groupStatus').textContent=groupIds.size?`選択中：${groupIds.size}音`:'音のない場所をなぞって、四角で囲んでください';
    $('groupSelectMode').classList.toggle('on',groupMode);$('groupSelectMode').setAttribute('aria-pressed',String(groupMode));
    $('clearGroup').disabled=!groupIds.size;$('deleteGroup').disabled=!groupIds.size;
  }
  function clearGroup(){groupIds.clear();renderGroupStatus();drawCanvas();}
  function editGroup(pitchDelta,beatDelta){if(!groupIds.size)return;const notes=getSection().notes.filter(n=>groupIds.has(n.id));
    const low=Math.min(...notes.map(n=>n.pitch)),high=Math.max(...notes.map(n=>n.pitch)),first=Math.min(...notes.map(n=>n.start)),last=Math.max(...notes.map(n=>n.start));
    const dp=Math.max(MIDI_MIN-low,Math.min(MIDI_MAX-high,pitchDelta)),db=fineNote(Math.max(-first,Math.min(MAX_SECTION_BEATS-last,beatDelta)));
    for(const n of notes){n.pitch+=dp;n.start=fineNote(n.start+db);}
    checkpoint();renderInspector();renderArrangement();renderSections();resizeCanvas();
  }
  function deleteGroup(){if(!groupIds.size)return;if(!confirm(`${groupIds.size}音をまとめて削除しますか？（元に戻す可能）`))return;
    const s=getSection();s.notes=s.notes.filter(n=>!groupIds.has(n.id));selectedNote=s.notes[0]?.id||null;groupIds.clear();checkpoint();renderAll();}
  function hideNoteMenu(){$('noteActionMenu').hidden=true;}
  function openNoteMenu(n,clientX,clientY){selectedNote=n.id;const menu=$('noteActionMenu');$('noteMenuLabel').textContent=`「${n.kana}」 ${noteName(n.pitch)}（${n.dur}拍）`;menu.hidden=false;menu.style.left=Math.max(8,Math.min(clientX-60,window.innerWidth-280))+'px';menu.style.top=Math.max(8,Math.min(clientY+12,window.innerHeight-130))+'px';renderInspector();drawCanvas();}
  function newNote(start,pitch){const s=getSection();if(s.notes.length>=500){message('1つのブロックは最大500音です。');return null;}const mora=parseMora(s.reading||tryRead(s.lyrics).reading);const used=s.notes.map(n=>n.kana);const kana=mora.find((k,i)=>i>=used.length)||'ら';const n={id:makeId(),kana,pitch:Math.round(num(pitch,MIDI_MIN,MIDI_MAX)),start:fineNote(snapGrid(num(start,0,MAX_SECTION_BEATS))),dur:Math.max(.0625,st.grid)};s.notes.push(n);selectedNote=n.id;checkpoint();renderAll();return n;}
  // Row center maps to the exact MIDI note, including black keys (no invisible key snapping).
  const graphPitch=y=>num(Math.ceil(MIDI_MAX-(y-3)/ROW),MIDI_MIN,MIDI_MAX);
  function updateCanvasDrag(e){
    if(!drag)return;
    const p=canvasPos(e),dx=e.clientX-drag.clientX,dy=e.clientY-drag.clientY,s=getSection();
    if(drag.mode==='autoChordRange'){
      const a=Math.max(0,roundBeat((p.x-LEFT)/BEATPX())),b=drag.anchor;
      autoRange={sectionId:s.id,start:Math.min(a,b),end:Math.max(a,b)+.25};renderAutoHarmony();drawCanvas();return;
    }
    if(drag.mode==='selectRange'){marquee.end=p;drawCanvas();return;}
    if(drag.mode==='groupMove'){const db=Math.round(dx/(BEATPX()*st.grid))*st.grid,dp=-Math.round(dy/ROW);
      const members=s.notes.filter(n=>groupIds.has(n.id));if(!members.length)return;
      const first=Math.min(...drag.original.map(n=>n.start)),last=Math.max(...drag.original.map(n=>n.start)),lo=Math.min(...drag.original.map(n=>n.pitch)),hi=Math.max(...drag.original.map(n=>n.pitch));
      const shift=fineNote(Math.max(-first,Math.min(MAX_SECTION_BEATS-last,db))),pitch=Math.max(MIDI_MIN-lo,Math.min(MIDI_MAX-hi,dp));
      for(const n of members){const original=drag.original.find(o=>o.id===n.id);n.start=fineNote(original.start+shift);n.pitch=original.pitch+pitch;}drawCanvas();return;}
    if(drag.mode==='pan'){
      viewport.scrollLeft=drag.scrollX-dx;viewport.scrollTop=drag.scrollY-dy;drawCanvas();return;
    }
    const n=s.notes.find(n=>n.id===drag.noteId);if(!n||drag.mode==='menu')return;
    // Screen-space deltas remain stable even while the canvas scrolls.
    // Each horizontal step = 1/4 beat; each vertical step = precisely 1 semitone.
    const steps=Math.round(dx/(BEATPX()*st.grid))*st.grid;
    if(drag.mode==='size')n.dur=fineNote(num(drag.dur+steps,.0625,32));
    else if(drag.mode==='move'){
      n.start=fineNote(num(drag.start+steps,0,MAX_SECTION_BEATS));
      n.pitch=num(drag.pitch-Math.round(dy/ROW),MIDI_MIN,MIDI_MAX);
    }
    drawCanvas();
    if(!drag.inspectorQueued){
      drag.inspectorQueued=true;
      requestAnimationFrame(()=>{if(drag?.noteId===n.id){drag.inspectorQueued=false;renderInspector();}});
    }
  }
  function bindCanvas(){
    el.addEventListener('contextmenu',e=>{e.preventDefault();const p=canvasPos(e),hit=hitNote(p.x,p.y);if(hit)openNoteMenu(hit.note,e.clientX,e.clientY);});
    el.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;hideNoteMenu();const p=canvasPos(e),hit=hitNote(p.x,p.y);try{el.setPointerCapture(e.pointerId);}catch{};
      if(groupMode){if(hit&&groupIds.has(hit.note.id)){drag={mode:'groupMove',clientX:e.clientX,clientY:e.clientY,x:p.x,y:p.y,pointerId:e.pointerId,changed:false,original:getSection().notes.filter(n=>groupIds.has(n.id)).map(n=>({id:n.id,pitch:n.pitch,start:n.start}))};selectedNote=hit.note.id;void auditionPitch(hit.note.pitch,.45);renderInspector();}
        else{marquee={start:p,end:p};drag={mode:'selectRange',clientX:e.clientX,clientY:e.clientY,x:p.x,y:p.y,pointerId:e.pointerId,changed:false};}drawCanvas();e.preventDefault();return;}
      if(autoPickMode){const anchor=Math.max(0,roundBeat((p.x-LEFT)/BEATPX()));drag={mode:'autoChordRange',anchor,x:p.x,y:p.y,changed:false,pointerId:e.pointerId};autoRange={sectionId:getSection().id,start:anchor,end:anchor+.25};renderAutoHarmony();drawCanvas();e.preventDefault();return;}
      if(hit){selectedNote=hit.note.id;void auditionPitch(hit.note.pitch,Math.min(1.25,hit.note.dur*60/st.bpm));drag={mode:hit.edge?'size':'move',noteId:hit.note.id,start:hit.note.start,pitch:hit.note.pitch,dur:hit.note.dur,x:p.x,y:p.y,clientX:e.clientX,clientY:e.clientY,changed:false,held:false,pointerId:e.pointerId,timer:null};
        if(!hit.edge){const pointer=e.pointerId,cx=e.clientX,cy=e.clientY;drag.timer=setTimeout(()=>{if(drag&&drag.pointerId===pointer&&!drag.changed){drag.held=true;drag.mode='menu';openNoteMenu(hit.note,cx,cy);}},HOLD_MS);}
        renderInspector();drawCanvas();}
      else{drag={mode:'pan',x:p.x,y:p.y,clientX:e.clientX,clientY:e.clientY,scrollX:viewport.scrollLeft,scrollY:viewport.scrollTop,changed:false,pointerId:e.pointerId};}
      e.preventDefault();});
    el.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId)return;const p=canvasPos(e);if(Math.hypot((drag.mode==='pan'?e.clientX-drag.clientX:p.x-drag.x),(drag.mode==='pan'?e.clientY-drag.clientY:p.y-drag.y))>DRAG_THRESHOLD){if(drag.timer){clearTimeout(drag.timer);drag.timer=null;}drag.changed=true;}if(drag.changed||drag.mode==='size'||drag.mode==='autoChordRange')updateCanvasDrag(e);});
    const finish=(e,cancelled=false)=>{if(!drag||drag.pointerId!==e.pointerId)return;const d=drag;drag=null;if(d.timer)clearTimeout(d.timer);try{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);}catch{};
      if(d.mode==='selectRange'){if(!cancelled){const a=marquee?.start||{x:d.x,y:d.y},b=marquee?.end||a;groupIds.clear();
        const l=Math.min(a.x,b.x),r=Math.max(a.x,b.x),t=Math.min(a.y,b.y),bt=Math.max(a.y,b.y);
        for(const n of getSection().notes){const x=LEFT+n.start*BEATPX(),y=worldY(n.pitch),w=Math.max(26,n.dur*BEATPX()-3);if(x+w>=l&&x<=r&&y+ROW>=t&&y<=bt)groupIds.add(n.id);}
        if(!d.changed){const hit=hitNote(a.x,a.y);if(hit)groupIds.add(hit.note.id);}if(groupIds.size)selectedNote=[...groupIds][0];}
        marquee=null;renderInspector();drawCanvas();}
      else if(d.mode==='autoChordRange'){autoPickMode=false;autoCandidates=[];renderAutoHarmony();}
      else if(d.mode==='pan'&&!d.changed&&!cancelled){const p=canvasPos(e);if(p.x>=LEFT-3){const n=newNote((p.x-LEFT)/BEATPX(),graphPitch(p.y));if(n)void auditionPitch(n.pitch,.55); }else{void auditionPitch(graphPitch(p.y),.65);}}
      else if(d.mode==='menu'){/* Leave the delete / listen menu open. */}
      else if(d.changed){checkpoint();renderArrangement();renderSections();if(d.mode==='size')message(`音の長さを ${getNote()?.dur||0} 拍に変更しました。`,1250);}
      else if(d.noteId&&!cancelled){/* The note was already auditioned on pointer-down (iPad gesture). */}
      drawCanvas();};
    el.addEventListener('pointerup',e=>finish(e,false));el.addEventListener('pointercancel',e=>finish(e,true));el.addEventListener('lostpointercapture',e=>{if(drag&&drag.pointerId===e.pointerId)finish(e,true);});
    $('menuEditDetails').onclick=()=>{hideNoteMenu();const panel=$('noteEditDisclosure');panel.open=true;panel.scrollIntoView({block:'nearest',behavior:'smooth'});renderInspector();};
    $('menuDelete').onclick=()=>{hideNoteMenu();deleteNote();};$('menuPreview').onclick=()=>{hideNoteMenu();playOne();};$('menuClose').onclick=hideNoteMenu;
    viewport.addEventListener('scroll',()=>requestAnimationFrame(drawCanvas),{passive:true});
  }
  function stamp(sec){const n=Math.floor(Math.max(0,sec));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
  // Unlock audio on the user's interaction, before awaiting any promise (required by iOS Safari).
  async function audio(){if(!CTX)throw Error('Web Audioが使えません。Safariで開いてください。');if(!ctx2||ctx2.state==='closed'){ctx2=new CTX();}
    const c=ctx2;
    if(c.state!=='running'){
      const o=c.createOscillator(),g=c.createGain();g.gain.value=0;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.02);
      await c.resume();
    }
    $('audioStatus').textContent=c.state==='running'?'音声：使用可能':'音声：停止中';
    if(c.state!=='running')throw Error('音声エンジンが停止中です。画面を一度タップし、端末の音量を確認してください。');
    return c;}
  // Every live oscillator passes through a dynamics limiter; louder piano chords do not clip as easily.
  function audioOutput(c){
    if(audioBus?.context===c)return audioBus.input;
    const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=10;limiter.ratio.value=10;limiter.attack.value=.003;limiter.release.value=.16;
    const output=c.createGain();output.gain.value=.94;limiter.connect(output);output.connect(c.destination);
    audioBus={context:c,input:limiter};return limiter;
  }
  function loudness(){return Math.pow(st.volume/100,.72);}
  // Small bounded cache: avoids producing a new buffer for every chord hit while
  // keeping the Web Audio timbre equal to the offline/native WAV rendering.
  // Expand each harmonic span to rhythmic attacks. The source progression is preserved,
  // and changing the accompaniment pattern never changes the melody or bar lengths.
  function rhythmChords(events,proj){const result=[];
    for(const e of events){const block=proj.blocks.find(b=>e.beat>=b.start-.00001&&e.beat<b.start+b.length+.00001),feel=block?.section.chordFeel||'sustain';
      if(feel==='sustain'){result.push(e);continue;}
      const beatGap=feel==='slow'?2:feel==='quarter'?1:feel==='eighth'?.5:feel==='sixteenth'?.25:feel==='dramatic'?.5:.5;
      let offset=0,idx=0;
      while(offset<e.duration-.00001&&idx<2048){const b=Math.min(beatGap,e.duration-offset);let pitches=e.pitches;
        if(feel==='arpeggio'||feel==='sparkle')pitches=[e.pitches[(feel==='sparkle'?(idx*2)%e.pitches.length:idx%e.pitches.length)]];
        const intensity=feel==='dramatic'?(idx%4===0?1.1:idx%2===0?.8:.52):feel==='sparkle'?.72:feel==='slow'?.95:.82;
        result.push({beat:e.beat+offset,duration:Math.min(b*(feel==='sparkle'?.88:.83),e.duration-offset),pitches,velocity:intensity});offset+=b;idx++;
      }
    }
    return result;
  }
  const pianoBuffers=new Map(),PIANO_BUFFER_RATE=22050,PIANO_BUFFER_LIMIT=20;
  function sampledPiano(c,pitch,length,type){
    const qLength=Math.max(.1,Math.ceil(length*8)/8),key=pitch+'|'+qLength+'|'+type;
    const hit=pianoBuffers.get(key);if(hit){pianoBuffers.delete(key);pianoBuffers.set(key,hit);return hit;}
    const rate=PIANO_BUFFER_RATE,frames=Math.ceil((qLength+PIANO_TAIL)*rate);
    const buffer=c.createBuffer(1,frames,rate),a=buffer.getChannelData(0);
    const hz=440*Math.pow(2,(pitch-69)/12);
    for(let i=0;i<frames;i++)a[i]=pianoSample(hz,i/rate,qLength,type,rate);
    pianoBuffers.set(key,buffer);
    while(pianoBuffers.size>PIANO_BUFFER_LIMIT)pianoBuffers.delete(pianoBuffers.keys().next().value);
    return buffer;
  }
  function tone(c,pitch,time,dur,vol=.15,type=st.sound){
    const start=Math.max(time,c.currentTime+.001),length=Math.max(.08,dur),peak=Math.max(.0002,vol);
    if(type!=='pure'){
      const sound=c.createBufferSource(),gain=c.createGain();
      sound.buffer=sampledPiano(c,Math.round(pitch),length,type);
      gain.gain.setValueAtTime(peak,start);
      sound.connect(gain);gain.connect(audioOutput(c));sound.start(start);
      sound.stop(start+sound.buffer.duration+.02);
      return [sound];
    }
    const hz=440*Math.pow(2,(num(pitch,0,127)-69)/12),stop=start+length+.12;
    const env=c.createGain();env.gain.setValueAtTime(.0001,start);env.gain.linearRampToValueAtTime(peak,start+.02);
    env.gain.setValueAtTime(peak,start+length);env.gain.exponentialRampToValueAtTime(.0001,stop);env.connect(audioOutput(c));
    const osc=c.createOscillator();osc.type='sine';osc.frequency.value=hz;
    osc.connect(env);osc.start(start);osc.stop(stop+.02);return[osc];
  }
  async function auditionPitch(pitch,dur=.65,test=false){try{if(useNative()){nativePitch(pitch,dur);if(test)message('中央のド C4 を音声ファイル方式で再生しています。',2400);return;}const c=await audio();tapAudioNodes.forEach(o=>{try{o.stop();}catch{}});tapAudioNodes=tone(c,pitch,c.currentTime+.025,dur,test?.56:loudness()*.63,st.sound);if(test)message('中央のド C4（約262Hz）を鳴らしています。',2200);}catch(e){$('audioStatus').textContent='音声：起動失敗';message('音を再生できません：'+e.message,6500);}}
  function clickSound(c,time,strong){const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.value=strong?990:650;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(strong?.15:.08,time+.006);gain.gain.exponentialRampToValueAtTime(.0001,time+.055);osc.connect(gain);gain.connect(audioOutput(c));osc.start(time);osc.stop(time+.065);return osc;}
  function stopPlay(){if(nativePlayer&&!nativePlayer.paused)releaseNative();if(!playing)return;clearInterval(playing.timer);cancelAnimationFrame(playing.raf||0);playing.nodes.forEach(n=>{try{n.stop(0);}catch{}});playing=null;practice=false;$('practiceMetro').textContent='メトロノームだけ鳴らす';$('pulseDots').querySelectorAll('span').forEach(x=>x.classList.remove('on'));drawCanvas();}
  function playFrame(){if(!playing||!ctx2)return;const sec=Math.max(0,ctx2.currentTime-playing.audioStart),b=sec*(st.bpm/60),duration=playing.practice?Math.max(0,b):playing.durationSec;$('timeDisplay').textContent=stamp(sec)+' / '+(playing.practice?'∞':stamp(duration));const dots=[...$('pulseDots').children],idx=Math.floor(b)%st.beats;dots.forEach((el,i)=>el.classList.toggle('on',i===idx));if(!playing.practice&&sec>duration+.12){stopPlay();renderAll();return;}drawCanvas();playing.raf=requestAnimationFrame(playFrame);}
  async function startPlay(mode,presetNotes=null){if(useNative()){try{nativeStartPlay(mode,presetNotes);}catch(e){message('試聴エラー：'+e.message,6500);}return;}stopChordPreview();stopPlay();try{const c=await audio(),proj=projectEvents(),baseBeat=mode==='section'?(proj.blocks.find(b=>b.section.id===st.selectedSection)?.start||0):mode==='selected'?(proj.blocks.find(b=>b.section.id===st.selectedSection)?.start||0)+(getNote()?.start||0):0,sectionLimit=mode==='section'?getLength(getSection()):null,all=mode==='metro'?[]:proj.events.filter(n=>n.beat>=baseBeat&&(sectionLimit===null||n.sectionId===st.selectedSection)&&(tabPlayback==='all'||n.tabId===activeTab(st.sections.find(x=>x.id===n.sectionId)||getSection()).id));const candidate=presetNotes||[];if(mode==='preset'){all.splice(0,all.length,...candidate.map(n=>({beat:n.start,duration:n.dur,pitch:n.pitch,kana:n.kana,sectionId:null,noteId:n.id})));}const tot=mode==='metro'?Infinity:mode==='preset'?Math.max(st.beats,...candidate.map(n=>n.start+n.dur)):mode==='section'?sectionLimit:Math.max(0,proj.totalBeats-baseBeat);const chordEvents=st.chordAlong&&mode!=='metro'&&mode!=='preset'?rhythmChords(chordTimelineEvents(proj,baseBeat,baseBeat+tot,mode==='section'),proj):[];if(mode!=='metro'&&!all.length&&!chordEvents.length)return message('まだ音がありません。メロディーまたはコードを用意してください。');const audioStart=c.currentTime+.08,secPerBeat=60/st.bpm;playing={audioStart,baseBeat,totalBeats:tot,durationSec:tot*secPerBeat,nodes:[],timer:null,raf:0,nextEvent:0,nextChord:0,nextTick:0,highlightSection:mode==='preset'?null:st.selectedSection,sectionStartBeat:(proj.blocks.find(b=>b.section.id===st.selectedSection)?.start||0)-baseBeat,practice:mode==='metro'};const p=playing;p.events=all.map(e=>({...e,when:e.beat-baseBeat}));p.chordEvents=chordEvents.map(e=>({...e,when:e.beat-baseBeat}));if(mode==='metro'){practice=true;$('practiceMetro').textContent='メトロノームを止める';}
      const schedule=()=>{if(!playing||playing!==p)return;const now=c.currentTime;while(p.nextEvent<p.events.length &&p.audioStart+p.events[p.nextEvent].when*secPerBeat<now+.20){const ev=p.events[p.nextEvent++],when=p.audioStart+ev.when*secPerBeat;if(when>=now-.02)p.nodes.push(...tone(c,ev.pitch,Math.max(when,now),Math.max(.07,ev.duration*secPerBeat*.93),loudness()*.60));}
        while(p.nextChord<p.chordEvents.length&&p.audioStart+p.chordEvents[p.nextChord].when*secPerBeat<now+.20){const ev=p.chordEvents[p.nextChord++],when=p.audioStart+ev.when*secPerBeat;if(when>=now-.02)for(const pitch of ev.pitches)p.nodes.push(...tone(c,pitch+12,Math.max(when,now),Math.max(.12,ev.duration*secPerBeat*.92),loudness()*.16*(ev.velocity||1),'piano'));}
        while((st.metro||mode==='metro') && p.audioStart+p.nextTick*secPerBeat<now+.20 &&(mode==='metro'||p.nextTick<tot)){const when=p.audioStart+p.nextTick*secPerBeat;if(when>=now-.02)p.nodes.push(clickSound(c,Math.max(now,when),p.nextTick%st.beats===0));p.nextTick++;}
      };schedule();p.timer=setInterval(schedule,25);p.raf=requestAnimationFrame(playFrame);
    }catch(e){stopPlay();$('audioStatus').textContent='音声：再生失敗';message(`再生できません：${e.message}`,6500);}}
  function playOne(){const n=getNote();if(!n)return message('先に音を選んでください。');void auditionPitch(n.pitch,Math.min(n.dur*60/st.bpm,4));}
  const enc=new TextEncoder();
  function download(blob,filename){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;a.style.display='none';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},6000);}
  function filename(){return (st.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,60)||'melody');}
  function exportProject(){download(new Blob([JSON.stringify({...projectSnapshot(),customChordLibrary:customChords},null,2)],{type:'application/json'}),filename()+'-melody-project.json');message('歌詞・メロディー・コード進行・和声の選択範囲と自作ライブラリを保存しました。');}
  async function importProject(file){if(!file)return;if(file.size>8*1024*1024)return message('プロジェクトファイルが大きすぎます。');let data;try{data=JSON.parse(await file.text());if(!data||data.version!==1||!Array.isArray(data.sections))throw Error('形式が違います');}catch(e){return message('Melody AtelierのJSONプロジェクトを選んでください。');}if(!confirm('現在の曲を読み込み内容で置き換えます。先にバックアップしましたか？'))return;try{stopPlay();loadData(data);if(Array.isArray(data.customChordLibrary)){const imported=chordLibraryClean(data.customChordLibrary);for(const item of imported){if(customChords.length>=300)break;if(!customChords.some(x=>x.name===item.name&&JSON.stringify(x.steps)===JSON.stringify(item.steps)))customChords.push({...item,id:'project-'+Date.now()+'-'+customChords.length});}saveChordLibrary();}history=[];historyIndex=-1;checkpoint();renderAll();message('保存した曲を復元しました。');}catch(e){message('読み込み失敗：'+e.message);}}
  const MAX_GUIDE_SEC=900;
  // Render exactly once for both standalone WAV and Melody→Voice transfer.
  // The source remains the editable JSON project; WAV is a guide, not notation.
  function renderGuideBlob(part='both'){
    const p=projectEvents(),chords=(part==='chords'||st.chordAlong)?rhythmChords(chordTimelineEvents(p),p):[];
    if(!(part==='melody'?p.events.length:part==='chords'?chords.length:(p.events.length||chords.length)))throw new Error('先にメロディーまたはコードを用意してください。');
    const seconds=p.totalBeats*60/st.bpm;
    if(seconds>MAX_GUIDE_SEC)throw new Error('ガイド音声は15分までです。曲の構成を短くしてください。');
    const rate=seconds>480?24000:32000,frames=Math.max(1,Math.ceil((seconds+.4)*rate));
    const samples=new Float32Array(frames),type=st.sound,bp=60/st.bpm;
    for(const n of (part==='chords'?[]:p.events)){
      const start=Math.max(0,Math.floor(n.beat*bp*rate)),length=n.duration*bp*.94,freq=440*Math.pow(2,(n.pitch-69)/12),amplitude=(st.volume/100)*.36;
      const len=Math.max(0,Math.min(frames-start,Math.ceil((length+PIANO_TAIL)*rate)));
      for(let i=0;i<len;i++){
        const t=i/rate,v=type==='pure'?Math.sin(2*Math.PI*freq*t)*Math.min(1,t/.014)*(t>length?Math.exp(-(t-length)/.055):1):pianoSample(freq,t,length,type,rate);
        samples[start+i]+=v*amplitude;
      }
    }
    for(const event of (part==='melody'?[]:chords)){
      const start=Math.round(event.beat*bp*rate),length=event.duration*bp*.9;
      for(const pitch of event.pitches){
        const f=440*Math.pow(2,(pitch+12-69)/12),count=Math.max(0,Math.min(frames-start,Math.ceil((length+PIANO_TAIL)*rate)));
        for(let i=0;i<count;i++)samples[start+i]+=.12*(event.velocity||1)*pianoSample(f,i/rate,length,'piano',rate)*(st.volume/100);
      }
    }
    let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(samples[i]));
    const scale=peak>.96?.96/peak:1,buf=new ArrayBuffer(44+frames*2),view=new DataView(buf);
    const put=(off,str)=>{for(let i=0;i<str.length;i++)view.setUint8(off+i,str.charCodeAt(i));};
    put(0,'RIFF');view.setUint32(4,36+frames*2,true);put(8,'WAVE');put(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,frames*2,true);
    for(let i=0;i<frames;i++){const x=Math.max(-1,Math.min(1,samples[i]*scale));view.setInt16(44+i*2,x<0?x*32768:x*32767,true);}
    return new Blob([buf],{type:'audio/wav'});
  }
  function exportStem(part){try{download(renderGuideBlob(part),filename()+'-'+(part==='melody'?'melody':'accompaniment')+'.wav');message('パート別WAVを書き出しました。');}catch(e){message('書き出し失敗：'+e.message,6000);}}
  function exportWav(){
    const button=$('exportWav');button.disabled=true;button.textContent='作成中…';
    setTimeout(()=>{try{download(renderGuideBlob(),filename()+'-melody-guide.wav');message('ガイド音声を書き出しました。',4500);}
      catch(e){console.error(e);message('WAV書き出し：'+e.message,6000);}
      finally{button.disabled=false;button.textContent='ガイド音声 WAV ↓';}},50);
  }
  const bridgeEncoder=new TextEncoder();
  const bridgeCRCTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
  function bridgeCRC32(bytes){let c=0xffffffff;for(const b of bytes)c=bridgeCRCTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  // ZIP STORED with CRCs, intentionally compatible with Voice Atelier's strict ZIP reader.
  function bridgeZip(entries){const parts=[],central=[];let offset=0;
    for(const entry of entries){const name=bridgeEncoder.encode(entry.name),bytes=entry.bytes,crc=bridgeCRC32(bytes);
      const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,0,true);
      v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,bytes);
      const cd=new Uint8Array(46+name.length),d=new DataView(cd.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(10,0,true);
      d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);cd.set(name,46);central.push(cd);offset+=local.length+bytes.length;
    }
    let sum=0;for(const cd of central){parts.push(cd);sum+=cd.length;}
    const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,sum,true);view.setUint32(16,offset,true);parts.push(end);
    return new Blob(parts,{type:'application/zip'});
  }
  async function exportForVoice(){const btn=$('exportVoice');btn.disabled=true;btn.textContent='連携ZIPを作成中…';
    // Let Safari update button before rendering the audio on the UI thread.
    await new Promise(r=>setTimeout(r,60));
    try{
      const p=projectEvents();if(p.blocks.length>40)throw Error('Voice Atelierは40ブロックまでです。');
      const melodyWav=renderGuideBlob('melody'),chordWav=renderGuideBlob('chords');
      const bridge={format:'melody-voice-bridge',version:2,source:'Melody Atelier',title:st.title,bpm:st.bpm,beats:st.beats,
        audioFile:'melody.wav',melodyFile:'melody.wav',accompanimentFile:'accompaniment.wav',includesChords:true,guideSeconds:p.totalBeats*60/st.bpm,
        sections:p.blocks.map(b=>({name:b.section.name,lyrics:b.section.lyrics,reading:b.section.reading,startBeat:b.start,
          bars:Math.max(1,Math.ceil(b.length/st.beats)),lengthBeats:b.length,gapBeats:b.section.gap,
          root:b.section.root,mode:b.section.mode,notes:allTabNotes(b.section),melodyTabs:b.section.melodyTabs,chords:b.section.chords,harmonies:b.section.harmonies}))};
      if(bridge.sections.some(s=>s.bars>48))throw Error('Voice Atelierでは1ブロック最大48小節です。長いブロックを分けてください。');
      const entries=[{name:'bridge.json',bytes:bridgeEncoder.encode(JSON.stringify(bridge))},
        {name:'melody.wav',bytes:new Uint8Array(await melodyWav.arrayBuffer())},
        {name:'accompaniment.wav',bytes:new Uint8Array(await chordWav.arrayBuffer())},
        {name:'melody-edit.json',bytes:bridgeEncoder.encode(JSON.stringify(p.events))},
        {name:'chords-edit.json',bytes:bridgeEncoder.encode(JSON.stringify(chordTimelineEvents(p)))},
        {name:'melody-project.json',bytes:bridgeEncoder.encode(JSON.stringify({...projectSnapshot(),customChordLibrary:customChords}))}];
      download(bridgeZip(entries),filename()+'-Voice連携.zip');
      message('歌詞・BPM・曲構成・ガイド音声を1つのZIPに保存。Voice Atelierで「Melodyから連携ZIP」を選択してください。',6800);
    }catch(e){console.error(e);message('連携ZIPの作成に失敗：'+e.message,6500);}
    finally{btn.disabled=false;btn.textContent='↗ Voice Atelierへ渡すZIP';}
  }
  const varLen=v=>{let x=Math.max(0,Math.floor(v)),buf=x&0x7f;const out=[];while((x>>=7)>0){buf<<=8;buf|=((x&0x7f)|0x80);}while(true){out.push(buf&0xff);if(buf&0x80)buf>>=8;else break;}return out;};
  function exportMidi(){const p=projectEvents();if(!p.events.length&&!chordTimelineEvents(p).length)return message('メロディーまたはコードがありません。');const ppq=480,midiEvents=[];const add=(beat,priority,arr)=>midiEvents.push({tick:Math.max(0,Math.round(beat*ppq)),priority,data:arr});const meta=(type,bytes)=>[0xff,type,...varLen(bytes.length),...bytes];
    const tempo=Math.round(60000000/st.bpm);add(0,0,meta(0x51,[(tempo>>16)&255,(tempo>>8)&255,tempo&255]));add(0,0,meta(0x58,[st.beats,st.beats===6?3:2,24,8]));const map=[0,7,2,-3,4,-1,6,1,-4,3,-2,5];
    for(const b of p.blocks){if(!b.length)continue;add(b.start,0,meta(0x06,[...enc.encode(b.section.name)]));const signature=map[b.section.root];add(b.start,0,meta(0x59,[signature&255,b.section.mode==='minor'?1:0]));}
    for(const n of p.events){add(n.beat,2,[0x90,Math.round(n.pitch),95]);add(n.beat,3,meta(0x05,[...enc.encode(n.kana)]));add(n.beat+n.duration,1,[0x80,Math.round(n.pitch),0]);}
    add(0,1,[0xc1,0]);for(const ch of rhythmChords(chordTimelineEvents(p),p)){for(const note of ch.pitches){add(ch.beat,2,[0x91,Math.round(note),62]);add(ch.beat+ch.duration*.9,1,[0x81,Math.round(note),0]);}}
    midiEvents.sort((a,b)=>a.tick-b.tick||a.priority-b.priority);const bytes=[];let last=0;for(const e of midiEvents){bytes.push(...varLen(e.tick-last),...e.data);last=e.tick;}bytes.push(0,0xff,0x2f,0);const track=new Uint8Array(bytes),buff=new ArrayBuffer(14+8+track.length),v=new DataView(buff);const word=(off,s)=>{for(let i=0;i<s.length;i++)v.setUint8(off+i,s.charCodeAt(i));};word(0,'MThd');v.setUint32(4,6);v.setUint16(8,0);v.setUint16(10,1);v.setUint16(12,ppq);word(14,'MTrk');v.setUint32(18,track.length);new Uint8Array(buff,22).set(track);download(new Blob([buff],{type:'audio/midi'}),filename()+'.mid');message('MIDIを書き出しました。音程と長さを対応ソフトに渡せます。');}
  window.MelodyAtelierImportNotes=(notes)=>{const section=getSection();if(!Array.isArray(notes)||!notes.length)return false;if(notes.length>500)notes=notes.slice(0,500);if(section.notes.length&&!confirm('現在のタブに解析結果を追加しますか？（元の音は残ります）'))return false;for(const note of notes){section.notes.push({id:makeId(),kana:'ラ',pitch:Math.round(num(note.pitch,MIDI_MIN,MIDI_MAX)),start:fineNote(num(note.start,0,MAX_SECTION_BEATS)),dur:fineNote(num(note.dur,.0625,32))});}selectedNote=section.notes.at(-1)?.id||null;checkpoint();renderAll();return true;};
  function bindControls(){
    $('addMelodyTab').onclick=addTab;$('renameMelodyTab').onclick=()=>tabAction('rename');$('duplicateMelodyTab').onclick=()=>tabAction('duplicate');$('deleteMelodyTab').onclick=()=>tabAction('delete');$('tabPlaybackMode').onchange=e=>{tabPlayback=e.target.value==='solo'?'solo':'all';};
    for(let i=0;i<12;i++){const option=new Option(ROOTS[i],i);$('keyRoot').add(option);}for(let p=MIDI_MAX;p>=MIDI_MIN;p--){$('notePitch').add(new Option(noteName(p),p));}
    $('pitchNotation').onchange=e=>{st.pitchNotation=e.target.value==='solfege'?'solfege':'letter';refreshPitchNotation();renderKeyControls();renderInspector();$('noteActionMenu').hidden=true;drawCanvas();checkpoint();};
    $('projectTitle').oninput=e=>{st.title=e.target.value.slice(0,80);saveSoon();};$('projectTitle').onchange=checkpoint;
    $('bpm').onchange=e=>{st.bpm=num(e.target.value,40,240,100);e.target.value=st.bpm;checkpoint();renderAll();};$('beats').onchange=e=>{st.beats=Number(e.target.value);checkpoint();renderAll();};$('soundType').onchange=e=>{st.sound=e.target.value;checkpoint();};$('masterVolume').oninput=e=>{st.volume=num(e.target.value,0,100);$('volumeReadout').textContent=st.volume+'%';saveSoon();};$('masterVolume').onchange=checkpoint;$('audioEngine').value=outputMode;$('audioEngine').onchange=e=>{stopPlay();stopChordPreview();releaseNative();outputMode=e.target.value;$('audioStatus').textContent=outputMode==='native'?'音声：音声ファイル方式（iPad向け）':'音声：Web Audio方式（未確認）';message('再生方式を変更しました。「中央のド」で確認してください。');};$('audioStatus').textContent=useNative()?'音声：音声ファイル方式（iPad向け）':'音声：未確認';
    $('metroToggle').onchange=e=>{st.metro=e.target.checked;checkpoint();};$('snapKey').onchange=e=>{st.snap=e.target.checked;checkpoint();};
    $('editorPlayAll').onclick=()=>startPlay('all');$('editorPlaySection').onclick=()=>startPlay('section');$('editorPlaySelected').onclick=()=>startPlay('selected');$('editorStop').onclick=()=>{stopPlay();stopChordPreview();};
    $('editorChordAll').onclick=()=>playEditorChords('all');$('editorChordSection').onclick=()=>playEditorChords('section');$('editorChordSelected').onclick=()=>playEditorChords('selected');
    $('playAll').onclick=()=>startPlay('all');$('playSection').onclick=()=>startPlay('section');$('playArrangement').onclick=()=>startPlay('all');$('playFromSelected').onclick=()=>startPlay('selected');$('playFromInspector').onclick=()=>startPlay('selected');$('stop').onclick=stopPlay;$('practiceMetro').onclick=()=>practice?stopPlay():startPlay('metro');
    $('addSection').onclick=addSection;$('duplicateSection').onclick=()=>sectionDuplicate(st.selectedSection);
    $('sectionList').onclick=e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const id=btn.closest('[data-id]')?.dataset.id;if(!id)return;switch(btn.dataset.action){case'select':selectSection(id);break;case'up':sectionReorder(id,-1);break;case'down':sectionReorder(id,1);break;case'copy':sectionDuplicate(id);break;case'delete':removeSection(id);break;}};
    $('lyricsInput').oninput=e=>updateSectionLyrics('lyrics',e.target.value);$('readingInput').oninput=e=>updateSectionLyrics('reading',e.target.value);$('lyricsInput').onchange=checkpoint;$('readingInput').onchange=checkpoint;
    $('suggestReading').onclick=autoRead;$('generateNotes').onclick=regenerate;
    $('keyRoot').onchange=e=>changeKey('root',e.target.value);$('keyMode').onchange=e=>changeKey('mode',e.target.value);$('transposeUp').onclick=()=>transpose(1);$('transposeDown').onclick=()=>transpose(-1);
    $('audioTest').onclick=()=>void auditionPitch(60,1.3,true);$('audioChordTest').onclick=()=>void previewChordSteps([{degree:1,quality:'maj',beats:2}],getSection());$('jumpC4').onclick=()=>{viewport.scrollTop=Math.max(0,worldY(60)-viewport.clientHeight/2);drawCanvas();void auditionPitch(60,.9,true);};$('addNote').onclick=()=>{const last=getNote(),offset=Math.max(0,roundBeat((viewport.scrollLeft+viewport.clientWidth/4-LEFT)/BEATPX())),start=last?last.start+last.dur:offset,pitch=last?last.pitch:60,n=newNote(start,pitch);if(n){viewport.scrollLeft=Math.max(0,LEFT+n.start*BEATPX()-viewport.clientWidth/3);viewport.scrollTop=Math.max(0,worldY(n.pitch)-viewport.clientHeight/2);resizeCanvas();void auditionPitch(n.pitch,.55);}};$('removeNote').onclick=()=>{if(!getNote())return message('先に削除する音をタップしてください。');deleteNote();};
    $('nudgePitchUp').onclick=()=>nudgeNote(1,0);$('nudgePitchDown').onclick=()=>nudgeNote(-1,0);$('nudgeBeatLeft').onclick=()=>nudgeNote(0,-st.grid);$('nudgeBeatRight').onclick=()=>nudgeNote(0,st.grid);$('notePitch').onchange=e=>changeNote('pitch',e.target.value);$('noteStart').onchange=e=>changeNote('start',e.target.value);$('noteDur').onchange=e=>changeNote('dur',e.target.value);$('deleteNote').onclick=deleteNote;$('playNote').onclick=playOne;
    $('gridStep').onchange=e=>{st.grid=NOTE_GRID_VALUES.includes(+e.target.value)?+e.target.value:.125;checkpoint();renderInspector();if(st.grid<=.125&&st.zoom<1.5)st.zoom=1.5;resizeCanvas();updateZoom();message(`細かさを ${st.grid}拍にしました。`,2000);};
    $('groupSelectMode').onclick=()=>{groupMode=!groupMode;groupIds.clear();marquee=null;autoPickMode=false;renderGroupStatus();drawCanvas();};
    $('clearGroup').onclick=clearGroup;$('deleteGroup').onclick=deleteGroup;
    $('groupNudgeLeft').onclick=()=>editGroup(0,-st.grid);$('groupNudgeRight').onclick=()=>editGroup(0,st.grid);$('groupNudgeUp').onclick=()=>editGroup(1,0);$('groupNudgeDown').onclick=()=>editGroup(-1,0);
    $('zoomOut').onclick=()=>changeZoom(-.25);$('zoomIn').onclick=()=>changeZoom(.25);$('pitchUp').onclick=()=>{viewport.scrollTop=Math.max(0,viewport.scrollTop-12*ROW);drawCanvas();};$('pitchDown').onclick=()=>{viewport.scrollTop+=12*ROW;drawCanvas();};$('jumpSelected').onclick=()=>{const n=getNote();if(!n)return message('グラフで音を選択してください。');viewport.scrollTop=Math.max(0,worldY(n.pitch)-viewport.clientHeight/2);viewport.scrollLeft=Math.max(0,LEFT+n.start*BEATPX()-viewport.clientWidth/3);drawCanvas();};$('undo').onclick=()=>restoreHistory(historyIndex-1);$('redo').onclick=()=>restoreHistory(historyIndex+1);
    $('arrangement').addEventListener('change',e=>{if(!e.target.matches('.gapCtrl input'))return;const s=st.sections.find(s=>s.id===e.target.closest('[data-id]')?.dataset.id);if(!s)return;s.gap=roundBeat(num(e.target.value,0,64));checkpoint();renderArrangement();});
    $('saveProject').onclick=exportProject;$('loadProject').onclick=()=>$('loadInput').click();$('loadInput').onchange=e=>{importProject(e.target.files?.[0]);e.target.value='';};$('exportWav').onclick=exportWav;$('exportMelodyStem').onclick=()=>exportStem('melody');$('exportChordStem').onclick=()=>exportStem('chords');$('exportMidi').onclick=exportMidi;$('exportVoice').onclick=()=>void exportForVoice();
    document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restoreHistory(historyIndex+(e.shiftKey?1:-1));}else if(e.key==='ArrowUp'&&getNote()){e.preventDefault();nudgeNote(1,0);}else if(e.key==='ArrowDown'&&getNote()){e.preventDefault();nudgeNote(-1,0);}else if(e.key==='ArrowLeft'&&getNote()){e.preventDefault();nudgeNote(0,-st.grid);}else if(e.key==='ArrowRight'&&getNote()){e.preventDefault();nudgeNote(0,st.grid);}else if(e.key===' '){e.preventDefault();playing?stopPlay():startPlay('section');}});
    window.addEventListener('resize',()=>resizeCanvas());document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlay();stopChordPreview();}});
  }
  function boot(){bindControls();bindCanvas();bindMoods();bindChordTimeline();let restored=false;try{const data=localStorage.getItem(LOCAL_KEY);if(data){loadData(JSON.parse(data));restored=true;}}catch(e){console.warn('Project restore unavailable',e);}if(!restored)initDemo();bindChords();bindAutoHarmony();history=[];historyIndex=-1;checkpoint();renderAll();setTimeout(()=>{viewport.scrollTop=Math.max(0,worldY(getNote()?.pitch||65)-viewport.clientHeight/2);drawCanvas();},75);$('saveStatus').textContent='端末に自動保存';if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
  boot();
})();
