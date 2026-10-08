import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyHabit, habitCandidates, habitSeenId } from '../src/shared/world-habits.js';

const profile=(trait)=>({
  traits:['curious','adventurous','artist','caring'].map((id)=>({id,points:id===trait?5:0})),
  actions:{},
  memories:[]
});

test('hábito respeita lugar e horário',()=>{
  const h=dailyHabit({xp:5000,period:'noite',currentPlace:'observatorio',profile:profile('curious'),day:'2026-10-08'});
  assert.equal(h?.id,'olhar-ceu');
  assert.equal(h?.objectId,'sceneTelescope');
});

test('perfil cuidador favorece cuidado no Jardim',()=>{
  const list=habitCandidates({xp:5000,period:'dia',currentPlace:'jardim',profile:profile('caring'),day:'2026-10-08'});
  assert.equal(list[0]?.id,'cuidar-planta');
});

test('Parque não tenta rever Tesouro sem Tesouro',()=>{
  const list=habitCandidates({xp:5000,period:'dia',currentPlace:'parque',profile:profile('curious'),treasures:[]});
  assert.ok(list.every((h)=>h.id!=='rever-tesouro'));
});

test('favorito aumenta afinidade do hábito sem criar recompensa',()=>{
  const list=habitCandidates({xp:5000,period:'tarde',currentPlace:'leitura',profile:profile('artist'),favorite:{id:'leitura'}});
  assert.ok(list[0].score>=5);
  assert.equal('reward' in list[0],false);
});

test('id visto é separado por dia e período',()=>{
  const h={id:'olhar-ceu'};
  assert.notEqual(habitSeenId('2026-10-08','dia',h),habitSeenId('2026-10-08','noite',h));
});
