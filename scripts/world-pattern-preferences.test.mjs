import test from 'node:test';
import assert from 'node:assert/strict';
import { patternPreference, patternPreferences, preferredPatternReaction } from '../src/shared/world-pattern-preferences.js';

const traits=(values={})=>['curious','adventurous','artist','caring'].map((id)=>({id,points:values[id]||0}));

test('Jardim diferencia cuidado da planta e exploração da árvore',()=>{
  const plant=patternPreference({id:'garden-keeper',placeId:'jardim'},{profile:{traits:traits({caring:4}),actions:{scenePlant:3,sceneTree:0},memories:[]}});
  const tree=patternPreference({id:'garden-keeper',placeId:'jardim'},{profile:{traits:traits({curious:4}),actions:{scenePlant:0,sceneTree:3},memories:[]}});
  assert.equal(plant?.id,'plant-carer');
  assert.equal(tree?.id,'tree-explorer');
});

test('Leitura pode preferir lembranças em vez de invenção',()=>{
  const preference=patternPreference({id:'story-seeker',placeId:'leitura'},{profile:{
    traits:traits({curious:2}),actions:{sceneBooks:1},
    memories:[{id:'found:marcador_dourado',text:'Quando encontramos o marcador'}]
  }});
  assert.equal(preference?.id,'memory-reader');
});

test('empate não inventa preferência',()=>{
  const preference=patternPreference({id:'garden-keeper',placeId:'jardim'},{profile:{traits:traits(),actions:{scenePlant:1,sceneTree:2},memories:[]}});
  assert.equal(preference,null);
});

test('preferências acompanham no máximo os padrões recebidos',()=>{
  const patterns=[{id:'sky-watcher',placeId:'observatorio'},{id:'garden-keeper',placeId:'jardim'}];
  assert.equal(patternPreferences(patterns,{profile:{traits:traits({curious:4}),actions:{sceneTelescope:2,scenePlant:2},memories:[]}}).length,2);
});

test('preferência refina reação sem criar recompensa',()=>{
  const base={id:'pattern-reaction:sky-watcher',text:'base',burst:['✨']};
  const reaction=preferredPatternReaction(base,{id:'comet-chaser'},'Pipo');
  assert.match(reaction.text,/céu/i);
  assert.equal(reaction.preferenceId,'comet-chaser');
  assert.equal('reward' in reaction,false);
});
