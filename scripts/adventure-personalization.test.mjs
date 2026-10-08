import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizedAdventureIntro, personalizedAdventureResult } from '../src/shared/adventure-personalization.js';
const adventure={intro:'Uma aventura começou.'};
const choice={result:'Encontramos algo.',discovery:{category:'ceu'}};
test('intro muda apenas o texto apresentado',()=>{const text=personalizedAdventureIntro(adventure,{preference:{id:'star-seeker'},petName:'Pipo'});assert.match(text,/Pipo/);assert.match(text,/Uma aventura começou/);});
test('resultado preserva o resultado base',()=>{const text=personalizedAdventureResult(choice,{preference:{id:'comet-chaser'},petName:'Pipo'});assert.match(text,/Encontramos algo/);assert.match(text,/céu/);});
test('sem preferência mantém conteúdo base',()=>{assert.equal(personalizedAdventureIntro(adventure,{}),adventure.intro);assert.equal(personalizedAdventureResult(choice,{}),choice.result);});