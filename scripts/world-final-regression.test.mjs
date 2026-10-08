import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_IDS, FREE_GAME_IDS, PLUS_GAME_IDS } from '../src/games/registry.js';
import { habitSeenId } from '../src/shared/world-habits.js';
import { personalizedPlaceEvent } from '../src/shared/world-behavior-personalization.js';
import { visibleMemoryFor } from '../src/shared/world-memory.js';
import { featuredParkTreasure } from '../src/shared/world-treasure-personalization.js';
import { personalizedAdventureIntro } from '../src/shared/adventure-personalization.js';
import { worldContinuityLine } from '../src/shared/world-continuity.js';

test('catálogo final mantém 16 jogos, 10 grátis e 6 Plus',()=>{
  assert.equal(GAME_IDS.length,16);
  assert.equal(FREE_GAME_IDS.length,10);
  assert.equal(PLUS_GAME_IDS.length,6);
});

test('hábito espontâneo é limitado globalmente por dia e período',()=>{
  const a=habitSeenId('2026-10-08','dia',{id:'cuidar-planta'});
  const b=habitSeenId('2026-10-08','dia',{id:'folhear-livros'});
  const c=habitSeenId('2026-10-08','tarde',{id:'folhear-livros'});
  assert.equal(a,b);
  assert.notEqual(a,c);
});

test('personalização de evento preserva identidade do evento',()=>{
  const base={id:'observatorio-cometa',rarity:'rare',icon:'☄️',title:'x',text:'x',effect:{kind:'shooting-star'}};
  const out=personalizedPlaceEvent(base,{id:'comet-chaser'},'Pipo');
  assert.equal(out.id,base.id);
  assert.equal(out.rarity,base.rarity);
});

test('memória e Tesouro personalizados não alteram existência da conquista',()=>{
  const memories=[{id:'found:cometa_mirim',icon:'☄️',text:'cometa'},{id:'found:coelho_lunar',icon:'🐇',text:'constelação'}];
  assert.equal(visibleMemoryFor('observatorio',{memories,day:'2026-10-08',preference:{id:'comet-chaser'}})?.id,'found:cometa_mirim');
  const treasures=[{gameId:'a',title:'A',medal:1},{gameId:'b',title:'B',medal:3}];
  assert.equal(featuredParkTreasure(treasures,{preference:{id:'achievement-collector'}})?.gameId,'b');
});

test('aventura e continuidade só acrescentam narrativa',()=>{
  const adventure={id:'a',intro:'Base',choices:[{id:'x'}]};
  const intro=personalizedAdventureIntro(adventure,{preference:{id:'star-seeker'},petName:'Pipo'});
  assert.match(intro,/Base/);
  assert.deepEqual(adventure.choices,[{id:'x'}]);
  const line=worldContinuityLine('jardim','observatorio',{preference:{id:'star-seeker'},petName:'Pipo'});
  assert.match(line,/Jardim/);
});
