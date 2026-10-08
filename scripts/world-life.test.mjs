import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_DETAILS,
  worldStage,
  unlockedWorldDetails,
  dominantTrait,
  worldRoutineCandidates,
  chooseWorldRoutine,
  worldMoment
} from '../src/shared/world-life.js';

test('mundo evolui por nível sem estado paralelo', () => {
  assert.equal(worldStage(0),'inicio');
  assert.equal(unlockedWorldDetails(0).map((x)=>x.id).includes('sceneRug'), true);
  assert.equal(unlockedWorldDetails(0).map((x)=>x.id).includes('scenePlant'), false);
  assert.ok(WORLD_DETAILS.length >= 9);
});

test('rotinas respeitam horário, nível e personalidade', () => {
  const profile={traits:[
    {id:'curious',points:7},
    {id:'caring',points:2}
  ]};
  assert.equal(dominantTrait(profile),'curious');
  const night=worldRoutineCandidates({xp:1400,period:'noite',profile,treasures:[]});
  assert.ok(night.some((r)=>r.id==='telescopio'));
  assert.ok(night.some((r)=>r.id==='almofada'));
  assert.ok(!night.some((r)=>r.id==='arvore'));
  assert.ok(['telescopio','leitura','tesouro','tapete','almofada','luz'].includes(chooseWorldRoutine({xp:1400,period:'noite',profile},0)?.id));
});

test('Tesouros do Parque e memórias alimentam o mundo sem nova persistência', () => {
  const treasure={icon:'🗺️',title:'Mapa Secreto'};
  const routines=worldRoutineCandidates({xp:5000,period:'dia',profile:{traits:[]},treasures:[treasure]});
  assert.ok(routines.some((r)=>r.id==='tesouro'&&r.treasure.title==='Mapa Secreto'));
  const moment=worldMoment({xp:5000,period:'dia',profile:{traits:[],memories:[]},treasures:[treasure]});
  assert.match(moment.text,/Mapa Secreto/);
});
