#import <AVFoundation/AVFoundation.h>

// Stateful source transport used by the project-owned desktop application.
// Call control methods from one serial thread. The audio callback never waits.
@interface BBYMTransport : NSObject
// Initial control state is installed before any render callback can consume PCM.
- (BOOL)startHelper:(NSString *)executable track:(NSString *)track paused:(BOOL)paused volume:(float)volume muted:(BOOL)muted error:(NSError **)error;
- (void)setPaused:(BOOL)paused;
- (void)setVolume:(float)volume muted:(BOOL)muted;
- (NSDictionary *)status;
- (void)stop;
@end
