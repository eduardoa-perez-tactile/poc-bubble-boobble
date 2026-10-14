// Project-owned macOS presentation adapter, loaded only into the launcher-owned
// runtime copy. It controls its own NSWindow; no Accessibility or Apple Events.
#import <Cocoa/Cocoa.h>
#import <AVFoundation/AVFoundation.h>
#import <unistd.h>
#import <signal.h>
#import "ym-source/native/BBYMTransport.h"

static NSString *statePath, *statusPath, *audioRoot, *launchId, *helperPath;
static BBYMTransport *music;
static double nextMusicRetry=0;
static NSString *track = @"", *lastError = @"";
static BOOL transition = NO, borderless = NO, activated = NO;
static NSRect savedFrame;
static NSWindowStyleMask savedStyle;
static NSApplicationPresentationOptions savedPresentation;
static NSUInteger appliedRevision = 0, lastInputSequence = 0;
static NSString *releaseKey, *pendingKey;
static NSUInteger pendingAttempts=0;
static NSWindow *ownedWindow;

static NSWindow *gameWindow(void) {
  if (ownedWindow) return ownedWindow;
  for (NSWindow *w in NSApp.windows)
    if (w.isVisible && w.contentView && w.frame.size.width > 100 && w.frame.size.height > 100) { ownedWindow=w; return w; }
  return nil;
}
// Diagnostic inputs stay inside this game's own Cocoa event queue.
static void keyEvent(NSWindow *window, NSString *key, BOOL down) {
  NSDictionary *codes = @{@"confirm":@36,@"up":@126,@"down":@125,@"left":@123,@"right":@124,@"pause":@53,@"fullscreen":@103,@"mute":@46};
  NSDictionary *characters = @{@"confirm":@"\r",@"up":[NSString stringWithFormat:@"%C",(unichar)NSUpArrowFunctionKey],@"down":[NSString stringWithFormat:@"%C",(unichar)NSDownArrowFunctionKey],@"left":[NSString stringWithFormat:@"%C",(unichar)NSLeftArrowFunctionKey],@"right":[NSString stringWithFormat:@"%C",(unichar)NSRightArrowFunctionKey],@"pause":@"\033",@"fullscreen":[NSString stringWithFormat:@"%C",(unichar)NSF11FunctionKey],@"mute":@"m"};
  if (!codes[key] || !window) return;
  NSEvent *event = [NSEvent keyEventWithType:(down ? NSEventTypeKeyDown : NSEventTypeKeyUp) location:NSZeroPoint modifierFlags:0 timestamp:NSProcessInfo.processInfo.systemUptime windowNumber:window.windowNumber context:nil characters:characters[key] charactersIgnoringModifiers:characters[key] isARepeat:NO keyCode:[codes[key] unsignedShortValue]];
  [NSApp postEvent:event atStart:NO];
}
static void update(void) {
  @autoreleasepool {
    NSData *bytes = [NSData dataWithContentsOfFile:statePath];
    NSDictionary *packet = bytes ? [NSJSONSerialization JSONObjectWithData:bytes options:0 error:nil] : nil;
    double now=[[NSDate date] timeIntervalSince1970];
    pid_t launcher=[packet[@"launcherPID"] intValue];
    BOOL lease = launcher>0 && kill(launcher,0)==0 && (now*1000-[packet[@"updatedAtUnixMs"] doubleValue])<5000;
    NSDictionary *desired = [packet[@"desired"] isKindOfClass:NSDictionary.class] ? packet[@"desired"] : @{};
    NSWindow *w = gameWindow();
    if (releaseKey && w) { keyEvent(w,releaseKey,NO); releaseKey=nil; }
    if (pendingKey && w) {
      [NSApp unhide:nil]; [NSApp activate];

      [w makeKeyAndOrderFront:nil];
      if (NSApp.isActive && w.isKeyWindow) { keyEvent(w,pendingKey,YES);releaseKey=pendingKey;pendingKey=nil; }
      else if(++pendingAttempts>=20)pendingKey=nil;
    }
    NSUInteger sequence = [packet[@"inputSequence"] unsignedIntegerValue];
    if (sequence > lastInputSequence && w) {
      NSString *key = [packet[@"inputKeys"] firstObject];
      if ([key isEqualToString:@"background"]) [w orderOut:nil];
      else if ([key isEqualToString:@"foreground"]) { [w deminiaturize:nil]; [NSApp activate]; [w makeKeyAndOrderFront:nil]; }
      else { [NSApp activate]; [w makeKeyAndOrderFront:nil]; pendingKey=key; pendingAttempts=0; }
      lastInputSequence=sequence;
    }
    if (w && !activated) { [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular]; [NSApp activate]; [w makeKeyAndOrderFront:nil]; activated = YES; }
    if (w && desired[@"fullscreen"] && [desired[@"fullscreen"] boolValue] != borderless) {
      if ([desired[@"fullscreen"] boolValue]) {
        savedFrame = w.frame; savedStyle = w.styleMask; savedPresentation = NSApp.presentationOptions;
        w.styleMask = NSWindowStyleMaskBorderless;
        [w setFrame:(w.screen ?: NSScreen.mainScreen).frame display:YES];
        NSApp.presentationOptions = NSApplicationPresentationAutoHideDock | NSApplicationPresentationAutoHideMenuBar;
        [w makeKeyAndOrderFront:nil]; borderless = YES;
      } else {
        NSApp.presentationOptions = savedPresentation;
        w.styleMask = savedStyle;
        [w setFrame:savedFrame display:YES];
        [w makeKeyAndOrderFront:nil]; borderless = NO;
      }
    }
    NSString *nextTrack = [desired[@"track"] isKindOfClass:NSString.class] ? desired[@"track"] : @"";
    BOOL muted=[desired[@"muted"] boolValue], paused=[desired[@"paused"] boolValue]||muted||!lease;
    float volume=fmax(0,fmin(1,[desired[@"volume"] floatValue]));
    if(!lease){[music stop];music=nil;track=@"";}
    // The reference returns before changing tracks while muted. Keep the current
    // synthesizer paused and defer a requested track change until unmute.
    if(lease&&!muted&&![nextTrack isEqualToString:track]&&now>=nextMusicRetry){
      [music stop];music=nil;track=@"";
      if([@[@"bubble-1",@"bubble-2",@"bubble-3",@"bubble-4",@"bubble-5"] containsObject:nextTrack]){
        NSString *path=[audioRoot stringByAppendingPathComponent:[nextTrack stringByAppendingString:@".ym"]];
        NSError *error=nil;BBYMTransport *candidate=[BBYMTransport new];
        if([candidate startHelper:helperPath track:path paused:paused volume:volume muted:muted error:&error]){music=candidate;track=[nextTrack copy];lastError=@"";nextMusicRetry=0;}
        else{lastError=error.localizedDescription?:@"Stateful native music unavailable";nextMusicRetry=now+2;}
      }else lastError=@"";
    }
    [music setVolume:volume muted:muted];[music setPaused:paused];
    NSDictionary *pcm=music.status?:@{};
    if([pcm[@"eof"] boolValue]){lastError=@"Stateful music source ended unexpectedly";[music stop];music=nil;track=@"";nextMusicRetry=now+2;}
    BOOL focused=NSApp.isActive&&w.isKeyWindow;
    appliedRevision = [packet[@"revision"] unsignedIntegerValue];
    NSRect frame = w ? w.frame : NSZeroRect;
    NSDictionary *status = @{
      @"bundleId": @"bubbleboobble.desktop", @"pid": @(getpid()), @"launchId":launchId?:@"", @"executablePath":NSBundle.mainBundle.executablePath?:@"", @"adapterActive": (lease ? @YES : @NO),
      @"launcherHeartbeatUnixMs":packet[@"updatedAtUnixMs"]?:@0,@"launcherPID":@(launcher),
      @"controlledPresentation":packet[@"controlledPresentation"]?:@NO,
      @"revision": @(appliedRevision), @"inputSequence": @(lastInputSequence), @"windowReady": (w ? @YES : @NO),
      @"fullscreen": (borderless ? @YES : @NO), @"fullscreenMode": @"borderless-desktop", @"nativeSpaceFullscreen": ((w.styleMask & NSWindowStyleMaskFullScreen) ? @YES : @NO),
      @"transition": @(transition), @"focused": (focused ? @YES : @NO), @"applicationActive":@(NSApp.isActive), @"keyWindow":@(w.isKeyWindow), @"canBecomeKey":@(w.canBecomeKeyWindow), @"windowClass":NSStringFromClass(w.class), @"windowStyle":@(w.styleMask), @"windowTitle": w.title ?: @"",
      @"windowWidth": @(frame.size.width), @"windowHeight": @(frame.size.height), @"screenWidth": @((w.screen ?: NSScreen.mainScreen).frame.size.width), @"screenHeight": @((w.screen ?: NSScreen.mainScreen).frame.size.height),
      @"track":track,@"transport":@"stateful-ym",@"music":pcm,
      @"playing":@([pcm[@"running"] boolValue]&&![pcm[@"paused"] boolValue]&&![pcm[@"eof"] boolValue]&&[pcm[@"consumedFrames"] unsignedLongLongValue]>0),
      @"position":pcm[@"position"]?:@0,@"pauseAcknowledged":pcm[@"pauseAcknowledged"]?:@NO,
      @"volume":@(muted?0:volume),@"muted":@(muted),@"error":lastError
    };
    NSData *out = [NSJSONSerialization dataWithJSONObject:status options:0 error:nil];
    [out writeToFile:statusPath options:NSDataWritingAtomic error:nil];
  }
}
__attribute__((constructor)) static void installAdapter(void) {
  @autoreleasepool {
    const char *state = getenv("BUBBLEBOOBLE_PLATFORM_STATE");
    const char *status = getenv("BUBBLEBOOBLE_PLATFORM_STATUS");
    const char *audio = getenv("BUBBLEBOOBLE_AUDIO_ROOT"), *helper=getenv("BUBBLEBOOBLE_YM_HELPER");
    if (!state || !status || !audio || !helper) return;
    statePath = [NSString stringWithUTF8String:state];
    statusPath = [NSString stringWithUTF8String:status];
    audioRoot = [NSString stringWithUTF8String:audio];helperPath=[NSString stringWithUTF8String:helper];
    const char *identity=getenv("BUBBLEBOOBLE_LAUNCH_ID");launchId=identity?[NSString stringWithUTF8String:identity]:@"";
    // Publish only process identity before window creation, so cancellation can
    // still target this exact app if startup stalls before the first UI frame.
    NSDictionary *identityStatus=@{@"bundleId":@"bubbleboobble.desktop",@"launchId":launchId?:@"",@"executablePath":NSBundle.mainBundle.executablePath?:@"",@"pid":@(getpid()),@"windowReady":@NO,@"transport":@"stateful-ym"};
    [[NSJSONSerialization dataWithJSONObject:identityStatus options:0 error:nil] writeToFile:statusPath options:NSDataWritingAtomic error:nil];
    dispatch_async(dispatch_get_main_queue(), ^{
      NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
      for (NSString *name in @[NSWindowDidEnterFullScreenNotification, NSWindowDidExitFullScreenNotification])
        [center addObserverForName:name object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) { transition = NO; }];
      NSTimer *timer = [NSTimer timerWithTimeInterval:0.05 repeats:YES block:^(NSTimer *t) { update(); }];
      [NSRunLoop.mainRunLoop addTimer:timer forMode:NSRunLoopCommonModes];
      update();
    });
  }
}
