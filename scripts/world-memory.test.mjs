import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryPlace, visibleMemoryFor, memoryWorldAction } from '../src/shared/world-memory.js';

const memories=[
  {id:'first_day',icon:'🌟',text:'Nosso primeiro dia completo'},
  {id:'found:marcador_dourado',icon:'🔖',text:'Quando encontramos Marcador Dourado'},
  {id:'found:joaninha_soneca',icon:'🐞',text:'Quando encontramos Joaninha Soneca'},
  {id:'found:cometa_mirim',icon:'☄️',text:'Quando encontramos Cometa Mirim'}
];

test('memórias de descobertas vão para lugares coerentes',()=>{
  assert.equal(memoryPlace(memories[1]),'leitura');
  assert.equal(memoryPlace(memories[2]),'jardim');
  assert.equal(memoryPlace(memories[3]),'observatorio');
  assert.equal(memoryPlace(memories[0]),'colina');
});

test('seleção é estável no mesmo dia e lugar',()=>{
  const a=visibleMemoryFor('leitura',{memories,day:'2026-10-08'});
  const b=visibleMemoryFor('leitura',{memories,day:'2026-10-08'});
  assert.deepEqual(a,b);
});

test('lugar sem memória compatível não inventa lembrança',()=>{
  assert.equal(visibleMemoryFor('parque',{memories:[memories[1]],day:'2026-10-08'}),null);
});

test('Colina pode acolher memória geral como fallback',()=>{
  const found=visibleMemoryFor('colina',{memories:[memories[1]],day:'2026-10-08'});
  assert.equal(found.id,'found:marcador_dourado');
});

test('ação de memória é afetiva e sem recompensa',()=>{
  const action=memoryWorldAction(memories[0],'colina');
  assert.equal(action.objectId,'worldMemoryToken');
  assert.equal(action.motion,'hug');
  assert.equal('reward' in action,false);
  assert.match(action.text,/primeiro dia/i);
});
