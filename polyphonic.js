'use strict';
// Local harmonic-template multi-pitch estimator; approximate, not source separation.
window.MelodyPolyphonic = (()=>{
 function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len*=2){const theta=-2*Math.PI/len,wr=Math.cos(theta),wi=Math.sin(theta);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=cr*re[l]-ci*im[l],ti=cr*im[l]+ci*re[l];re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}}
 const hz=m=>440*Math.pow(2,(m-69)/12);
 function read(data,sampleRate,options={}){
  const size=4096,hop=1024,low=options.low??36,high=options.high??96,maxVoices=options.voices??3,threshold=options.threshold??0.012,minimum=options.minimum??0.12;
  const nframes=Math.max(0,Math.floor((data.length-size)/hop)+1);if(!nframes)return [];
  const re=new Float64Array(size),im=new Float64Array(size),mag=new Float64Array(size/2),res=new Float64Array(size/2);
  const templates=[];
  for(let m=low;m<=high;m++){
   const bins=[];for(let harmonic=1;harmonic<=7;harmonic++){const center=hz(m)*harmonic*size/sampleRate;if(center>=size/2-2)break;bins.push({center,weight:1/Math.pow(harmonic,0.85)});}
   templates.push({m,bins});
  }
  const frames=[];
  for(let frame=0;frame<nframes;frame++){
   const at=frame*hop;let energy=0;
   for(let j=0;j<size;j++){const x=data[at+j];energy+=x*x;re[j]=x*(0.5-0.5*Math.cos(2*Math.PI*j/(size-1)));im[j]=0;}
   if(Math.sqrt(energy/size)<threshold){frames.push([]);continue;}
   fft(re,im);for(let j=0;j<mag.length;j++){mag[j]=Math.hypot(re[j],im[j]);res[j]=mag[j];}
   const chosen=[];
   for(let voice=0;voice<maxVoices;voice++){
    let best=null,bestScore=0;
    for(const t of templates){if(chosen.some(x=>Math.abs(x-t.m)<=1))continue;let score=0,total=0;
     for(const {center,weight} of t.bins){const c=Math.round(center);let peak=0;for(let k=Math.max(1,c-1);k<=Math.min(res.length-1,c+1);k++)peak=Math.max(peak,res[k]);score+=weight*peak;total+=weight;}
     score/=Math.max(1,total);if(score>bestScore){bestScore=score;best=t;}
    }
    if(!best)break;
    const peak=Math.max(...res.subarray(1,Math.min(500,res.length)));
    if(bestScore<peak*(voice===0?0.14:0.21))break;
    // A candidate with no meaningful fundamental is likely a harmonic of another note.
    const fund=Math.round(best.bins[0].center);let fundamental=0;for(let k=Math.max(1,fund-1);k<=Math.min(res.length-1,fund+1);k++)fundamental=Math.max(fundamental,mag[k]);
    if(voice>0&&fundamental<peak*0.065)break;
    chosen.push(best.m);
    for(const {center} of best.bins){const c=Math.round(center);for(let k=Math.max(1,c-2);k<=Math.min(res.length-1,c+2);k++)res[k]*=0.16;}
   }
   frames.push(chosen);
  }
  // Require temporal persistence to reduce spectral flicker and octave hallucinations.
  const notes=[];
  for(let pitch=low;pitch<=high;pitch++){
   let start=-1,gap=0;
   function finish(end){if(start<0)return;const duration=(end-start)*hop/sampleRate;if(duration>=minimum)notes.push({pitch,start:start*hop/sampleRate,dur:duration});start=-1;gap=0;}
   for(let i=0;i<=frames.length;i++){
    const hit=i<frames.length&&frames[i].includes(pitch);
    if(hit){if(start<0)start=i;gap=0;}else if(start>=0){gap++;if(gap>1)finish(i-gap+1);}
   }
  }
  return notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
 }
 return {read};
})();
