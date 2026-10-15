'use strict';
// Melody Atelier v0.7.1: local audio-to-notes + multitrack MIDI import.
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
    }
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
