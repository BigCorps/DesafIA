import test from 'node:test';
import assert from 'node:assert/strict';
import { placeDailyEvent, shouldAutoShowPlaceEvent } from '../src/shared/place-events.js';

test('acontecimento do dia é determinístico por lugar',()=>{
  const a=placeDailyEvent('observatorio',{day:'2026-10-08'});
  const b=placeDailyEvent('observatorio',{day:'2026-10-08'});
  assert.deepEqual(a,b);
});

test('jardim reconhece histórico de cuidado existente',()=>{
  const event=placeDailyEvent('jardim',{day:'2026-10-08',actions:{scenePlant:6}});
  assert.equal(event.id,'jardim-cresceu');
  assert.equal(event.rarity,'progress');
});

test('leitura pode reaproveitar memória já existente',()=>{
  const event=placeDailyEvent('leitura',{day:'2026-10-08',memories:[{icon:'🦋',text:'Quando encontramos a Borboleta Azul'}]});
  assert.equal(event.id,'leitura-memoria');
  assert.match(event.text,/Borboleta Azul/);
});

test('Parque destaca tesouro existente sem criar recompensa nova',()=>{
  const event=placeDailyEvent('parque',{day:'2026-10-08',treasures:[{gameId:'robo',icon:'🔋',title:'Bateria Brilhante'}]});
  assert.equal(event.objectId,'sceneTreasure');
  assert.match(event.text,/Bateria Brilhante/);
});

test('decisão automática também é determinística',()=>{
  assert.equal(shouldAutoShowPlaceEvent('jardim','2026-10-08'),shouldAutoShowPlaceEvent('jardim','2026-10-08'));
});
