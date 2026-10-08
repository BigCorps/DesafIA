import test from 'node:test';
import assert from 'node:assert/strict';
import { patternReaction } from '../src/shared/world-pattern-reactions.js';

test('cada padrão conhecido gera reação própria',()=>{
  const ids=['sky-watcher','garden-keeper','story-seeker','treasure-keeper','home-lover'];
  for(const id of ids){
    const r=patternReaction({id},{id:'x',objectId:'sceneRug'},'Pipo');
    assert.equal(r?.patternId,id);
    assert.ok(r?.motion);
    assert.ok(r?.text);
    assert.ok(r?.sceneEffect);
    assert.ok(Array.isArray(r?.burst));
  }
});

test('reação preserva o alvo do hábito',()=>{
  const r=patternReaction({id:'garden-keeper'},{id:'cuidar-planta',objectId:'scenePlant'},'Pipo');
  assert.equal(r.objectId,'scenePlant');
});

test('padrão desconhecido não inventa reação',()=>{
  assert.equal(patternReaction({id:'nao-existe'},{objectId:'sceneRug'},'Pipo'),null);
});

test('reação não contém recompensa',()=>{
  const r=patternReaction({id:'sky-watcher'},{objectId:'sceneTelescope'},'Pipo');
  assert.equal('reward' in r,false);
  assert.doesNotMatch(r.text,/ganhe|prêmio|estrela de prêmio|missão/i);
});
