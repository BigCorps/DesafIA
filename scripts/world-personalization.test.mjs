import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizedWorldMoment, preferredPlaceAction } from '../src/shared/world-personalization.js';

const baseAction={id:'regar-jardim',icon:'💧',label:'Cuidar do jardim',objectId:'scenePlant',text:'base',motion:'wave'};

test('ação contextual muda alvo quando preferência aponta para árvore',()=>{
  const action=preferredPlaceAction(baseAction,{id:'tree-explorer'},'Pipo');
  assert.equal(action.label,'Procurar novidades');
  assert.equal(action.objectId,'sceneTree');
  assert.equal(action.preferenceId,'tree-explorer');
});

test('ação contextual mantém base sem preferência',()=>{
  assert.equal(preferredPlaceAction(baseAction,null,'Pipo'),baseAction);
});

test('momento do mundo usa padrão e preferência',()=>{
  const moment=personalizedWorldMoment(
    {icon:'🏡',title:'O mundo está crescendo',text:'base'},
    {pattern:{id:'garden-keeper',icon:'🌱',title:'Cuidador do Jardim'},preference:{id:'plant-carer',icon:'🌱',label:'Cuida da plantinha',text:'Ele cuida da planta.'},petName:'Pipo'}
  );
  assert.equal(moment.title,'Cuidador do Jardim · Cuida da plantinha');
  assert.match(moment.text,/Pipo/);
});

test('padrão sem preferência ainda personaliza sem criar recompensa',()=>{
  const moment=personalizedWorldMoment(
    {icon:'🏡',title:'O mundo está crescendo',text:'base'},
    {pattern:{id:'sky-watcher',icon:'🔭',title:'Observador do céu'},petName:'Pipo'}
  );
  assert.equal(moment.title,'Observador do céu');
  assert.equal('reward' in moment,false);
});
