import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCompanionMood,
  companionMoodLabel,
  missionCompanionAction,
  worldCompanionAction
} from '../src/shared/companion.js';

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
