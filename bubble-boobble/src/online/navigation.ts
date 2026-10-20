import type { CompanionState } from '../arcade/companion';
import type { GameState } from '../arcade/types';

type NavigationGraph = NonNullable<CompanionState['Graph']>;

/** Call only on a freshly copied online game: snapshots and shared graphs stay immutable. */
export function restoreOnlineNavigation(game: GameState): void {
  const graphs = game.OnlineNavigationGraphs, indices = game.OnlineNavigationGraphIndices;
  if (!graphs || !indices || !game.Companions) return;
  for (let slot = 0; slot < game.Companions.length; slot++) {
    const companion = game.Companions[slot];
    if (!companion) continue;
    const index = indices[slot] ?? -1;
    if (index >= graphs.length || index < -1 || !Number.isInteger(index)) throw new Error('Invalid online navigation graph reference');
    companion.Graph = index < 0 ? null : graphs[index]!;
  }
  // copyGame preserves Companion as the slot-one alias; assigning its graph above restores both.
  delete game.OnlineNavigationGraphs;
  delete game.OnlineNavigationGraphIndices;
}

/**
 * Graphs are immutable/copy-on-write. Preserve distinct generations (including a downed bot's
 * older build), but serialize a graph shared by eight controllers only once. All mutable
 * controller fields stay on their original slots; only graph references are encoded.
 */
export function compactOnlineNavigation(game: GameState): void {
  if (!game.Companions) return;
  const graphs: NavigationGraph[] = [];
  const indices = game.Companions.map(companion => {
    if (!companion?.Graph) return -1;
    const graph = companion.Graph;
    let index = graphs.indexOf(graph);
    if (index < 0) { index = graphs.length; graphs.push(graph); }
    companion.Graph = null;
    return index;
  });
  // The slot-one alias now has Graph=null too, so it cannot duplicate the serialized graph.
  game.OnlineNavigationGraphs = graphs;
  game.OnlineNavigationGraphIndices = indices;
}
