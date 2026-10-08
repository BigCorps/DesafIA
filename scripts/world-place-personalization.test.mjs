import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizedPlaceArrival, personalizedPlaceShort } from '../src/shared/world-place-personalization.js';

const place={id:'jardim',short:'Árvore, flores e plantinhas para observar.',speech:'Olha o jardim!'};

test('chegada usa preferência quando existe',()=>{
  assert.match(personalizedPlaceArrival(place,{id:'plant-carer'},'Pipo'),/plantinha/i);
});

test('subtítulo do mapa usa preferência quando existe',()=>{
  assert.match(personalizedPlaceShort(place,{id:'tree-explorer'}),/árvore/i);
});

test('sem preferência preserva textos originais',()=>{
  assert.equal(personalizedPlaceArrival(place,null,'Pipo'),place.speech);
  assert.equal(personalizedPlaceShort(place,null),place.short);
});

test('preferência desconhecida não inventa texto',()=>{
  assert.equal(personalizedPlaceShort(place,{id:'x'}),place.short);
});
