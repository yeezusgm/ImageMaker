// The journal, route unlocks and ordered circuits are independent of the renderer.
export function createJourney(level, sim) {
  const unlocked=new Set(), seen=new Set(), clues=new Set(), cleared=new Set();
  const progress=new Map(), relics=new Set();
  function reset(){unlocked.clear();seen.clear();clues.clear();cleared.clear();progress.clear();relics.clear();}
  function activate(puzzle,id){
    if(cleared.has(puzzle.id))return 'done';
    const step=progress.get(puzzle.id)||0;
    if(puzzle.order[step]!==id){progress.delete(puzzle.id);return 'wrong';}
    if(step+1<puzzle.order.length){progress.set(puzzle.id,step+1);return 'next';}
    if(!sim.setGate(puzzle.gateId,true))return 'wrong';
    progress.set(puzzle.id,puzzle.order.length);cleared.add(puzzle.id);return 'open';
  }
  function visit(x){const i=level.zones.findLastIndex(z=>x>=z.x);if(i>=0)seen.add(i);return i;}
  function snapshot(){return {unlocked:[...unlocked],seen:[...seen],clues:[...clues],cleared:[...cleared],relics:[...relics]};}
  function restore(data={}){
    reset();for(const s of level.stations)if(data.unlocked?.includes(s.id))unlocked.add(s.id);
    for(let i=0;i<level.zones.length;i++)if(data.seen?.includes(i))seen.add(i);
    for(const r of level.relics??[])if(data.relics?.includes(r.id))relics.add(r.id);
    for(const p of level.puzzles){
      if(data.clues?.includes(p.id))clues.add(p.id);
      if(data.cleared?.includes(p.id)&&sim.setGate(p.gateId,true)){cleared.add(p.id);progress.set(p.id,p.order.length);}
    }
  }
  return {unlocked,seen,clues,cleared,progress,relics,reset,activate,visit,snapshot,restore};
}
