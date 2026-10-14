import { defineSystem, PointerDown, PointerUp, PointerMove, PointerHover, MouseDown, MouseUp, read, write } from '@gameengine/runtime';
import { ArcadeControl, EditorPointer } from '../schema.gen.ts';
import { desktopAction, desktopState } from '../desktop/index.ts';
export const ArcadeEditorInput=defineSystem({
  name:'ArcadeEditorInput',after:['DesktopSystem'],
  resources:[read(ArcadeControl),write(EditorPointer)],
  events:[PointerDown,PointerUp,PointerMove,PointerHover,MouseDown,MouseUp],
  runIf:{resource:ArcadeControl,field:'active',value:true},
  run(ctx){
    if(desktopState.get().screen!=='editor')return;
    const paint=(world:readonly number[],begin=false,erase=false)=>{
      const col=Math.floor((world[0]!-24)/16),row=Math.floor((720-world[1]!-146)/16);
      if(col<2||col>=30||row<0||row>=26)return;
      const p=ctx.get(EditorPointer);
      if(begin){desktopAction('paint-begin');ctx.set(EditorPointer,{drawing:!erase,erasing:erase,col:-1,row:-1});}
      if((p.drawing||p.erasing||begin)&&(begin||p.col!==col||p.row!==row)){
        desktopAction('paint','',erase||p.erasing?-1:0,col,row);
        ctx.set(EditorPointer,{col,row});
      }
    };
    for(const e of ctx.events.read(PointerDown))paint(e.world,true,false);
    for(const e of ctx.events.read(MouseDown))if(e.button===2)paint(e.world,true,true);
    for(const e of ctx.events.read(PointerMove))paint(e.world);
    for(const e of ctx.events.read(PointerHover))paint(e.world);
    if(ctx.events.count(PointerUp)>0||ctx.events.count(MouseUp)>0){
      if(desktopState.get().painting)desktopAction('paint-end');
      ctx.set(EditorPointer,{drawing:false,erasing:false,col:-1,row:-1});
    }
  },
});
