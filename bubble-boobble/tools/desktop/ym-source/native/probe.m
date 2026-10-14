#import "BBYMTransport.h"
#import <Foundation/Foundation.h>
#import <unistd.h>

static NSDictionary *waitStatus(BBYMTransport *transport, BOOL pause, uint64_t frames) {
 for(int i=0;i<3000;i++) {
  NSDictionary *s=transport.status;
  if((pause&&[s[@"pauseAcknowledged"] boolValue])||(!pause&&[s[@"consumedFrames"] unsignedLongLongValue]>=frames))return s;
  usleep(10000);
 }
 return nil;
}
static BOOL prefixMatches(NSString *helper,NSString *track,NSDictionary *status) {
 NSTask *task=[NSTask new];task.executableURL=[NSURL fileURLWithPath:helper];
 task.arguments=@[@"--track",track,@"--loop=true",@"--frames",[status[@"consumedFrames"] stringValue]];
 NSPipe *pipe=[NSPipe pipe];task.standardOutput=pipe;
 NSError *error=nil;if(![task launchAndReturnError:&error])return NO;
 NSData *pcm=[pipe.fileHandleForReading readDataToEndOfFile];[task waitUntilExit];
 uint64_t hash=UINT64_C(14695981039346656037);const uint8_t *bytes=pcm.bytes;
 for(NSUInteger i=0;i<pcm.length;i++)hash=(hash^bytes[i])*UINT64_C(1099511628211);
 return task.terminationStatus==0&&pcm.length==[status[@"consumedFrames"] unsignedLongLongValue]*4&&[[NSString stringWithFormat:@"%016llx",(unsigned long long)hash] isEqualToString:status[@"pcmHash"]];
}
int main(int argc,const char **argv) {@autoreleasepool{
 if(argc<3||argc>5)return 2;
 NSString *helper=[NSString stringWithUTF8String:argv[1]],*track=[NSString stringWithUTF8String:argv[2]];
 BBYMTransport *transport=[BBYMTransport new];NSError *error=nil;
 if(![transport startHelper:helper track:track paused:YES volume:0.25f muted:YES error:&error]){fprintf(stderr,"%s\n",error.description.UTF8String);return 1;}
 NSDictionary *startup=waitStatus(transport,YES,0);
 usleep(250000);NSDictionary *stillStartup=transport.status;
 BOOL startupFrozen=startup&&[startup[@"consumedFrames"] unsignedLongLongValue]==0&&[stillStartup[@"consumedFrames"] unsignedLongLongValue]==0&&[startup[@"pcmHash"] isEqual:stillStartup[@"pcmHash"]]&&[stillStartup[@"pcmHash"] isEqual:@"cbf29ce484222325"]&&[stillStartup[@"paused"] boolValue]&&[stillStartup[@"muted"] boolValue]&&[stillStartup[@"volume"] floatValue]==0.25f&&[stillStartup[@"bufferedFrames"] unsignedLongLongValue]<=[stillStartup[@"capacityFrames"] unsignedLongLongValue];
 [transport setVolume:0.25f muted:NO];[transport setPaused:NO];
 uint64_t target=argc>3?strtoull(argv[3],NULL,10):4800;
 NSDictionary *playing=waitStatus(transport,NO,target);
 [transport setPaused:YES];NSDictionary *paused=waitStatus(transport,YES,0);
 usleep(700000);NSDictionary *still=transport.status;
 [transport setPaused:NO];NSDictionary *resuming=waitStatus(transport,NO,[paused[@"consumedFrames"] unsignedLongLongValue]+4800);
 [transport setPaused:YES];NSDictionary *second=waitStatus(transport,YES,0);
 BOOL firstPrefix=prefixMatches(helper,track,paused),secondPrefix=prefixMatches(helper,track,second);
 int pid=[second[@"helperPID"] intValue];[transport stop];usleep(100000);
 BOOL exited=kill(pid,0)!=0;
 NSString *nextTrack=argc>4?[NSString stringWithUTF8String:argv[4]]:track;
 BOOL restarted=[transport startHelper:helper track:nextTrack paused:NO volume:0.5f muted:YES error:&error];
 NSDictionary *restartPlaying=waitStatus(transport,NO,4800);
 [transport setPaused:YES];NSDictionary *restart=waitStatus(transport,YES,0);
 BOOL restartPrefix=restarted&&restartPlaying&&[restart[@"muted"] boolValue]&&[restart[@"volume"] floatValue]==0.5f&&prefixMatches(helper,nextTrack,restart);
 int secondPID=[restart[@"helperPID"] intValue];[transport stop];usleep(100000);
 BOOL restartExited=kill(secondPID,0)!=0;
 BOOL pass=startupFrozen&&restarted&&restartPrefix&&restartExited&&secondPID!=pid&&playing&&paused&&resuming&&second&&[paused[@"consumedFrames"] isEqual:still[@"consumedFrames"]]&&[paused[@"pcmHash"] isEqual:still[@"pcmHash"]]&&[second[@"consumedFrames"] unsignedLongLongValue]>[paused[@"consumedFrames"] unsignedLongLongValue]&&[still[@"bufferedFrames"] unsignedLongLongValue]<=[still[@"capacityFrames"] unsignedLongLongValue]&&[second[@"underrunFrames"] unsignedLongLongValue]==0&&firstPrefix&&secondPrefix&&exited;
 NSDictionary *result=@{@"pass":@(pass),@"pausedMutedStartupFrozen":@(startupFrozen),@"startup":startup?:@{},@"stillStartup":stillStartup,@"resumedStartupPrefixMatches":@(firstPrefix),@"firstPrefixMatches":@(firstPrefix),@"resumedPrefixMatches":@(secondPrefix),@"helperExited":@(exited),@"restartPrefixMatches":@(restartPrefix),@"restartHelperExited":@(restartExited),@"restarted":restart?:@{},@"playing":playing?:@{},@"paused":paused?:@{},@"stillPaused":still,@"secondPause":second?:@{}};
 NSData *json=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:nil];fwrite(json.bytes,1,json.length,stdout);fwrite("\n",1,1,stdout);
 return pass?0:1;
}}
