import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_PLACES,
  worldPlaceById,
  unlockedWorldPlaces,
  isWorldPlaceUnlocked,
  normalizeWorldPlace,
  placeShowsObject
} from '../src/shared/world-places.js';

test('lugares seguem a progressão da Casa',()=>{
  assert.equal(WORLD_PLACES.length,5);
  assert.deepEqual(unlockedWorldPlaces(0).map((p)=>p.id),['colina']);
  assert.equal(isWorldPlaceUnlocked('parque',100),true);
  assert.equal(isWorldPlaceUnlocked('leitura',100),false);
  assert.equal(isWorldPlaceUnlocked('jardim',700),true);
  assert.equal(isWorldPlaceUnlocked('observatorio',1350),true);
});

test('lugar bloqueado volta para a Colina',()=>{
  assert.equal(normalizeWorldPlace('observatorio',0),'colina');
  assert.equal(normalizeWorldPlace('observatorio',1350),'observatorio');
  assert.equal(worldPlaceById('inexistente').id,'colina');
});

test('cada lugar controla os objetos do próprio cenário',()=>{
  assert.equal(placeShowsObject('jardim','sceneTree'),true);
  assert.equal(placeShowsObject('jardim','sceneBooks'),false);
  assert.equal(placeShowsObject('leitura','sceneBooks'),true);
  assert.equal(placeShowsObject('parque','sceneTreasure'),true);
});
