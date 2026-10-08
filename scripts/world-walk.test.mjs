import test from 'node:test';
import assert from 'node:assert/strict';
import { worldObjectTarget } from '../src/shared/world-walk.js';

test('Pipo se aproxima do objeto sem sair da cena',()=>{
  const left=worldObjectTarget({sceneWidth:390,petWidth:220,objectCenterX:35});
  const right=worldObjectTarget({sceneWidth:390,petWidth:220,objectCenterX:355});
  assert.ok(left.x>35&&left.x<195);
  assert.ok(right.x<355&&right.x>195);
  assert.equal(left.direction,'left');
  assert.equal(right.direction,'right');
});

test('alvo extremo continua dentro da área segura',()=>{
  const a=worldObjectTarget({sceneWidth:320,petWidth:220,objectCenterX:0});
  const b=worldObjectTarget({sceneWidth:320,petWidth:220,objectCenterX:320});
  assert.ok(a.x>=79);
  assert.ok(b.x<=241);
});

test('objeto central mantém deslocamento mínimo',()=>{
  const t=worldObjectTarget({sceneWidth:400,petWidth:200,objectCenterX:200});
  assert.equal(t.x,200);
  assert.equal(t.direction,'center');
  assert.equal(t.distance,0);
});
