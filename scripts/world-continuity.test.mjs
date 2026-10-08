import test from 'node:test';
import assert from 'node:assert/strict';
import { worldContinuityLine } from '../src/shared/world-continuity.js';
test('conecta lugar anterior ao atual',()=>{const line=worldContinuityLine('jardim','observatorio',{preference:{id:'star-seeker'},petName:'Pipo'});assert.match(line,/Jardim/);assert.match(line,/estrela/i);});
test('não cria continuidade no mesmo lugar',()=>{assert.equal(worldContinuityLine('jardim','jardim',{petName:'Pipo'}),'');});
test('fallback ainda referencia os dois lugares',()=>{const line=worldContinuityLine('parque','leitura',{petName:'Pipo'});assert.match(line,/Parque/);assert.match(line,/Cantinho de Leitura/);});