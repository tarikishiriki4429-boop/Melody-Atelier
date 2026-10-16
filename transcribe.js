'use strict';
// Local, monophonic audio-to-notes helper. No uploads, models, or network requests.
(()=>{
 const $=id=>document.getElementById(id),input=$('transcribeInput'),button=$('transcribeButton'),status=$('transcribeStatus');
 if(!input||!button)return;
 button.onclick=()=>input.click();
 const reset=$('transcribeResetAdvanced');
 if(reset)reset.onclick=()=>{for(const [id,value] of [['transcribeSensitivity','0.012'],['transcribeConfidence','0.82'],['transcribeSmoothing','2'],['transcribePitchRange','wide']]){if($(id))$(id).value=value;}};

 input.onchange=async e=>{
  const file=e.target.files?.[0];input.value='';if(!file)return;
  if(file.size>45*1024*1024){status.textContent='45MB以下の音声を選んでください。';return;}
  button.disabled=true;status.textContent='端末内で音声を解析中…';await new Promise(r=>setTimeout(r,60));
  let context;
  try{
   context=new (window.AudioContext||window.webkitAudioContext)();
   const decoded=await context.decodeAudioData(await file.arrayBuffer());
   if(decoded.duration>120)throw Error('解析できる音声は最長2分です。短く切り出して読み込んでください。');
   const rate=11025,hop=512,size=2048,step=decoded.sampleRate/rate;
   const data=new Float32Array(Math.floor(decoded.length/step));
   const channels=decoded.numberOfChannels,source=Array.from({length:channels},(_,c)=>decoded.getChannelData(c));
   for(let i=0;i<data.length;i++){const idx=Math.floor(i*step);let v=0;for(const ch of source)v+=ch[idx]||0;data[i]=v/channels;}
   const frames=[];let lastMidi=null;
   const sensitivity=Number($('transcribeSensitivity')?.value)||.012;
   const confidence=Number($('transcribeConfidence')?.value)||.82;
   const smoothing=Math.max(0,Number($('transcribeSmoothing')?.value)||0);
   const range=$('transcribePitchRange')?.value||'wide';
   const bounds=range==='voice'?[48,84]:range==='low'?[36,72]:[36,96];
   for(let at=0;at+size<data.length;at+=hop){
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
