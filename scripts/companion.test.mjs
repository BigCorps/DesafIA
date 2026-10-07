import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCompanionMood,
  companionMoodLabel,
  missionCompanionAction,
  worldCompanionAction
} from '../src/shared/companion.js';
import { petMarkup } from '../src/shared/pet.js';

test('humor nunca penaliza ausência e usa o contexto atual', () => {
  assert.equal(deriveCompanionMood({ missions: [] }, 'dia'), 'calm');
  assert.equal(deriveCompanionMood({ missions: [] }, 'noite'), 'sleepy');
  assert.equal(deriveCompanionMood({ missions: [{ status: 'todo' }] }, 'tarde'), 'curious');
});

test('missões concluídas geram orgulho ou animação', () => {
  assert.equal(deriveCompanionMood({ missions: [{ status: 'done' }] }, 'noite'), 'proud');
  assert.equal(deriveCompanionMood({ missions: [{ status: 'pending' }] }, 'dia'), 'excited');
  assert.equal(companionMoodLabel('proud'), '🌟 Orgulhoso');
});

test('reações de missão e do mundo são determinísticas e seguras', () => {
  assert.equal(missionCompanionAction({ icon: '📚', title: 'Ler juntos' }).objectId, 'sceneBooks');
  assert.equal(missionCompanionAction({ title: 'Beber água' }).objectId, 'scenePlant');
  assert.equal(worldCompanionAction('sceneTree', 'Lumi').motion, 'twirl');
  assert.match(worldCompanionAction('sceneTelescope', 'Lumi').text, /Lumi/);
});


test('membros animáveis preservam a característica curta original', () => {
  const svg = petMarkup('test');
  assert.match(svg, /class="pet-arm pet-arm-left"/);
  assert.match(svg, /class="pet-arm pet-arm-right"/);
  assert.match(svg, /class="pet-foot pet-foot-left"/);
  assert.match(svg, /class="pet-foot pet-foot-right"/);
  assert.match(svg, /class="limb" cx="29" cy="134" rx="10" ry="17"/);
  assert.match(svg, /class="limb" cx="171" cy="134" rx="10" ry="17"/);
  assert.match(svg, /class="foot" cx="72" cy="179" rx="17" ry="9"/);
  assert.match(svg, /class="foot" cx="128" cy="179" rx="17" ry="9"/);
});
