import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteWorldPlace, placeAffinities } from '../src/shared/world-favorite.js';

const baseProfile={
  traits:[
    {id:'curious',points:0},{id:'adventurous',points:0},{id:'artist',points:0},{id:'caring',points:0}
  ],
  actions:{sceneBooks:0,scenePlant:0,sceneTree:0,sceneTelescope:0,hug:0,highfive:0},
  memories:[]
};

test('não inventa favorito sem sinal suficiente',()=>{
  assert.equal(favoriteWorldPlace({xp:0,profile:baseProfile}),null);
});

test('interações reais podem tornar Jardim favorito',()=>{
  const profile={...baseProfile,actions:{...baseProfile.actions,scenePlant:3,sceneTree:2},traits:baseProfile.traits};
  assert.equal(favoriteWorldPlace({xp:5000,profile})?.id,'jardim');
});

test('Tesouros podem tornar Parque favorito',()=>{
  const treasures=[{gameId:'a'},{gameId:'b'},{gameId:'c'}];
  assert.equal(favoriteWorldPlace({xp:5000,profile:baseProfile,treasures})?.id,'parque');
});

test('empate forte não força favorito arbitrário',()=>{
  const profile={...baseProfile,actions:{...baseProfile.actions,sceneBooks:2,sceneTelescope:2}};
  assert.equal(favoriteWorldPlace({xp:5000,profile}),null);
});

test('lugar bloqueado não entra no cálculo',()=>{
  const profile={...baseProfile,actions:{...baseProfile.actions,sceneTelescope:12}};
  const affinities=placeAffinities({xp:0,profile});
  assert.deepEqual(affinities.map((x)=>x.id),['colina']);
});
