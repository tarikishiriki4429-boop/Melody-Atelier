'use strict';
// Local, monophonic audio-to-notes helper. No uploads, models, or network requests.
(()=>{
 const $=id=>document.getElementById(id),input=$('transcribeInput'),button=$('transcribeButton'),status=$('transcribeStatus');
 if(!input||!button)return;
 button.onclick=()=>input.click();
 const reset=$('transcribeResetAdvanced');
 if(reset)reset.onclick=()=>{for(const [id,value] of [['transcribeSensitivity','0.012'],['transcribeConfidence','0.82'],['transcribeSmoothing','2'],['transcribePitchRange','wide']]){if($(id))$(id).value=value;}};

 async function decodeVideo(file,context){
  // Real-time extraction of the audio track via Web Audio. No server upload.
  const url=URL.createObjectURL(file),video=document.createElement('video');video.preload='auto';video.playsInline=true;video.src=url;
  let source,processor,quiet;
  try{
   await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('この動画形式はSafariで再生できません。'));});
   if(!Number.isFinite(video.duration)||video.duration>300)throw Error('動画は5分以下に切り出してください。');
   const chunks=[];let length=0;
   source=context.createMediaElementSource(video);processor=context.createScriptProcessor(2048,2,1);quiet=context.createGain();quiet.gain.value=0;
   processor.onaudioprocess=ev=>{const input=ev.inputBuffer,part=new Float32Array(input.length);for(let c=0;c<input.numberOfChannels;c++){const channel=input.getChannelData(c);for(let j=0;j<part.length;j++)part[j]+=channel[j]/input.numberOfChannels;}chunks.push(part);length+=part.length;};
   source.connect(processor);processor.connect(quiet);quiet.connect(context.destination);
   await context.resume();
   const ended=new Promise((resolve,reject)=>{video.onended=resolve;video.onerror=()=>reject(Error('動画の音声を抽出できませんでした。'));});
   await video.play();await ended;
   if(!length)throw Error('動画に読み取れる音声トラックがありません。');
   const data=new Float32Array(length);let at=0;for(const part of chunks){data.set(part,at);at+=part.length;}
   return {sampleRate:context.sampleRate,length,numberOfChannels:1,getChannelData:()=>data,duration:length/context.sampleRate};
  }finally{video.pause();video.removeAttribute('src');video.load();processor?.disconnect();source?.disconnect();quiet?.disconnect();URL.revokeObjectURL(url);}
 }
 input.onchange=async e=>{
  const file=e.target.files?.[0];input.value='';if(!file)return;
  if(file.size>250*1024*1024){status.textContent='250MB以下の音声・動画を選んでください。';return;}
  button.disabled=true;status.textContent='端末内で音声を解析中…';await new Promise(r=>setTimeout(r,60));
  let context;
  try{
   context=new (window.AudioContext||window.webkitAudioContext)();
   let decoded;
   const isVideo=file.type.startsWith('video/')||/\.(mp4|mov|webm|m4v)$/i.test(file.name);
   if(isVideo){status.textContent='動画の音声を端末内で抽出中…（動画の長さだけ時間がかかります）';decoded=await decodeVideo(file,context);}
   else decoded=await context.decodeAudioData(await file.arrayBuffer());
   const selectedMode=$('transcribeMode')?.value||'mono';
   const durationLimit=selectedMode==='poly'?180:600;
   if(decoded.duration>durationLimit)throw Error(selectedMode==='poly'?'和音読み取りは3分以下の音声にしてください。':'単音読み取りは10分以下の音声にしてください。');
   const rate=11025,hop=512,size=2048,step=decoded.sampleRate/rate;
   const data=new Float32Array(Math.floor(decoded.length/step));
   const channels=decoded.numberOfChannels,source=Array.from({length:channels},(_,c)=>decoded.getChannelData(c));
   for(let i=0;i<data.length;i++){const idx=Math.floor(i*step);let v=0;for(const ch of source)v+=ch[idx]||0;data[i]=v/channels;}
   const mode=selectedMode;
   if(mode==='poly'){
    status.textContent='倍音を考慮して複数の音程を推定中…';await new Promise(r=>setTimeout(r,25));
    if(!window.MelodyPolyphonic)throw Error('和音解析モジュールを読み込めませんでした。');
    const sensitivity=Number($('transcribeSensitivity')?.value)||.012;
    const range=$('transcribePitchRange')?.value||'wide';
    const bounds=range==='voice'?[48,84]:range==='low'?[36,72]:[36,96];
    const found=window.MelodyPolyphonic.read(data,rate,{low:bounds[0],high:bounds[1],voices:Number($('transcribeVoices')?.value)||3,threshold:sensitivity,minimum:Number($('transcribeMinimum')?.value)||.12});
    const bpm=Number($('bpm').value)||100,beatsPerSec=bpm/60,quant=Number($('transcribeGrid').value)||.125;
    const notes=found.map(n=>({pitch:n.pitch,start:Math.max(0,Math.round(n.start*beatsPerSec/quant)*quant),dur:Math.max(quant,Math.round(n.dur*beatsPerSec/quant)*quant)}));
    if(!notes.length)throw Error('和音の候補が見つかりませんでした。感度や音源を変えてください。');
    if(!window.MelodyAtelierImportNotes?.(notes))throw Error('追加を中止しました。');
    status.textContent=`実験的な和音解析で${notes.length}音を追加しました。倍音の誤検出や抜けがないか必ず確認してください。`;
    return;
   }
   const frames=[];let lastMidi=null;
   const sensitivity=Number($('transcribeSensitivity')?.value)||.012;
   const confidence=Number($('transcribeConfidence')?.value)||.82;
   const smoothing=Math.max(0,Number($('transcribeSmoothing')?.value)||0);
   const range=$('transcribePitchRange')?.value||'wide';
   const bounds=range==='voice'?[48,84]:range==='low'?[36,72]:[36,96];
   for(let at=0;at+size<data.length;at+=hop){
    if((Math.floor(at/hop)%96)===0){status.textContent='単音解析中… '+Math.min(100,Math.round(at/data.length*100))+'%';await new Promise(r=>setTimeout(r,0));}
    let rms=0;for(let j=0;j<size;j+=4)rms+=data[at+j]**2;rms=Math.sqrt(rms/(size/4));
    if(rms<sensitivity){frames.push(null);continue;}
    // Normalized difference autocorrelation. This is intentionally tuned for ONE pitched source.
    let bestLag=0,best=-1;const minLag=11,maxLag=147;
    for(let lag=minLag;lag<=maxLag;lag++){
     let cross=0,a=0,b=0;
     for(let j=0;j<size-lag;j+=3){const x=data[at+j],y=data[at+j+lag];cross+=x*y;a+=x*x;b+=y*y;}
     const score=cross/Math.sqrt(a*b+1e-12);
     if(score>best){best=score;bestLag=lag;}
    }
    if(best<confidence){frames.push(null);continue;}
    const midi=Math.round(69+12*Math.log2(rate/(bestLag*440)));
    if(midi<bounds[0]||midi>bounds[1]){frames.push(null);continue;}
    frames.push(midi);lastMidi=midi;
   }
   const bpm=Number($('bpm').value)||100,beatsPerSec=bpm/60,quant=Number($('transcribeGrid').value)||.125;
   const minimum=Number($('transcribeMinimum').value)||.12;
   // Median filter reduces short-lived harmonics and spurious pitch hops.
   const smooth=frames.map((v,i)=>{const group=frames.slice(Math.max(0,i-smoothing),i+smoothing+1).filter(x=>x!==null).sort((a,b)=>a-b);return smoothing>0&&group.length>=smoothing+1?group[Math.floor(group.length/2)]:v;});
   const notes=[];let current=null,start=0;
   function finish(end){if(current===null)return;const t=start*hop/rate,d=(end-start)*hop/rate;if(d>=minimum){const beat=Math.max(0,Math.round(t*beatsPerSec/quant)*quant),dur=Math.max(quant,Math.round(d*beatsPerSec/quant)*quant);notes.push({pitch:current,start:beat,dur});}}
   for(let i=0;i<=smooth.length;i++){const v=i<smooth.length?smooth[i]:null;if(v!==current){finish(i);current=v;start=i;}}
   if(!notes.length)throw Error('音符を検出できませんでした。単音の歌声・楽器音で試してください。');
   if(!window.MelodyAtelierImportNotes?.(notes))throw Error('追加を中止しました。');
   status.textContent=`${notes.length}音を現在のタブに追加しました。音程と長さを確認して修正してください。`;
  }catch(err){status.textContent='譜面化できません：'+err.message;}
  finally{button.disabled=false;try{await context?.close();}catch(_){}}
 };
})();
