#!/usr/bin/env python3
"""Build helper and an independent pinned-original oracle, compare all five tracks.
Only ignored .cache files are created outside this isolated tool directory.
"""
import argparse, hashlib, json, mmap, pathlib, shutil, signal, subprocess, tempfile, time, wave
ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = pathlib.Path(__file__).resolve().parent

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(65536),b''): h.update(b)
    return h.hexdigest()

def difference(a,b,start,end,b_repeat=False):
    """First differing PCM frame, bounded byte slices, optionally repeat b."""
    for p in range(start*4,end*4,65536):
        n=min(65536,end*4-p)
        if b_repeat:
            off=p%len(b); bb=(b[off:off+n] if off+n<=len(b) else (b[off:]+b[:max(0,n-(len(b)-off))]))
            # Small jingles can be shorter than a block.
            if len(bb)<n: bb=(bytes(b)*(n//len(b)+2))[off:off+n]
        else: bb=b[p:p+n]
        aa=a[p:p+n]
        if aa!=bb:
            return (p+next(i for i,(x,y) in enumerate(zip(aa,bb)) if x!=y))//4
    return None

ORACLE = r'''package main
import("bubblebobble/internal/ym";"github.com/olivierh59500/ym-player/pkg/stsound";"encoding/json";"io";"os";"reflect";"strconv")
func main(){
 data,e:=os.ReadFile(os.Args[1]);if e!=nil{panic(e)}
 if os.Args[2]=="info"{
  s:=stsound.CreateWithRate(48000);if e=s.LoadMemory(data);e!=nil{panic(e)};defer s.Destroy()
  m:=reflect.ValueOf(s).Elem().FieldByName("music").Elem()
  json.NewEncoder(os.Stdout).Encode(map[string]int64{"ymFrames":m.FieldByName("nbFrame").Int(),"loopFrame":m.FieldByName("loopFrame").Int(),"playerRate":m.FieldByName("playerRate").Int()});return
 }
 loop,_:=strconv.ParseBool(os.Args[2]);n,_:=strconv.ParseInt(os.Args[3],10,64)
 s,e:=ym.New(data,loop);if e!=nil{panic(e)};defer s.Close();var r io.Reader=s;if n>0{r=io.LimitReader(r,n*4)}
 if _,e=io.CopyBuffer(os.Stdout,r,make([]byte,16384));e!=nil{panic(e)}
}'''

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--go',default=str(ROOT/'.cache/toolchains/go/bin/go'));ap.add_argument('--output',default=str(ROOT/'.cache/desktop/ym-source-proof.json'));args=ap.parse_args()
    reference=ROOT/'.cache/reference'
    assert (reference/'internal/ym/stream.go').read_bytes()==(HERE/'internal/ym/stream.go').read_bytes(),'copied reader changed'
    cache=ROOT/'.cache/desktop';cache.mkdir(parents=True,exist_ok=True)
    helper=cache/'ym-source';oracle=cache/'ym-source-original-oracle'
    subprocess.run([args.go,'build','-o',str(helper),'.'],cwd=HERE,check=True)
    oracle_dir=pathlib.Path(tempfile.mkdtemp(prefix='ym-source-proof-',dir=reference/'cmd'))
    try:
        (oracle_dir/'main.go').write_text(ORACLE)
        subprocess.run([args.go,'build','-o',str(oracle),'./cmd/'+oracle_dir.name],cwd=reference,check=True)
    finally: shutil.rmtree(oracle_dir)
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=reference,text=True).strip()=='783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc','reference revision changed'
    report={'sampleRate':48000,'channels':2,'format':'s16le','readerSha256':sha(HERE/'internal/ym/stream.go'),'referenceRevision':json.loads((ROOT/'data/reference-assets.json').read_text())['revision'],'module':json.loads(subprocess.check_output([args.go,'list','-m','-json','github.com/olivierh59500/ym-player'],cwd=HERE)),'tracks':[]}
    with tempfile.TemporaryDirectory(prefix='ym-pcm-',dir=cache) as tmp:
        for number in range(1,6):
            track=reference/f'resources/audio/bubble-{number}.ym'
            info=json.loads(subprocess.check_output([str(oracle),str(track),'info']))
            first=info['ymFrames']*(48000//info['playerRate']);period=(info['ymFrames']-info['loopFrame'])*(48000//info['playerRate']);frames=first+period+4096
            paths={name:pathlib.Path(tmp)/name for name in ('helper','oracle','finite')}
            commands={'helper':[str(helper),'--track',str(track),'--loop=true','--frames',str(frames)],'oracle':[str(oracle),str(track),'true',str(frames)],'finite':[str(oracle),str(track),'false','0']}
            for name,cmd in commands.items():
                with paths[name].open('wb') as out: subprocess.run(cmd,stdout=out,check=True,timeout=60)
            handles=[p.open('rb') for p in paths.values()]
            maps=[mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) for f in handles];actual,expected,finite=maps
            assert len(actual)==len(expected)==frames*4
            assert difference(actual,expected,0,frames) is None,'original PCM mismatch'
            wav=ROOT/f'assets/reference/audio/music-bubble-{number}.wav'
            with wave.open(str(wav),'rb') as w:
                assert w.getparams()[:3]==(2,2,48000)
                assert w.readframes(w.getnframes())==finite[:],'exported WAV differs from original loop=false'
            windows={}
            for name,start,end in [('firstLoop',0,first),('firstBoundaryTail',first-4096,first+4096),('secondLoop',first,first+period),('secondBoundaryTail',first+period-4096,frames)]:
                windows[name]={'startFrame':start,'frames':end-start,'sha256':hashlib.sha256(actual[start*4:end*4]).hexdigest(),'matchesOriginal':True}
            finite_frames=len(finite)//4
            tail=finite[first*4:]
            report['tracks'].append({'track':track.name,'sourceSha256':sha(track),**info,'firstLoopFrames':first,'repeatFrames':period,'comparedFrames':frames,'pcmSha256':sha(paths['helper']),'windows':windows,'exporterFiniteFrames':finite_frames,'exporterTailFrames':finite_frames-first,'exporterTailNonzeroFrames':sum(tail[i:i+4]!=b'\0'*4 for i in range(0,len(tail),4)),'exporterWavMatchesOriginalFinite':True,'firstFiniteVsContinuousMismatchFrame':difference(actual,finite,0,min(frames,finite_frames)),'firstTrimmedLoopRepeatMismatchFrame':difference(actual,actual[:first*4],first,first+period,True),'firstNaiveWavRepeatMismatchFrame':difference(actual,finite,finite_frames,min(frames,finite_frames+48000),True)})
            for m in maps:m.close()
            for f in handles:f.close()
            print(f'{track.name}: {frames} frames bit-exact through second loop + tail',flush=True)
    track=str(reference/'resources/audio/bubble-1.ym')
    child=subprocess.Popen([str(helper),'--track',track],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    time.sleep(.2);assert child.poll() is None,'helper stopped while output pipe blocked'
    begin=time.monotonic();child.terminate();child.wait(timeout=2);latency=(time.monotonic()-begin)*1000
    child.stdout.close();child.stderr.close()
    assert child.returncode==-signal.SIGTERM
    report['cancellation']={'blockedPipe':True,'signal':'SIGTERM','exitCode':child.returncode,'milliseconds':round(latency,3)}
    child=subprocess.Popen([str(helper),'--track',track],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    child.stdout.close();child.wait(timeout=2);child.stderr.close()
    assert child.returncode==-signal.SIGPIPE,'closed consumer pipe did not stop source'
    report['closedConsumer']={'signal':'SIGPIPE','exitCode':child.returncode}
    expected=json.loads((HERE/'expected-pcm.json').read_text())
    for key in ['readerSha256','referenceRevision']: assert report[key]==expected[key],key+' changed'
    for key in ['Version','Sum','GoModSum']: assert report['module'][key]==expected['module'][key],'module '+key+' changed'
    assert report['tracks']==expected['tracks'],'pinned track PCM proof changed'
    report['ok']=True
    pathlib.Path(args.output).write_text(json.dumps(report,indent=2)+'\n');print(args.output)
if __name__=='__main__':main()
