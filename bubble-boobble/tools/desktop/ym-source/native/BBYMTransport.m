#import "BBYMTransport.h"
#import <stdatomic.h>
#import <unistd.h>
#import <errno.h>

// SPSC queue: one pipe-reader producer and one realtime audio consumer. A full
// queue stops pipe reads, so the OS pipe applies backpressure to Go's synthesizer.
#define BB_CAPACITY 9600u
#define BB_PREROLL 2048u
@interface BBYMQueue : NSObject {
@public
 int16_t samples[BB_CAPACITY * 2];
 _Atomic uint64_t written, consumed, underrunFrames, pauseRequest, pauseAck, pcmHash;
 _Atomic bool stopped, paused, muted, eof, primed;
 _Atomic float volume;
}
@end
@implementation BBYMQueue
- (instancetype)init { if ((self=[super init])) {
 atomic_init(&written,0); atomic_init(&consumed,0); atomic_init(&underrunFrames,0);
 atomic_init(&pcmHash,UINT64_C(14695981039346656037));
 atomic_init(&pauseRequest,0); atomic_init(&pauseAck,0); atomic_init(&stopped,false);
 atomic_init(&paused,false); atomic_init(&muted,false); atomic_init(&eof,false);
 atomic_init(&primed,false); atomic_init(&volume,1.f);
 } return self; }
@end

@implementation BBYMTransport {
 AVAudioEngine *_engine;
 AVAudioSourceNode *_source;
 NSTask *_helper;
 NSPipe *_pipe;
 BBYMQueue *_queue;
}
- (BOOL)startHelper:(NSString *)executable track:(NSString *)track paused:(BOOL)paused volume:(float)volume muted:(BOOL)muted error:(NSError **)error {
 [self stop];
 BBYMQueue *q=[BBYMQueue new]; _queue=q;
 // Configure while unpublished: neither the pipe producer nor audio callback
 // exists yet. A paused start needs a real callback acknowledgement, not 0==0.
 atomic_store_explicit(&q->paused,paused,memory_order_relaxed);
 atomic_store_explicit(&q->volume,fmaxf(0,fminf(1,volume)),memory_order_relaxed);
 atomic_store_explicit(&q->muted,muted,memory_order_relaxed);
 if(paused)atomic_store_explicit(&q->pauseRequest,1,memory_order_relaxed);
 _helper=[NSTask new]; _helper.executableURL=[NSURL fileURLWithPath:executable];
 _helper.arguments=@[@"--track",track,@"--loop=true"];
 _pipe=[NSPipe pipe]; _helper.standardOutput=_pipe;
 // The Go child is a PCM producer, not another game process. Do not inject this
 // adapter or let it publish into its parent's native session files.
 NSMutableDictionary *environment=[NSProcessInfo.processInfo.environment mutableCopy];
 for(NSString *key in [environment.allKeys copy])if([key isEqualToString:@"DYLD_INSERT_LIBRARIES"]||[key hasPrefix:@"BUBBLEBOOBLE_"])[environment removeObjectForKey:key];
 _helper.environment=environment;
 // stderr is inherited, never mixed into the PCM stream.
 if (![_helper launchAndReturnError:error]) { [self stop]; return NO; }
 NSFileHandle *reader=_pipe.fileHandleForReading;
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{
  int fd=reader.fileDescriptor;
  uint8_t bytes[16384+3]; size_t pending=0;
  while (!atomic_load_explicit(&q->stopped,memory_order_acquire)) {
   uint64_t head=atomic_load_explicit(&q->written,memory_order_relaxed);
   uint64_t tail=atomic_load_explicit(&q->consumed,memory_order_acquire);
   size_t freeFrames=BB_CAPACITY-(size_t)(head-tail);
   if (!freeFrames) { usleep(2000); continue; }
   size_t amount=MIN(sizeof(bytes)-pending,freeFrames*4-pending);
   ssize_t count=read(fd,bytes+pending,amount);
   if (count<0&&errno==EINTR) continue;
   if (count<=0) break;
   size_t length=pending+(size_t)count,frames=length/4;
   for(size_t i=0;i<frames;i++) {
    size_t slot=((head+i)%BB_CAPACITY)*2;
    q->samples[slot]=(int16_t)((uint16_t)bytes[i*4]|((uint16_t)bytes[i*4+1]<<8));
    q->samples[slot+1]=(int16_t)((uint16_t)bytes[i*4+2]|((uint16_t)bytes[i*4+3]<<8));
   }
   atomic_store_explicit(&q->written,head+frames,memory_order_release);
   pending=length-frames*4;
   memmove(bytes,bytes+frames*4,pending);
  }
  [reader closeFile];
  atomic_store_explicit(&q->eof,true,memory_order_release);
 });
 AVAudioFormat *format=[[AVAudioFormat alloc] initStandardFormatWithSampleRate:48000 channels:2];
 _source=[[AVAudioSourceNode alloc] initWithFormat:format renderBlock:^OSStatus(BOOL *silent,const AudioTimeStamp *timestamp,AVAudioFrameCount count,AudioBufferList *output){
  // AVAudioEngine's standard format is planar float stereo. Silence never consumes
  // source PCM: paused/underrun output therefore cannot skip or replay YM frames.
  for(UInt32 b=0;b<output->mNumberBuffers;b++) memset(output->mBuffers[b].mData,0,output->mBuffers[b].mDataByteSize);
  *silent=YES;
  if(atomic_load_explicit(&q->stopped,memory_order_acquire))return noErr;
  uint64_t generation=atomic_load_explicit(&q->pauseRequest,memory_order_acquire);
  if(atomic_load_explicit(&q->paused,memory_order_acquire)) {
   atomic_store_explicit(&q->pauseAck,generation,memory_order_release);return noErr;
  }
  if(output->mNumberBuffers!=2)return kAudio_ParamError;
  uint64_t tail=atomic_load_explicit(&q->consumed,memory_order_relaxed);
  uint64_t head=atomic_load_explicit(&q->written,memory_order_acquire);
  size_t available=(size_t)(head-tail);
  if(!atomic_load_explicit(&q->primed,memory_order_relaxed)) {
   if(available<BB_PREROLL&&!atomic_load_explicit(&q->eof,memory_order_acquire))return noErr;
   atomic_store_explicit(&q->primed,true,memory_order_relaxed);
  }
  size_t frames=MIN((size_t)count,available);
  float gain=atomic_load_explicit(&q->muted,memory_order_relaxed)?0:atomic_load_explicit(&q->volume,memory_order_relaxed);
  float *left=output->mBuffers[0].mData,*right=output->mBuffers[1].mData;
  uint64_t hash=atomic_load_explicit(&q->pcmHash,memory_order_relaxed);
  for(size_t i=0;i<frames;i++) {
   size_t slot=((tail+i)%BB_CAPACITY)*2;
   left[i]=q->samples[slot]*(gain/32768.f);right[i]=q->samples[slot+1]*(gain/32768.f);
   for(int c=0;c<2;c++){uint16_t sample=(uint16_t)q->samples[slot+c];hash=(hash^(sample&255))*UINT64_C(1099511628211);hash=(hash^(sample>>8))*UINT64_C(1099511628211);}
  }
  atomic_store_explicit(&q->pcmHash,hash,memory_order_relaxed);
  atomic_store_explicit(&q->consumed,tail+frames,memory_order_release);
  if(frames<count)atomic_fetch_add_explicit(&q->underrunFrames,count-frames,memory_order_relaxed);
  *silent=(frames==0||gain==0);return noErr;
 }];
 _engine=[AVAudioEngine new];[_engine attachNode:_source];
 [_engine connect:_source to:_engine.mainMixerNode format:format];
 if(![_engine startAndReturnError:error]) { [self stop]; return NO; }
 return YES;
}
- (void)setPaused:(BOOL)paused {
 if(!_queue||atomic_load_explicit(&_queue->paused,memory_order_relaxed)==paused)return;
 atomic_store_explicit(&_queue->paused,paused,memory_order_release);
 atomic_fetch_add_explicit(&_queue->pauseRequest,1,memory_order_acq_rel);
}
- (void)setVolume:(float)volume muted:(BOOL)muted {
 if(!_queue)return;
 atomic_store_explicit(&_queue->volume,fmaxf(0,fminf(1,volume)),memory_order_relaxed);
 atomic_store_explicit(&_queue->muted,muted,memory_order_relaxed);
}
- (NSDictionary *)status {
 if(!_queue)return @{@"running":@NO};
 BBYMQueue *q=_queue;
 uint64_t request=atomic_load_explicit(&q->pauseRequest,memory_order_acquire);
 BOOL paused=atomic_load_explicit(&q->paused,memory_order_acquire);
 BOOL acknowledged=paused&&atomic_load_explicit(&q->pauseAck,memory_order_acquire)==request;
 uint64_t tail,head;
 do {tail=atomic_load_explicit(&q->consumed,memory_order_acquire);
  head=atomic_load_explicit(&q->written,memory_order_acquire);
 }while(tail!=atomic_load_explicit(&q->consumed,memory_order_acquire));
 return @{@"running":@(_engine.isRunning),@"paused":@(paused),@"muted":@(atomic_load_explicit(&q->muted,memory_order_relaxed)),@"volume":@(atomic_load_explicit(&q->volume,memory_order_relaxed)),@"pauseAcknowledged":@(acknowledged),
 @"pcmHash": [NSString stringWithFormat:@"%016llx",(unsigned long long)atomic_load_explicit(&q->pcmHash,memory_order_relaxed)],
 @"helperPID":@(_helper.processIdentifier),@"consumedFrames":@(tail),@"producedFrames":@(head),@"bufferedFrames":@(head-tail),
 @"capacityFrames":@(BB_CAPACITY),@"position":@((double)tail/48000.0),
 @"underrunFrames":@(atomic_load_explicit(&q->underrunFrames,memory_order_relaxed)),
 @"eof":@(atomic_load_explicit(&q->eof,memory_order_acquire))};
}
- (void)stop {
 if(_queue)atomic_store_explicit(&_queue->stopped,true,memory_order_release);
 [_engine stop];
 if(_source){[_engine disconnectNodeOutput:_source];[_engine detachNode:_source];}
 if(_helper.running)[_helper terminate]; // Closing writer unblocks a pending read.
 // The reader owns its captured queue until EOF. Source's render block likewise
 // retains it until the engine has released the node: no ring use-after-free.
 _source=nil;_engine=nil;_helper=nil;_pipe=nil;_queue=nil;
}
- (void)dealloc { [self stop]; }
@end
