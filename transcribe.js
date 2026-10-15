'use strict';
// Melody Atelier v0.7.2: audio-to-notes + multitrack MIDI + hybrid original audio playback.
// Add-on: no cloud upload, no third-party libraries, does not replace app.js.
(()=>{
  const $=id=>document.getElementById(id);
  const input=$('transcribeInput'),button=$('transcribeButton'),status=$('transcribeStatus');
  if(!input||!button)return;
  const safe=number=>Number.isFinite(number)?number:0;
  const fail=message=>{throw Error(message);};
  const pause=()=>new Promise(r=>setTimeout(r,0));
  const showError=(el,e,prefix='読み込みエラー')=>{el.textContent=prefix+'：'+(e?.message||String(e));};
  const toNum=(v,min,max)=>Math.max(min,Math.min(max,safe(v)));

  // These controls are appended to the existing local note-import row at boot.
  const panel=document.createElement('div');
  panel.className='externalNoteImport';
  panel.innerHTML=`
    <div class="externalNoteImportHeader"><b>♪ ファイルから編集できる音符を取り込む</b><small>すべてiPad内で解析・変換。インターネット送信なし。</small></div>
    <div class="externalNoteImportActions">
      <button type="button" id="midiImportButton" class="accent small">♫ MIDIを直接読み込み</button>
      <input type="file" id="midiImportInput" accept=".mid,.midi,audio/midi,audio/x-midi" hidden>
      <button type="button" id="waveBatchButton" class="outline small">♬ 単音WAVを複数読み込み</button>
      <input type="file" id="waveBatchInput" accept=".wav,audio/wav,audio/x-wav" multiple hidden>
      <label>追加先 <select id="externalImportMode"><option value="new">新しいブロック（推奨）</option><option value="tabs">現在のブロックに新規タブ</option></select></label>
      <label class="externalCheck"><input type="checkbox" id="externalImportTempo"> MIDIのBPMを曲全体に反映</label>
    </div>
    <div class="externalNoteImportStatus" id="externalImportStatus" role="status">MIDIは和音・複数トラックのまま読み込み。WAVは単音解析を改善。音声の完成曲から和音を正確に復元する機能ではありません。</div>`;
  input.closest('.transcribeRow')?.after(panel);
  const styles=document.createElement('style');
  styles.textContent=`.externalNoteImport{padding:13px 15px;border:1px solid #465773;background:#162337;border-radius:12px;margin:11px 0;display:grid;gap:10px;color:#edf2ff}.externalNoteImportHeader{display:flex;gap:8px 18px;flex-wrap:wrap;align-items:center}.externalNoteImportHeader small,.externalNoteImportStatus{font-size:12px;color:#a6d6cc}.externalNoteImportActions{display:flex;gap:8px 10px;align-items:center;flex-wrap:wrap}.externalNoteImportActions label{display:flex;align-items:center;gap:6px;font-size:12px}.externalNoteImportActions select{max-width:230px}.externalNoteImportActions .externalCheck input{min-width:17px;accent-color:#aa96ff}.externalNoteImportStatus{line-height:1.5;overflow-wrap:anywhere}`;
  document.head.append(styles);
  const otherStatus=$('externalImportStatus');

  // Small and portable Standard MIDI File reader; formats 0 and 1, PPQ ticks.
  function readMidi(buffer){
    const a=new Uint8Array(buffer),v=new DataView(buffer);let p=0;
    const need=n=>{if(n<0||p+n>a.length)fail('ファイルが途中で切れています。');};
    const u8=()=>{need(1);return a[p++];};
    const u16=()=>{need(2);const n=v.getUint16(p);p+=2;return n;};
    const u32=()=>{need(4);const n=v.getUint32(p);p+=4;return n;};
    const tag=()=>{need(4);const n=String.fromCharCode(...a.subarray(p,p+4));p+=4;return n;};
    const vlq=()=>{let x=0;for(let i=0;i<4;i++){const b=u8();x=x*128+(b&127);if(!(b&128))return x;}fail('時間情報が不正です。');};
    const decode=b=>{try{return new TextDecoder().decode(b);}catch{return Array.from(b).map(n=>String.fromCharCode(n)).join('');}};
    if(tag()!=='MThd')fail('MIDIファイルではありません。');
    const hlen=u32();if(hlen<6||hlen>1024)fail('MIDIヘッダーが不正です。');
    const format=u16(),count=u16(),division=u16();need(hlen-6);p+=hlen-6;
    if(format>1||count<1||count>64)fail('MIDI形式0・1、最大64トラックに対応しています。');
    if((division&32768)||division===0)fail('SMPTE方式のMIDI時間情報には未対応です。');
    const tempos=[{tick:0,us:500000}],trackData=[];
    for(let t=0;t<count;t++){
      if(tag()!=='MTrk')fail('MIDIトラックが見つかりません。');
      const len=u32(),end=p+len;if(end>a.length)fail('MIDIトラックが破損しています。');
      let tick=0,running=0,trackName='',notes=[],held=new Map();
      while(p<end){
        tick+=vlq();if(tick>division*4096)fail('4096拍を超えるMIDIは読み込めません。');
        let op=u8();if(op<128){if(!running)fail('MIDIのイベント形式が不正です。');p--;op=running;}
        else if(op<240)running=op;else running=0;
        if(op===255){
          const type=u8(),n=vlq();if(p+n>end)fail('MIDIメタ情報が破損しています。');
          const bytes=a.subarray(p,p+n);p+=n;
          if(type===3)trackName=decode(bytes).slice(0,28);
          if(type===81&&n===3){const us=bytes[0]*65536+bytes[1]*256+bytes[2];if(us>0)tempos.push({tick,us});}
          if(type===47)break;
          continue;
        }
        if(op===240||op===247){const n=vlq();if(p+n>end)fail('MIDI SysExの長さが不正です。');p+=n;continue;}
        if(op>=240)fail('未対応のMIDIイベントがあります。');
        const kind=op&240,channel=op&15,data=u8(),velocity=(kind===192||kind===208)?0:u8();
        if(kind===144&&velocity>0){const k=channel*128+data;if(!held.has(k))held.set(k,[]);held.get(k).push({tick,velocity});}
        else if(kind===128||(kind===144&&velocity===0)){
          const k=channel*128+data,q=held.get(k);
          if(q?.length){const first=q.shift();notes.push({pitch:data,channel,startTick:first.tick,endTick:Math.max(first.tick+1,tick),velocity:first.velocity});}
        }
      }
      for(const [k,q] of held)for(const first of q)notes.push({pitch:k%128,channel:Math.floor(k/128),startTick:first.tick,endTick:Math.max(first.tick+1,tick),velocity:first.velocity});
      p=end;trackData.push({name:trackName||`トラック${t+1}`,notes});
    }
    tempos.sort((x,y)=>x.tick-y.tick);const clock=[];
    for(const tempo of tempos){if(clock.length&&clock.at(-1).tick===tempo.tick)clock[clock.length-1]=tempo;else clock.push({...tempo});}
    let seconds=0;for(let i=0;i<clock.length;i++){if(i)seconds+=(clock[i].tick-clock[i-1].tick)*clock[i-1].us/(1e6*division);clock[i].seconds=seconds;}
    const at=tick=>{let left=0,right=clock.length-1;while(left<right){const middle=Math.ceil((left+right)/2);if(clock[middle].tick<=tick)left=middle;else right=middle-1;}const c=clock[left];return c.seconds+(tick-c.tick)*c.us/(1e6*division);};
    const tracks=[];
    for(const track of trackData){
      const channels=[...new Set(track.notes.map(n=>n.channel))].sort((x,y)=>x-y);
      for(const ch of channels){
        if(ch===9)continue; // General MIDI percussion is not pitched.
        const notes=track.notes.filter(n=>n.channel===ch).map(n=>({pitch:n.pitch,startSeconds:at(n.startTick),durationSeconds:Math.max(.02,at(n.endTick)-at(n.startTick)),velocity:n.velocity}));
        if(notes.length)tracks.push({name:track.name+(channels.length>1?` Ch${ch+1}`:''),notes});
      }
    }
    if(!tracks.length)fail('音程を持つMIDI音符がありません（ドラムのみの可能性があります）。');
    if(tracks.length>12)fail('13パート以上あります。12パート以内に分割してください。');
    if(tracks.some(t=>t.notes.length>500))fail('1パート500音までです。MIDIを短く分割してください。');
    const countNotes=tracks.reduce((n,t)=>n+t.notes.length,0);
    const bpm=Math.round(60000000/clock[0].us*100)/100;
    return {tracks,count:countNotes,bpm};
  }
  window.MelodyAtelierReadMidi=readMidi;

  // Use the existing note-import API and tab/section controls without modifying app.js.
  function withPromptName(control,name){
    const original=window.prompt;
    try{window.prompt=()=>String(name).slice(0,40);control.click();}
    finally{window.prompt=original;}
  }
  function importGroups(groups,{newBlock=false,bpm=null,followTempo=false,source='ファイル'}={}){
    if(!groups?.length)fail('追加できる音符がありません。');
    if(!window.MelodyAtelierImportNotes)fail('アプリ側の音符取り込み機能が見つかりません。ページを再読み込みしてください。');
    if(groups.length>12||groups.some(g=>g.notes.length>500))fail('12パート・各500音を超えています。');
    const tabCount=()=>$('melodyTabBar')?.querySelectorAll('button.melodyTab').length||0;
    if(!newBlock&&tabCount()+groups.length>12)fail('現在のブロックにタブを追加する空きがありません。新しいブロックを選択してください。');
    if(followTempo&&bpm&&Math.abs((+$('bpm').value||100)-bpm)>.01){
      if(!confirm(`MIDIのテンポ ${bpm} BPM に変更しますか？\n既存の全ブロックの再生速度も変わります。`))return false;
    }
    // Delay all state mutation until format and per-track limits are checked.
    if(newBlock){
      const oldCount=$('sectionList')?.querySelectorAll('.sectionCard').length||0;
      withPromptName($('addSection'),source.replace(/\.[^.]+$/,'').slice(0,40)||'MIDI音符');
      const newCount=$('sectionList')?.querySelectorAll('.sectionCard').length||0;
      if(newCount<=oldCount)return false;
    }
    if(followTempo&&bpm){const b=$('bpm');b.value=String(toNum(bpm,40,240));b.dispatchEvent(new Event('change',{bubbles:true}));}
    const beatsPerSecond=(+$('bpm').value||100)/60;
    const velAssignments=[];
    for(let gi=0;gi<groups.length;gi++){
      // A new block's first tab starts empty; otherwise always create a dedicated tab.
      if(!newBlock||gi>0)$('addMelodyTab')?.click();
      withPromptName($('renameMelodyTab'),groups[gi].name||`トラック${gi+1}`);
      const notes=groups[gi].notes.map(n=>({
        pitch:Math.round(n.pitch),
        start:Math.round(Math.max(0,n.startSeconds)*beatsPerSecond*10000)/10000,
        dur:Math.round(Math.max(.02,n.durationSeconds)*beatsPerSecond*10000)/10000
      })).filter(n=>n.pitch>=36&&n.pitch<=108&&n.start<=4096);
      if(!notes.length)continue;
      if(!window.MelodyAtelierImportNotes(notes))fail('音符を追加できませんでした。');
      const activeButton=$('melodyTabBar')?.querySelector('.melodyTab.active');
      const allButtons=Array.from($('melodyTabBar')?.querySelectorAll('.melodyTab')||[]);
      const tabIndex=allButtons.indexOf(activeButton);
      const sectionId=document.querySelector('.sectionCard.selected')?.dataset.id;
      if(sectionId&&tabIndex>=0)velAssignments.push({sectionId,tabIndex,notes:groups[gi].notes});
    }
    if(velAssignments.length)window.MelodyAtelierStoreMidiVelocity?.(velAssignments);
    return true;
  }

  // Audio analysis: dynamic volume floor + CMND/YIN fundamental estimation.
  const PITCH_RATE=11025;
  function midiNameNumber(name){
    const m=/(?:^|[_\-\s])([A-Ga-g])([#sb♯♭]?)(-?\d)(?=[_\-\s.]|$)/.exec(name);
    if(!m)return null;
    const map={C:0,D:2,E:4,F:5,G:7,A:9,B:11},alter= m[2]==='#'||m[2]==='s'||m[2]==='♯'?1:m[2]==='b'||m[2]==='♭'?-1:0;
    return (Number(m[3])+1)*12+map[m[1].toUpperCase()]+alter;
  }
  function fileStart(name){const m=/at(\d{1,9})ms/i.exec(name);return m?Number(m[1])/1000:null;}
  function fileHand(name){return /(?:^|[_\-])L(?:[_\-])/i.test(name)?'左手':/(?:^|[_\-])R(?:[_\-])/i.test(name)?'右手':'音声';}
  function makeMono(buffer){
    const step=buffer.sampleRate/PITCH_RATE,n=Math.floor(buffer.length/step),out=new Float32Array(n);
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for(let i=0;i<n;i++){
      const idx=Math.floor(i*step),fract=i*step-idx;let x=0;
      for(const c of channels)x+=(c[idx]||0)*(1-fract)+(c[idx+1]||0)*fract;
      out[i]=x/channels.length;
    }
    return out;
  }
  function frameEnergy(data,start,win=2048){let sum=0;for(let j=0;j<win;j+=4){const x=data[start+j]||0;sum+=x*x;}return Math.sqrt(sum/(win/4));}
  function yinPitch(data,start){
    const width=2048,min=8,max=210,step=4;
    const diff=new Float64Array(max+1),normalized=new Float64Array(max+1);let sum=0;
    for(let lag=1;lag<=max;lag++){
      let d=0;for(let j=0;j<width-max;j+=step){const delta=data[start+j]-data[start+j+lag];d+=delta*delta;}
      diff[lag]=d;sum+=d;normalized[lag]=d*lag/(sum+1e-12);
    }
    let lag=0,bestScore=Infinity;
    // Use the first strong LOCAL minimum, not the first below-threshold sample.
    for(let i=min;i<max;i++)if(normalized[i]<.22&&normalized[i]<=normalized[i-1]&&normalized[i]<=normalized[i+1]){lag=i;bestScore=normalized[i];break;}
    if(!lag)for(let i=min;i<=max;i++)if(normalized[i]<bestScore){bestScore=normalized[i];lag=i;}
    if(bestScore>.40||lag<min)return null;
    // Sub-sample parabolic lag interpolation prevents semitone mistakes at ~300-600 Hz.
    const left=diff[lag-1]??diff[lag],middle=diff[lag],right=diff[lag+1]??diff[lag];
    const denominator=left-2*middle+right;
    const correction=Math.abs(denominator)>1e-10?toNum(.5*(left-right)/denominator,-.5,.5):0;
    const freq=PITCH_RATE/(lag+correction),midi=Math.round(69+12*Math.log2(freq/440));
    return midi>=36&&midi<=108?midi:null;
  }
  async function analyzePCM(data,minimum=.12){
    const win=2048,hop=256;if(data.length<win)fail('音声が短すぎます。');
    const energies=[];for(let at=0;at+win<=data.length;at+=hop)energies.push(frameEnergy(data,at,win));
    const peak=Math.max(...energies),threshold=Math.max(.00006,peak*.016);
    if(peak<threshold*1.15)fail('音声に十分な音量がありません。');
    const values=[];let active=0;
    for(let i=0;i<energies.length;i++){
      const at=i*hop;
      if(energies[i]<threshold){values.push(null);continue;}
      const pitch=yinPitch(data,at);values.push(pitch);if(pitch!==null)active++;
      if(i%90===0)await pause();
    }
    const clean=values.map((v,i)=>{
      const neigh=values.slice(Math.max(0,i-2),i+3).filter(x=>x!==null).sort((a,b)=>a-b);
      return neigh.length>=3?neigh[Math.floor(neigh.length/2)]:v;
    });
    // Bridging a very short detection dropout avoids fragmented piano notes.
    for(let i=1;i<clean.length-1;i++)if(clean[i]===null&&clean[i-1]!==null&&clean[i-1]===clean[i+1])clean[i]=clean[i-1];
    let held=null,first=0;const notes=[];
    function finish(i){if(held===null)return;const start=first*hop/PITCH_RATE,dur=(i-first)*hop/PITCH_RATE;
      if(dur>=minimum)notes.push({pitch:held,startSeconds:start,durationSeconds:dur});}
    for(let i=0;i<=clean.length;i++){
      const v=i<clean.length?clean[i]:null;
      if(v!==held){finish(i);held=v;first=i;}
      else if(held!==null&&i>first+5&&i<clean.length&&energies[i]>energies[i-2]*1.9){finish(i);first=i;}
    }
    return {notes,peak,activeFrames:active};
  }
  window.MelodyAtelierAnalyzePCM=analyzePCM;
  async function decodeFile(file,context){
    if(file.size>45*1024*1024)fail('音声は1ファイル45MB以内にしてください。');
    const decoded=await context.decodeAudioData(await file.arrayBuffer());
    if(decoded.duration>120)fail('音声は120秒以内にしてください。');
    return makeMono(decoded);
  }
  async function wavNotes(file,context,{oneNote=false}={}){
    const data=await decodeFile(file,context),minimum=Number($('transcribeMinimum')?.value)||.12;
    // MIDI-like filenames (_D4_at01234ms) are authoritative about pitch & starting time.
    // Useful for exported individual stems even if their attack is too quiet to detect.
    const filenamePitch=midiNameNumber(file.name),filenameTime=fileStart(file.name);
    const {notes}=await analyzePCM(data,minimum).catch(e=>{
      if(filenamePitch!==null)return {notes:[]};throw e;
    });
    if(oneNote){
      if(filenamePitch!==null){
        const duration=notes.length?Math.max(.12,...notes.map(n=>n.durationSeconds)):.4;
        return [{pitch:filenamePitch,startSeconds:filenameTime??notes[0]?.startSeconds??0,durationSeconds:duration}];
      }
      if(!notes.length)fail('音程を検出できませんでした。音量・音色を確認してください。');
      const longest=notes.slice().sort((a,b)=>b.durationSeconds-a.durationSeconds)[0];
      return [{...longest,startSeconds:filenameTime??longest.startSeconds}];
    }
    if(!notes.length&&filenamePitch!==null)return [{pitch:filenamePitch,startSeconds:filenameTime??0,durationSeconds:.4}];
    return notes;
  }
  const newContext=()=>new (window.AudioContext||window.webkitAudioContext)();
  let locked=false;
  async function loadMidiFile(file){
    if(locked)return;locked=true;const btn=$('midiImportButton');btn.disabled=true;otherStatus.textContent='MIDIを読み取り中…';
    try{
      if(file.size>8*1024*1024)fail('MIDIは8MB以内にしてください。');
      const parsed=readMidi(await file.arrayBuffer()),mode=$('externalImportMode').value;
      const done=importGroups(parsed.tracks,{newBlock:mode==='new',bpm:parsed.bpm,followTempo:$('externalImportTempo').checked,source:file.name});
      otherStatus.textContent=done?`MIDI読み込み完了：${parsed.count}音・${parsed.tracks.length}タブ・元BPM ${parsed.bpm}。ピアノロールで編集できます。`:'読み込みを中止しました。';
    }catch(e){showError(otherStatus,e,'MIDI');}
    finally{locked=false;btn.disabled=false;}
  }
  async function loadWavFiles(files,batch=false){
    if(locked)return;locked=true;const btn=batch?$('waveBatchButton'):button;btn.disabled=true;
    const out=batch?otherStatus:status;out.textContent=`WAVを解析中（${files.length}ファイル）…`;
    let context;
    try{
      if(batch&&files.length>100)fail('一度に100ファイル以内にしてください。');
      context=newContext();
      if(batch){
        const sorted=files.slice().sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
        const grouped=new Map();let total=0;
        for(let i=0;i<sorted.length;i++){
          const file=sorted[i];out.textContent=`WAVを解析中 ${i+1}/${sorted.length}：${file.name}`;
          const candidates=await wavNotes(file,context,{oneNote:true}),key=fileHand(file.name);
          if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(...candidates);total+=candidates.length;
          await pause();
        }
        const groups=[...grouped].map(([name,notes])=>({name,notes}));
        const done=importGroups(groups,{newBlock:$('externalImportMode').value==='new',source:'単音WAV' });
        out.textContent=done?`単音WAV ${files.length}ファイルから${total}音を${groups.length}タブに配置しました。開始位置が分かるファイル名（at○○ms）ならその時間に配置します。`:'読み込みを中止しました。';
      }else{
        const notes=await wavNotes(files[0],context);
        if(!notes.length)fail('音符を検出できませんでした。音量や録音状態を確認してください。');
        // Preserve existing v0.7.0 workflow: add to selected tab with confirmation.
        const beat=(Number($('bpm').value)||100)/60,quant=Number($('transcribeGrid')?.value)||.125;
        const converted=notes.map(n=>({pitch:n.pitch,start:Math.max(0,Math.round(n.startSeconds*beat/quant)*quant),dur:Math.max(quant,Math.round(n.durationSeconds*beat/quant)*quant)}));
        if(!window.MelodyAtelierImportNotes?.(converted))fail('読み込みを中止しました。');
        out.textContent=`音声から${converted.length}音を現在のタブに追加しました（単音推定）。音程と長さを確認してください。`;
      }
    }catch(e){showError(out,e,'譜面化');}
    finally{btn.disabled=false;locked=false;try{await context?.close();}catch{}}
  }
  button.onclick=()=>input.click();
  input.onchange=e=>{const file=e.target.files?.[0];input.value='';if(file)void loadWavFiles([file]);};
  $('midiImportButton').onclick=()=>$('midiImportInput').click();
  $('midiImportInput').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)void loadMidiFile(file);};
  $('waveBatchButton').onclick=()=>$('waveBatchInput').click();
  $('waveBatchInput').onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)void loadWavFiles(files,true);};
})();


'use strict';
// Melody Atelier v0.7.2: optional, non-destructive local audio/notation hybrid playback.
// All recordings stay in browser IndexedDB; no network transport or third-party libraries.
(()=>{
 const $=id=>document.getElementById(id),STORE='melody-atelier-hybrid-v072',VELKEY='melody-atelier-velocities-v1';
 const importPanel=document.querySelector('.externalNoteImport');if(!importPanel)return;
 const css=document.createElement('style');css.textContent=`
 .hybridPanel{padding:16px;border:1px solid #56728c;border-radius:13px;background:#162436;display:grid;gap:12px;margin:14px 0;color:#f1f2ff}
 .hybridTop{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}.hybridTop strong{font-size:15px}
 .hybridRow{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap}.hybridRow label{font-size:12px;display:flex;align-items:center;gap:5px}
 .hybridPanel button{font-size:12px}.hybridPanel small,.hybridHint{font-size:12px;color:#b6cbd1;line-height:1.7}
 .hybridPanel select{max-width:240px}.hybridPanel input[type=number]{width:85px}.hybridPanel input[type=range]{min-width:110px;max-width:180px}
 .hybridTracks{display:grid;gap:9px}.hybridClip{padding:10px;border:1px solid #435778;border-radius:9px;display:grid;gap:7px}
 .hybridClip strong{overflow-wrap:anywhere;font-size:12px}.hybridClip canvas{display:block;max-width:100%;width:100%;height:60px;background:#0e1523;border-radius:5px}
 .hybridMeter{color:#93dcd0;font-size:12px}.hybridDanger{color:#ffc5c5}.hybridTransport button{background:#31564f;color:white;border:1px solid #63ae9f}
 .hybridPanel .hybridSelected{color:#ead5a5;font-size:12px}.hybridVel{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
 `;document.head.append(css);
 const panel=document.createElement('section');panel.className='hybridPanel';panel.setAttribute('aria-label','録音と譜面のハイブリッド編集');
 panel.innerHTML=`
 <div class="hybridTop"><strong>🎹 原音を残す・高音質ハイブリッド編集 <small>v0.7.2</small></strong><span class="hybridMeter">非破壊・端末内保存</span></div>
 <div class="hybridRow"><button type="button" class="accent small" id="hybridPick">＋ 元の録音を登録（WAV / MP3 / M4A）</button><input id="hybridInput" type="file" accept="audio/*,.wav,.mp3,.m4a,.aac" multiple hidden><button id="hybridRefresh" type="button" class="outline small">♻ 曲のブロックを更新</button></div>
 <div class="hybridRow"><label>録音を重ねるブロック <select id="hybridSection"></select></label><label>試聴 <select id="hybridMode"><option value="normal">従来どおり</option><option value="original">原音を優先（編集音なし）</option><option value="enhanced">強弱つきピアノのみ</option><option value="mix" selected>原音＋編集ピアノ</option></select></label><label>編集音の音量 <input type="range" id="hybridSynthGain" min="0" max="100" value="30"><output id="hybridSynthOut">30%</output></label></div>
 <div class="hybridRow hybridTransport"><button id="hybridPlay" type="button">▶ ハイブリッド再生</button><button id="hybridStop" type="button" class="outline small">■ 停止</button><button id="hybridExport" type="button" class="outline small">↓ ミックスWAVを書き出す</button><span class="hybridHint" id="hybridStatus" role="status">原音は元ファイルのまま保持。複数の音を重ねて再生できます。</span></div>
 <div class="hybridTracks" id="hybridTracks"></div>
 <div class="hybridVel"><span class="hybridSelected">選択音の強さ（ベロシティ）</span><input type="range" id="hybridVelocity" min="1" max="127" value="90"><output id="hybridVelocityOut">90 / 127</output><button type="button" id="hybridVelocityApply" class="outline small">選択音に反映</button></div>
 <p class="hybridHint">※「原音＋編集ピアノ」は元の演奏と合成音が二重になることがあります。割合を調整してください。録音から和音を完全に分離・個別編集する機能ではありません。録音はこの端末のIndexedDBに保存されますが、通常のプロジェクトJSONには音声本体を含みません。削除・別端末への移行時は元音声も別途保管してください。</p>`;
 importPanel.after(panel);
 const status=$('hybridStatus');let tracks=[],db=null,current=null,currentUrl='',decoded=new Map(),velocity={};
 try{velocity=JSON.parse(localStorage.getItem(VELKEY)||'{}')||{};}catch{velocity={};}
 const saveVel=()=>{try{localStorage.setItem(VELKEY,JSON.stringify(velocity));}catch(e){status.textContent='音の強弱を保存できません。保存容量を確認してください。';}};
 const wait=()=>new Promise(r=>setTimeout(r,0));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
 const safeText=s=>String(s||'').slice(0,120);
 const newId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'clip'+Date.now()+'-'+Math.floor(Math.random()*1e6);
 async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=()=>{r.result.createObjectStore('clips',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 function txn(mode,run){return new Promise((resolve,reject)=>{if(!db)return reject(Error('音声保存領域を開けません。'));const tx=db.transaction('clips',mode),store=tx.objectStore('clips');let result;try{result=run(store);}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function listDB(){return new Promise((resolve,reject)=>{const tx=db.transaction('clips','readonly'),r=tx.objectStore('clips').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function storeClip(clip){return txn('readwrite',store=>{store.put(clip);});}
 async function removeClip(id){return txn('readwrite',store=>{store.delete(id);});}
 const project=()=>{try{return JSON.parse(localStorage.getItem('melody-atelier-project-v1')||'null');}catch{return null;}};
 function sections(){return project()?.sections||[];}
 function activeId(){return document.querySelector('.sectionCard.selected')?.dataset.id||project()?.selectedSection||sections()[0]?.id;}
 function refreshSections(){const ss=sections(),before=$('hybridSection').value||activeId();$('hybridSection').replaceChildren();ss.forEach(s=>{const option=new Option(s.name||'ブロック',s.id);$('hybridSection').add(option);});$('hybridSection').value=ss.some(s=>s.id===before)?before:(ss.some(s=>s.id===activeId())?activeId():ss[0]?.id||'');renderTracks();}
 function effectiveNotes(s){const ts=s.melodyTabs||[{notes:s.notes||[]}];return ts.flatMap(t=>t.notes||[]);}
 function sectionLength(s,beats){const n=effectiveNotes(s),noteEnd=n.length?Math.max(...n.map(x=>Number(x.start||0)+Number(x.dur||0))):0;
   const chordEnd=Array.isArray(s.chordClips)?Math.max(0,...s.chordClips.map(x=>(+x.start||0)+(+x.beats||0))):(s.chords||[]).reduce((sum,c)=>sum+(+c.beats||0),0);
   const harm=Math.max(0,...(s.harmonies||[]).map(h=>(+h.start||0)+(+h.beats||0)));
   const size=Math.max(noteEnd,chordEnd,harm,Number(s.manualBeats)||0);
   return size?Math.ceil(size/beats)*beats:0;
 }
 function timeline(){const p=project();if(!p)return {bpm:100,blocks:[],total:0};const bpm=clamp(Number($('bpm')?.value)||p.bpm||100,40,240),beats=Number(p.beats)||4;let beat=0;const blocks=[];
   for(const s of p.sections){const len=sectionLength(s,beats);blocks.push({id:s.id,section:s,start:beat,end:beat+len,notes:effectiveNotes(s)});beat+=len+(len?Number(s.gap)||0:0);}
   return {bpm,blocks,total:beat};
 }
 function makeWave(canvas,data){const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||480,h=canvas.clientHeight||60;canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));const g=canvas.getContext('2d');g.scale(dpr,dpr);g.clearRect(0,0,w,h);g.strokeStyle='#70c7b9';g.lineWidth=1;g.beginPath();const samples=data.getChannelData(0),size=samples.length/w;
   for(let x=0;x<w;x++){const a=Math.floor(x*size),b=Math.max(a+1,Math.floor((x+1)*size)),stride=Math.max(1,Math.floor((b-a)/48));let min=1,max=-1;for(let i=a;i<b;i+=stride){const y=samples[i];min=Math.min(min,y);max=Math.max(max,y);}g.moveTo(x,h/2-max*(h*.45));g.lineTo(x,h/2-min*(h*.45));}g.stroke();}
 async function context(){const ctor=window.AudioContext||window.webkitAudioContext;if(!ctor)throw Error('Safariの音声デコーダーが利用できません。');return new ctor();}
 async function decode(blob,id){if(decoded.has(id))return decoded.get(id);const c=await context();try{const a=await c.decodeAudioData(await blob.arrayBuffer());if(a.duration>180)throw Error('録音は1ファイル3分以内にしてください。');decoded.set(id,a);return a;}finally{await c.close().catch(()=>{});}}
 function renderTracks(){const box=$('hybridTracks');box.replaceChildren();const sectionId=$('hybridSection').value;const tt=tracks.filter(t=>t.sectionId===sectionId);if(!tt.length){const small=document.createElement('small');small.textContent='このブロックに原音はありません。元のWAV・MP3を登録すると波形を表示します。';box.append(small);return;}
   for(const t of tt){const div=document.createElement('div');div.className='hybridClip';
     const strong=document.createElement('strong');strong.textContent=t.name;div.append(strong);
     const cv=document.createElement('canvas');cv.setAttribute('aria-label','録音の波形');div.append(cv);if(decoded.has(t.id))requestAnimationFrame(()=>makeWave(cv,decoded.get(t.id)));
     const controls=document.createElement('div');controls.className='hybridRow';controls.innerHTML='<label>開始ずらし（秒） <input type="number" min="-30" max="180" step="0.01" data-key="offset"></label><label>音量 <input type="range" min="0" max="150" data-key="gain"></label><label>ミュート <input type="checkbox" data-key="mute"></label><label>原音の開始秒 <input type="number" min="0" step="0.01" data-key="trimStart"></label><label>終了秒（0は最後まで） <input type="number" min="0" step="0.01" data-key="trimEnd"></label><label>分割位置（秒） <input type="number" min="0" step="0.01" data-key="splitAt"></label><button type="button" class="outline small" data-act="split">✂ 時間で分割</button><button type="button" class="outline small" data-act="play">▶ 原音だけ</button><button type="button" class="outline small" data-act="export">↓ 元ファイルを保存</button><button type="button" class="outline small hybridDanger" data-act="delete">削除</button>';
     const off=controls.querySelector('[data-key=offset]'),gain=controls.querySelector('[data-key=gain]'),mute=controls.querySelector('[data-key=mute]');off.value=t.offset;gain.value=Math.round(t.gain*100);mute.checked=!!t.mute;
     const cutStart=controls.querySelector('[data-key=trimStart]'),cutEnd=controls.querySelector('[data-key=trimEnd]'),splitAt=controls.querySelector('[data-key=splitAt]');
     cutStart.value=t.trimStart||0;cutEnd.value=t.trimEnd||0;splitAt.value=+(Number(t.trimStart||0)+(Number(t.trimEnd||decoded.get(t.id)?.duration||2)-Number(t.trimStart||0))/2).toFixed(2);
     const modify=(key,value)=>{t[key]=value;storeClip(t).catch(e=>status.textContent='保存できません：'+e.message);};off.onchange=()=>modify('offset',clamp(+off.value,-30,180));gain.oninput=()=>{t.gain=clamp(+gain.value/100,0,1.5);};gain.onchange=()=>modify('gain',t.gain);mute.onchange=()=>modify('mute',mute.checked);
     cutStart.onchange=()=>{const dur=decoded.get(t.id)?.duration||180;modify('trimStart',clamp(+cutStart.value,0,dur));};
     cutEnd.onchange=()=>{const dur=decoded.get(t.id)?.duration||180;modify('trimEnd',clamp(+cutEnd.value,0,dur));};
     controls.querySelector('[data-act=split]').onclick=async()=>{try{
       if(tracks.length>=14)throw Error('原音は14クリップまでです。');
       const d=await decode(t.blob,t.id),start=clamp(Number(t.trimStart)||0,0,d.duration),end=clamp(Number(t.trimEnd)||d.duration,0,d.duration),cut=clamp(+splitAt.value,0,d.duration);
       if(cut<=start+.04||cut>=end-.04)throw Error('分割位置は開始秒と終了秒の間にしてください。');
       const newer={...t,id:newId(),name:t.name+'（後半）',trimStart:cut,trimEnd:end};
       t.trimEnd=cut;await storeClip(t);await storeClip(newer);tracks.push(newer);decoded.set(newer.id,d);renderTracks();status.textContent='原音を時間で2つに分割しました。各区間の開始位置と音量を別々に編集できます。';
     }catch(e){status.textContent='分割できません：'+e.message;}};
     controls.querySelector('[data-act=play]').onclick=()=>void playRaw(t);
     controls.querySelector('[data-act=export]').onclick=()=>{const u=URL.createObjectURL(t.blob),a=document.createElement('a');a.href=u;a.download=t.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),12000);};
     controls.querySelector('[data-act=delete]').onclick=async()=>{if(!confirm('この原音トラックを削除しますか？ 譜面は変更されません。'))return;stop();decoded.delete(t.id);await removeClip(t.id);tracks=tracks.filter(x=>x.id!==t.id);renderTracks();};
     div.append(controls);box.append(div);
     if(!decoded.has(t.id))decode(t.blob,t.id).then(a=>{if(cv.isConnected)makeWave(cv,a);}).catch(e=>{status.textContent='波形生成：'+e.message;});
   }
 }
 function stop(){if(current){current.pause();current.removeAttribute('src');current.load();current=null;}if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl='';}const appStop=$('stop');if(appStop)appStop.click();}
 async function playRaw(t){stop();current=new Audio();currentUrl=URL.createObjectURL(t.blob);current.src=currentUrl;current.volume=clamp(t.gain,0,1);
   const d=await decode(t.blob,t.id),start=clamp(Number(t.trimStart)||0,0,d.duration),end=clamp(Number(t.trimEnd)||d.duration,start,d.duration);
   current.onloadedmetadata=()=>{current.currentTime=start;};
   current.ontimeupdate=()=>{if(current&&current.currentTime>=end)current.pause();};
   try{await current.play();status.textContent='原音をそのまま再生中（音符合成なし）';}catch(e){status.textContent='Safariで音声再生が拒否されました。もう一度「▶ 原音だけ」を押してください：'+e.message;}}
 function getScope(target){const t=timeline(),kind=target==='playAll'||target==='playArrangement'||target==='hybridPlay'||target==='hybridExport'?'all':target==='playSection'?'section':target==='playFromSelected'||target==='playFromInspector'?'selected':'all';const selected=activeId(),section=t.blocks.find(b=>b.id===selected);
   const beatPerSec=60/t.bpm;let start=0,end=t.total*beatPerSec;
   if(kind==='section'&&section){start=section.start*beatPerSec;end=section.end*beatPerSec;}
   if(kind==='selected'&&section){start=(section.start+Number($('noteStart')?.value||0))*beatPerSec;end=t.total*beatPerSec;}
   return {timeline:t,start,end,kind};
 }
 function selectedVelocityTarget(){const p=project(),s=p?.sections?.find(s=>s.id===activeId());if(!s)return null;const active=s.melodyTabs?.find(t=>t.id===s.activeMelodyTab),notes=active?.notes||s.notes||[];const pitch=+$('notePitch')?.value,pos=+$('noteStart')?.value,dur=+$('noteDur')?.value;if(!Number.isFinite(pitch)||!Number.isFinite(pos))return null;
   let best=null,score=Infinity;for(const n of notes){const v=Math.abs(n.pitch-pitch)*100+Math.abs(n.start-pos)+Math.abs(n.dur-dur)*.1;if(v<score){best=n;score=v;}}return score<.05?best:null;
 }
 function refreshVelocityUI(){const n=selectedVelocityTarget();const v=n?clamp(Number(velocity[n.id]??85),1,127):85;$('hybridVelocity').value=String(v);$('hybridVelocityOut').textContent=(n?'選択音 '+v:'未選択 '+v)+' / 127';}
 $('hybridVelocityApply').onclick=()=>{const n=selectedVelocityTarget();if(!n)return status.textContent='グラフの音符を選択してから「選択音に反映」を押してください。';velocity[n.id]=+$('hybridVelocity').value;saveVel();refreshVelocityUI();status.textContent='選択した音の強さを保存しました（ハイブリッド再生に反映）。';};
 $('hybridVelocity').oninput=()=>{$('hybridVelocityOut').textContent=$('hybridVelocity').value+' / 127';};
 $('melodyCanvas')?.addEventListener('pointerup',()=>setTimeout(refreshVelocityUI,30));
 $('notePitch')?.addEventListener('change',()=>setTimeout(refreshVelocityUI,30));
 $('hybridRefresh').onclick=()=>refreshSections();
 // Called by the v0.7.2 MIDI import hook; synchronize native note IDs with imported velocities.
 window.MelodyAtelierStoreMidiVelocity=assignments=>{
   setTimeout(()=>{const p=project();for(const entry of assignments){const s=p?.sections?.find(s=>s.id===entry.sectionId);const tab=s?.melodyTabs?.[entry.tabIndex];if(!tab)continue;const imported=(tab.notes||[]).slice(-entry.notes.length);for(let i=0;i<imported.length;i++){if(Number.isFinite(entry.notes[i]?.velocity))velocity[imported[i].id]=clamp(entry.notes[i].velocity,1,127);}}
     saveVel();refreshVelocityUI();status.textContent='MIDIの打鍵強度（ベロシティ）を読み込みました。';},850);
 };
 async function renderMix(scope,mode){const {timeline:t,start,end}=scope,bpm=t.bpm,beatSec=60/bpm,chosen=tracks.filter(x=>!x.mute&&x.blob);
   const sourceData=new Map();if(mode==='original'||mode==='mix')for(const track of chosen)sourceData.set(track.id,await decode(track.blob,track.id));
   let fullSec=Math.max(end,...chosen.map(c=>{const d=sourceData.get(c.id);const b=t.blocks.find(x=>x.id===c.sectionId);return (b?b.start*beatSec:0)+c.offset+(Number(c.trimEnd)||d?.duration||0);}),0);
   if(scope.kind==='all')fullSec=Math.max(fullSec,end);
   const to=start,finish=scope.kind==='all'?fullSec:end;const duration=finish-to;if(duration<=0)throw Error('再生範囲に音がありません。');if(duration>105)throw Error('ミックス再生・書き出しは一度に105秒以内。ブロックを分割してください。');
   const rate=44100,frames=Math.ceil((duration+.6)*rate),left=new Float32Array(frames),right=new Float32Array(frames);
   if(mode==='original'||mode==='mix'){
     for(const clip of chosen){const a=sourceData.get(clip.id),block=t.blocks.find(x=>x.id===clip.sectionId),trimStart=clamp(Number(clip.trimStart)||0,0,a.duration),trimEnd=clamp(Number(clip.trimEnd)||a.duration,trimStart,a.duration),begin=(block?block.start*beatSec:0)+clip.offset+trimStart-to,d=Array.from({length:a.numberOfChannels},(_,i)=>a.getChannelData(i));
       let first=Math.max(0,Math.floor(begin*rate)),last=Math.min(frames,Math.floor((begin+trimEnd-trimStart)*rate));
       for(let i=first;i<last;i++){const offset=(i/rate-begin+trimStart)*a.sampleRate,ix=Math.floor(offset),fract=offset-ix;if(ix<0||ix+1>=a.length)continue;const time=offset/a.sampleRate,fadeIn=trimStart>0?clamp((time-trimStart)/.008,0,1):1,fadeOut=trimEnd<a.duration?clamp((trimEnd-time)/.008,0,1):1,w=fadeIn*fadeOut*clip.gain;
         const l=(d[0][ix]*(1-fract)+d[0][ix+1]*fract)*w,r=d[1]?(d[1][ix]*(1-fract)+d[1][ix+1]*fract)*w:l;left[i]+=l;right[i]+=r;}
       await wait();
     }
   }
   if(mode==='mix'||mode==='enhanced'){
     let notes=[];for(const b of t.blocks){for(const n of b.notes)notes.push({...n,startSec:(b.start+n.start)*beatSec-to,seconds:n.dur*beatSec});}
     if($('tabPlaybackMode')?.value==='solo'&&scope.kind!=='all'){
       const p=project(),active=p?.sections?.find(s=>s.id===activeId());notes=notes.filter(n=>{if(n.startSec<0)return true;return (active?.melodyTabs?.find(tab=>tab.id===active.activeMelodyTab)?.notes||[]).some(x=>x.id===n.id);});
     }
     const maxNote=notes.length;if(maxNote>750)throw Error('一度のミックスは750音以内にしてください。');const gain=clamp(Number($('hybridSynthGain').value)/100,0,1),volume=clamp(Number($('masterVolume')?.value||80)/100,0,1);
     for(let k=0;k<notes.length;k++){
       const n=notes[k],dur=clamp(+n.seconds,.035,32),start=Math.round(n.startSec*rate),hz=440*Math.pow(2,(n.pitch-69)/12);if(hz<50||hz>3600)continue;
       const v=clamp(Number(velocity[n.id]??n.velocity??85),1,127)/127,amp=volume*gain*(.28+.72*v*v)*.22,release=.48+v*.26,limit=Math.ceil((dur+release)*rate);
       const notesPhase=[1,2,3,4,5,6].map(x=>2*Math.PI*hz*x/rate),det=2*Math.PI*hz*1.0007/rate;
       const pweights=[.55,.19*v,.10*v,.048*v,.017*v,.009*v];
       let ph=[0,0,0,0,0,0],phaseDet=0;for(let j=Math.max(0,-start);j<limit&&j+start<frames;j++){
         const idx=start+j,sec=j/rate,attack=1-Math.exp(-sec/(.003+.006*(1-v))),body=Math.exp(-sec/(2.5+.9*v)),rel=sec<=dur?1:Math.exp(-(sec-dur)/(release*.34)),env=attack*body*rel;
         let val=0;for(let h=0;h<6;h++){ph[h]+=notesPhase[h];val+=Math.sin(ph[h])*pweights[h]*Math.exp(-sec*(h*.18));}
         phaseDet+=det;val+=.25*Math.sin(phaseDet);val*=amp*env;
         left[idx]+=val*.99;right[idx]+=val*1.01;
       }
       if(k%5===0){status.textContent=`音を合成中 ${k+1}/${notes.length}`;await wait();}
     }
     // Very subtle single-delay room tail; transparent enough for piano phrase.
     const gap=Math.floor(.094*rate),feedback=.045*gain;
     for(let i=gap;i<frames;i++){left[i]+=right[i-gap]*feedback;right[i]+=left[i-gap]*feedback;if(i%420000===0)await wait();}
   }
   let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const scale=peak>.98?.98/peak:1;
   const bytes=new ArrayBuffer(44+frames*4),dv=new DataView(bytes),put=(pos,s)=>{for(let j=0;j<s.length;j++)dv.setUint8(pos+j,s.charCodeAt(j));};put(0,'RIFF');dv.setUint32(4,36+frames*4,true);put(8,'WAVE');put(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,rate,true);dv.setUint32(28,rate*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);put(36,'data');dv.setUint32(40,frames*4,true);
   for(let i=0;i<frames;i++){dv.setInt16(44+4*i,clamp(left[i]*scale,-1,1)*32767,true);dv.setInt16(46+4*i,clamp(right[i]*scale,-1,1)*32767,true);}
   return new Blob([bytes],{type:'audio/wav'});
 }
 let playBusy=false;
 async function play(mode,scopeName='hybridPlay',exportOnly=false){if(playBusy)return;playBusy=true;const button=$('hybridPlay');button.disabled=true;try{
   stop();const scope=getScope(scopeName),t=tracks.filter(c=>!c.mute);if((mode==='original'||mode==='mix')&&!t.length){if(mode==='original')throw Error('まず元音源を追加してください。');status.textContent='原音未登録のため、編集ピアノだけを鳴らします。';mode='enhanced';}
   // Full-fidelity passthrough: one original clip aligned at the beginning of a section.
   if(!exportOnly&&mode==='original'&&t.length===1&&scope.kind==='all'&&t[0].offset===0&&scope.timeline.blocks.find(b=>b.id===t[0].sectionId)?.start===0){await playRaw(t[0]);return;}
   status.textContent='原音と音符を準備しています…';const result=await renderMix(scope,mode);
   const name='MelodyAtelier-'+mode+'-'+Date.now()+'.wav';if(exportOnly){const url=URL.createObjectURL(result),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);status.textContent='ミックスWAVを書き出しました。元音声と譜面は変更していません。';}
   else{current=new Audio();currentUrl=URL.createObjectURL(result);current.src=currentUrl;current.onended=()=>{status.textContent='再生が完了しました。';};try{await current.play();status.textContent='▶ '+(mode==='original'?'原音':mode==='enhanced'?'強弱つきピアノ':'原音＋編集ピアノ')+' を再生中';}catch(e){status.textContent='音声の自動再生が許可されませんでした。「▶ ハイブリッド再生」をもう一度押してください。';}}
 }catch(e){status.textContent='処理できません：'+e.message;}finally{playBusy=false;button.disabled=false;}}
 $('hybridPlay').onclick=()=>void play($('hybridMode').value==='normal'?'enhanced':$('hybridMode').value);
 $('hybridStop').onclick=stop;
 $('hybridExport').onclick=()=>void play($('hybridMode').value==='normal'?'enhanced':$('hybridMode').value,'hybridExport',true);
 $('hybridSynthGain').oninput=()=>$('hybridSynthOut').textContent=$('hybridSynthGain').value+'%';
 $('hybridSection').onchange=renderTracks;
 $('hybridPick').onclick=()=>$('hybridInput').click();
 $('hybridInput').onchange=async e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;try{if(!db)throw Error('このブラウザーで音声保存領域を開けません。');if(tracks.length+files.length>14)throw Error('原音は合計14ファイルまでです。');for(const f of files){if(f.size>35*1024*1024)throw Error('1ファイル35MB以下にしてください。');const clip={id:newId(),sectionId:$('hybridSection').value,name:safeText(f.name),blob:f,offset:0,gain:1,mute:false};const a=await decode(f,clip.id);await storeClip(clip);tracks.push(clip);status.textContent=`原音を保存しました：${f.name}（${a.duration.toFixed(1)}秒）`;}
   renderTracks();}catch(err){status.textContent='原音の読み込みに失敗：'+err.message;}};
 // Keyboard & transport buttons only override playback in one of the explicit hybrid modes.
 for(const id of ['playAll','playSection','playFromSelected','playFromInspector','playArrangement'])$(id)?.addEventListener('click',e=>{
   const mode=$('hybridMode').value;if(mode==='normal')return;e.preventDefault();e.stopImmediatePropagation();void play(mode,id);
 },true);
 $('stop')?.addEventListener('click',()=>{if(current){current.pause();current=null;}if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl='';}},true);
 // For imported notes, the original app currently keeps only pitch/start/duration.
 // The external MIDI parser captures velocities using imported active tab positions.
 (async()=>{try{db=await openDB();tracks=await listDB();status.textContent=`原音 ${tracks.length}ファイルを端末から復元しました。`;refreshSections();}catch(e){status.textContent='原音の永続保存を利用できません：'+e.message+'。Safariの通常モードで開いてください。';}})();
})();
