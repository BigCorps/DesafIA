import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteSuggestion, shouldSuggestFavorite } from '../src/shared/favorite-suggestion.js';

test('não sugere sem favorito claro',()=>{
  assert.equal(favoriteSuggestion({favorite:null,day:'2026-10-08'}),null);
  assert.equal(shouldSuggestFavorite({favorite:null,day:'2026-10-08'}),false);
});

test('fala muda quando já está no lugar favorito',()=>{
  const favorite={id:'jardim'};
  const away=favoriteSuggestion({favorite,currentPlace:'colina',petName:'Pipo',day:'2026-10-08'});
  const here=favoriteSuggestion({favorite,currentPlace:'jardim',petName:'Pipo',day:'2026-10-08'});
  assert.equal(away.samePlace,false);
  assert.equal(here.samePlace,true);
  assert.match(away.text,/Jardim/);
  assert.notEqual(away.text,here.text);
});

test('decisão de sugerir é determinística por dia e favorito',()=>{
  const input={favorite:{id:'leitura'},day:'2026-10-08'};
  assert.equal(shouldSuggestFavorite(input),shouldSuggestFavorite(input));
});

test('sugestão não contém recompensa ou obrigação',()=>{
  const s=favoriteSuggestion({favorite:{id:'observatorio'},currentPlace:'colina',petName:'Pipo',day:'2026-10-08'});
  assert.equal('reward' in s,false);
  assert.doesNotMatch(s.text,/ganhe|prêmio|missão|obrig/i);
});
