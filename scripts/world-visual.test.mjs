import test from 'node:test';
import assert from 'node:assert/strict';
import { worldVisualState, createWorldVisualMemory } from '../src/shared/world-visual.js';

test('visual cresce com dados existentes sem alterar a entrada',()=>{
 const input={xp:2200,actions:{scenePlant:6,sceneBooks:3},seenEvents:['observatorio-ceu'],treasures:[{gameId:'labirinto'},{gameId:'labirinto'}]};
 const before=JSON.stringify(input),a=worldVisualState(input);
 assert.equal(JSON.stringify(input),before);
 assert.deepEqual(a.stages,{colina:3,jardim:3,leitura:2,observatorio:1,parque:1});
 assert.deepEqual(worldVisualState(input),a);
});
test('ausência não regride visual e histórico decorativo é limitado',()=>{
 const first=worldVisualState({actions:{scenePlant:9,sceneTelescope:6},seenEvents:['observatorio-ceu','unknown']});
 const next=worldVisualState({previous:first,seenEvents:['observatorio-ceu','observatorio-cometa']});
 assert.equal(next.stages.jardim,3);assert.equal(next.stages.observatorio,3);
 assert.equal(next.seenEvents.length,2);
 assert.equal(worldVisualState({previous:{stages:{jardim:Infinity},seenEvents:'bad'}}).stages.jardim,0);
 assert.doesNotThrow(()=>worldVisualState({previous:null}));
});
test('persistência separa jogadores, suporta reload e reset',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const a={connected:true,playerId:'00000000-0000-0000-0000-000000000001'},b={...a,playerId:'00000000-0000-0000-0000-000000000002'};
 createWorldVisualMemory(storage).observe(a,{actions:{scenePlant:6}});
 const journal=createWorldVisualMemory(storage);
 assert.equal(journal.observe(a,{}).stages.jardim,3);
 assert.equal(journal.observe(b,{}).stages.jardim,0);
 data.clear();assert.equal(journal.observe(a,{}).stages.jardim,0);
 const blocked=createWorldVisualMemory({getItem(){return null},setItem(){throw Error('quota')}});
 blocked.observe(a,{actions:{scenePlant:6}});assert.equal(blocked.observe(a,{}).stages.jardim,3);
});
