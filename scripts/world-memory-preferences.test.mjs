import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleMemoryFor, memoryWorldAction } from '../src/shared/world-memory.js';

const memories=[
  {id:'found:cometa_mirim',icon:'☄️',text:'Quando vimos um cometa'},
  {id:'found:coelho_lunar',icon:'🐇',text:'Quando vimos uma constelação especial'}
];

test('caçador de cometas prioriza memória de cometa quando existe',()=>{
  const m=visibleMemoryFor('observatorio',{memories,day:'2026-10-08',preference:{id:'comet-chaser'}});
  assert.match(m?.id||'',/cometa/);
});

test('procurador de estrelas evita cometa quando há outra memória do céu',()=>{
  const m=visibleMemoryFor('observatorio',{memories,day:'2026-10-08',preference:{id:'star-seeker'}});
  assert.doesNotMatch(m?.id||'',/cometa/);
});

test('ação de memória usa tom da preferência sem recompensa',()=>{
  const a=memoryWorldAction(memories[0],'observatorio',{id:'comet-chaser'},'Pipo');
  assert.match(a.text,/Pipo/);
  assert.equal('reward' in a,false);
});
