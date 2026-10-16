// Record the microphone while the existing song is playing, then transcribe locally.
'use strict';
(()=>{
 const $=id=>document.getElementById(id),start=$('recordWithSong'),stop=$('stopRecordWithSong'),status=$('liveRecordStatus');
 if(!start||!stop)return;
 let recorder=null,stream=null,chunks=[],busy=false,recordingTarget=null,recordingStart=0;
 const cleanup=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;busy=false;start.disabled=false;stop.disabled=true;};
 start.onclick=async()=>{
  if(busy)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='このブラウザはマイク録音に対応していません。';return;}
  busy=true;start.disabled=true;chunks=[];
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
   recordingTarget={section:$('sectionSelect')?.value||null,tab:document.querySelector('.melodyTab.active')?.dataset?.tabId||null};
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=e=>{status.textContent='録音エラーが発生しました。';cleanup();};
   recorder.onstop=async()=>{
    const blob=new Blob(chunks,{type:recorder?.mimeType||'audio/mp4'});cleanup();
    if(blob.size<1024){status.textContent='録音が短すぎます。';return;}
    if(!confirm('録音を解析して、今開いているメロディータブに音符を追加しますか？')){status.textContent='録音を破棄しました。';return;}
    const file=new File([blob],'live-record.'+(blob.type.includes('webm')?'webm':'m4a'),{type:blob.type});
    status.textContent='録音を譜面化しています…';
    try{await window.MelodyAtelierTranscribeFile(file);status.textContent='解析が完了しました。読み取り結果と音程を確認してください。';}
    catch(e){status.textContent='解析できません：'+e.message;}
   };
   recorder.start(1000);recordingStart=performance.now();
   const mode=$('recordPlaybackScope').value;
   const play=$ (mode==='all'?'editorPlayAll':'editorPlaySection');
   play?.click();
   stop.disabled=false;status.textContent='● 録音中。曲を聴きながら歌ってください。終了すると譜面化します。';
  }catch(e){status.textContent='録音開始に失敗：'+e.message;cleanup();}
 };
 stop.onclick=()=>{
  if(recorder?.state==='recording'){
   stop.disabled=true;status.textContent='録音を処理しています…';
   recorder.stop();$('editorStop')?.click();
  }
 };
})();
