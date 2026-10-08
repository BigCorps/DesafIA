import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizedPlaceEvent, preferredRoutineIds } from '../src/shared/world-behavior-personalization.js';

test('preferência de planta prioriza rotinas coerentes',()=>{
  assert.deepEqual(preferredRoutineIds({id:'plant-carer'}),['plantinha','jardim']);
});

test('preferência desconhecida não inventa rotina',()=>{
  assert.deepEqual(preferredRoutineIds({id:'x'}),[]);
});

test('evento personalizado preserva id e raridade',()=>{
  const base={id:'observatorio-cometa',rarity:'rare',icon:'☄️',title:'Um cometa raro!',text:'base',effect:{kind:'shooting-star'}};
  const out=personalizedPlaceEvent(base,{id:'comet-chaser'},'Pipo');
  assert.equal(out.id,base.id);
  assert.equal(out.rarity,base.rarity);
  assert.equal(out.preferenceId,'comet-chaser');
  assert.match(out.text,/Pipo/);
});

test('sem preferência preserva o mesmo evento',()=>{
  const base={id:'jardim-visita',title:'base'};
  assert.equal(personalizedPlaceEvent(base,null,'Pipo'),base);
});

test('personalização de evento não cria recompensa',()=>{
  const base={id:'parque-x',rarity:'treasure',icon:'🏆',title:'base',text:'base',effect:{kind:'treasure-glow'}};
  const out=personalizedPlaceEvent(base,{id:'treasure-storyteller'},'Pipo');
  assert.equal('reward' in out,false);
});
