import type { PublicWorld } from './world-public';

/** Keep discovery intact but cross into the client world with only its selected display game.
 * The incoming full document is validated before this projection and the result is still
 * validated by the sim receiver. Reuse immutable packed data rather than clone every game.
 */
export function worldClientPayload(document: PublicWorld, player: number, selectedRoom: string|null, playing: boolean): PublicWorld {
 return {...document,rooms:document.rooms.map(({game,...directory})=>
  playing&&directory.id===selectedRoom&&directory.owners.includes(player)&&game
   ? {...directory,game}
   : directory)};
}
