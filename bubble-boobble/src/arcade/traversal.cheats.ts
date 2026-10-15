import {write} from '@gameengine/runtime';
import {defineCheat} from '@gameengine/runtime/cheats';
import campaign from '../../data/levels.json';
import {ArcadeControl} from '../schema.gen';
import {desktopAction} from '../desktop/state';
import {createGame} from './game';
import {session} from './session';
import {ActorSize,Tile} from './types';
import type {Level} from './types';

// Initial conditions only; the subsequent recorded input exercises ArcadeStep.
export const PrepareTopTraversal=defineCheat({
 id:'arcade.prepare-top-traversal',group:'Arcade',title:'Prepare round three top traversal',
 resources:[write(ArcadeControl)],
 run(ctx){
  const game=createGame((campaign as Level[]).slice(2),42);
  game.State=1;game.Countdown=0;
  Object.assign(game.Players[0]!,{X:10*Tile,Y:-ActorSize+1,VY:-8,Ground:false});
  desktopAction('navigate','play');
  session.set({active:true,mode:'campaign',game});
  ctx.set(ArcadeControl,{active:true,skip:true});
 },
});
