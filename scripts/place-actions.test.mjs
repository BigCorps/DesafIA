import test from 'node:test';
import assert from 'node:assert/strict';
import { placeActionFor } from '../src/shared/place-actions.js';

test('cada lugar oferece uma ação própria',()=>{
  const ids=['colina','parque','leitura','jardim','observatorio'];
  const actions=ids.map((id)=>placeActionFor(id));
  assert.equal(new Set(actions.map((a)=>a.id)).size,5);
  assert.ok(actions.every((a)=>a.label&&a.objectId&&a.text&&a.motion));
});

test('Parque usa Tesouro quando já existe um',()=>{
  const noTreasure=placeActionFor('parque',{treasures:[]});
  assert.equal(noTreasure.objectId,'sceneRug');
  const withTreasure=placeActionFor('parque',{treasures:[{icon:'🗺️',title:'Mapa Secreto'}]});
  assert.equal(withTreasure.objectId,'sceneTreasure');
  assert.match(withTreasure.text,/Mapa Secreto/);
});

test('Leitura e Observatório variam a descoberta sem texto aberto',()=>{
  const a=placeActionFor('leitura',{index:0});
  const b=placeActionFor('leitura',{index:1});
  const c=placeActionFor('observatorio',{index:0});
  const d=placeActionFor('observatorio',{index:1});
  assert.notEqual(a.text,b.text);
  assert.notEqual(c.text,d.text);
});

test('Colina respeita o horário',()=>{
  assert.equal(placeActionFor('colina',{period:'dia'}).label,'Brincar no cantinho');
  assert.equal(placeActionFor('colina',{period:'noite'}).label,'Descansar um pouco');
});


test('todas as ações próprias fazem o ambiente reagir',()=>{
  const ids=['colina','parque','leitura','jardim','observatorio'];
  const actions=ids.map((id)=>placeActionFor(id,{treasures:[{icon:'🗺️',title:'Mapa Secreto'}]}));
  assert.ok(actions.every((a)=>a.sceneEffect?.kind));
  assert.ok(actions.every((a)=>Array.isArray(a.sceneEffect?.chars)&&a.sceneEffect.chars.length>0));
});
