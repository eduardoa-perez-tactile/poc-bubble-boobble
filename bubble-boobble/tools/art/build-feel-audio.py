"""Reproducible original mono arcade cues; no downloaded samples."""
from pathlib import Path
import math, wave, struct
root=Path(__file__).resolve().parents[2]
out=root/'assets/audio'
# Each event has its own contour and harmonic content, with gentle attack/release.
settings={'bubble-shot':(.10,560,240,.23),'bubble-pop':(.14,920,180,.28),'capture':(.22,620,1180,.22),'rescue':(.40,440,880,.25),'boss-hit':(.16,190,70,.30),'wave-clear':(.42,520,1040,.22),'victory':(.70,660,1320,.25)}
for name,(duration,start,end,gain) in settings.items():
    rate=24000;phase=0;samples=[]
    for i in range(round(duration*rate)):
        t=i/rate;u=t/duration
        if name in ('rescue','wave-clear','victory'):
            notes=[1,1.25,1.5,2];freq=start*notes[min(3,int(u*4))]
        else:freq=start+(end-start)*u
        phase+=2*math.pi*freq/rate
        env=min(1,t/.006)*(1-u)**2
        value=(math.sin(phase)+.18*math.sin(phase*2))*env*gain
        samples.append(struct.pack('<h',int(max(-1,min(1,value))*32767)))
    with wave.open(str(out/f'{name}.wav'),'wb') as w:
        w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(b''.join(samples))
