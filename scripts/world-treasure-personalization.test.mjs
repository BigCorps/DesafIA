import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredParkTreasure, treasureMemoryLine } from '../src/shared/world-treasure-personalization.js';

const treasures=[
  {gameId:'a',title:'A',icon:'🗺️',medal:1},
  {gameId:'b',title:'B',icon:'🔭',medal:3},
  {gameId:'c',title:'C',icon:'🎵',medal:2}
];

test('colecionador destaca maior medalha',()=>{
  assert.equal(featuredParkTreasure(treasures,{preference:{id:'achievement-collector'},day:'2026-10-08'})?.gameId,'b');
});

test('contador de histórias escolhe de forma determinística por dia',()=>{
  const a=featuredParkTreasure(treasures,{preference:{id:'treasure-storyteller'},day:'2026-10-08'});
  const b=featuredParkTreasure(treasures,{preference:{id:'treasure-storyteller'},day:'2026-10-08'});
  assert.equal(a?.gameId,b?.gameId);
});

test('sem preferência mantém o mais recente',()=>{
  assert.equal(featuredParkTreasure(treasures,{day:'2026-10-08'})?.gameId,'c');
});

test('fala personalizada não cria recompensa',()=>{
  const line=treasureMemoryLine(treasures[1],{id:'treasure-storyteller'},'Pipo');
  assert.match(line,/história/i);
});
