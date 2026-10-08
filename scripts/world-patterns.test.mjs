import test from 'node:test';
import assert from 'node:assert/strict';
import { worldPatterns, patternForHabit, patternedHabitText } from '../src/shared/world-patterns.js';

const traits=(active)=>['curious','adventurous','artist','caring'].map((id)=>({id,points:id===active?5:0}));

test('não cria padrão sem evidência suficiente',()=>{
  assert.deepEqual(worldPatterns({profile:{traits:traits('curious'),actions:{},memories:[]},treasures:[]}),[]);
});

test('telescópio + curiosidade formam observador do céu',()=>{
  const patterns=worldPatterns({profile:{traits:traits('curious'),actions:{sceneTelescope:2},memories:[]}});
  assert.equal(patterns[0]?.id,'sky-watcher');
});

test('cuidado repetido forma padrão do Jardim',()=>{
  const patterns=worldPatterns({profile:{traits:traits('caring'),actions:{scenePlant:2,sceneTree:1},memories:[]}});
  assert.equal(patterns[0]?.id,'garden-keeper');
});

test('exibe no máximo dois padrões',()=>{
  const profile={
    traits:traits('curious'),
    actions:{sceneTelescope:5,sceneBooks:5,scenePlant:5,sceneTree:3,hug:5},
    memories:[
      {id:'found:cometa_mirim',text:'céu'},
      {id:'found:marcador_dourado',text:'livro'},
      {id:'found:joaninha_soneca',text:'jardim'}
    ]
  };
  assert.equal(worldPatterns({profile,treasures:[{},{},{}]}).length,2);
});

test('padrão compatível refina a fala do hábito',()=>{
  const pattern={id:'sky-watcher'};
  assert.equal(patternForHabit({id:'olhar-ceu'},[pattern])?.id,'sky-watcher');
  assert.match(patternedHabitText({id:'olhar-ceu',text:'base'},pattern,'Pipo'),/costume/i);
});

test('hábito sem padrão mantém texto original',()=>{
  const habit={id:'dancinha-parque',text:'Dancinha'};
  assert.equal(patternedHabitText(habit,null,'Pipo'),'Dancinha');
});
