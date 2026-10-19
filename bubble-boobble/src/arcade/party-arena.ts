import { type Level } from './types';
export const courtyardColumns=44, courtyardRows=30;
export function createPartyArena(source:Level):Level {
  const tiles=Array.from({length:courtyardRows},(_,row)=>Array.from({length:courtyardColumns},(_,col)=>col<2||col>=42||row===29?1:0));
  const shelves:[number,number,number][]=[
    [24,3,8],[24,11,16],[24,19,24],[24,27,32],[24,35,40],
    [19,5,12],[19,17,24],[19,29,36],
    [14,3,9],[14,13,19],[14,24,30],[14,34,40],
    [9,7,14],[9,20,27],[9,33,39],
    [4,12,19],[4,25,32],
  ];
  for(const [row,left,right] of shelves)for(let col=left;col<=right;col++)tiles[row]![col]=1;
  return {...source,arena:'courtyard',tiles,enemies:[{kind:'zenchan',col:15,row:4}],player:{col:4,row:29},power_spawn:{col:20,row:24},food_spawn:{col:20,row:29}};
}
