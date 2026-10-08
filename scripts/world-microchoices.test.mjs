import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyHabit, habitCandidates } from '../src/shared/world-habits.js';

const traits=(active)=>['curious','adventurous','artist','caring'].map((id)=>({id,points:id===active?4:0}));

test('preferência plant-carer faz planta vencer microdecisão do Jardim',()=>{
  const list=habitCandidates({xp:5000,period:'dia',currentPlace:'jardim',profile:{traits:traits('curious')},preference:{id:'plant-carer'}});
  assert.equal(list[0]?.id,'cuidar-planta');
});

test('preferência tree-explorer faz árvore vencer microdecisão do Jardim',()=>{
  const list=habitCandidates({xp:5000,period:'dia',currentPlace:'jardim',profile:{traits:traits('caring')},preference:{id:'tree-explorer'}});
  assert.equal(list[0]?.id,'olhar-arvore');
});

test('microdecisão continua determinística no mesmo contexto',()=>{
  const input={xp:5000,period:'dia',currentPlace:'jardim',day:'2026-10-08',profile:{traits:traits('curious')},preference:{id:'plant-carer'}};
  assert.equal(dailyHabit(input)?.id,dailyHabit(input)?.id);
});

test('sem preferência, regra anterior continua válida',()=>{
  const list=habitCandidates({xp:5000,period:'dia',currentPlace:'jardim',profile:{traits:traits('caring')}});
  assert.ok(['cuidar-planta','olhar-arvore'].includes(list[0]?.id));
});
