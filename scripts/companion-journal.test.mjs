import test from 'node:test';
import assert from 'node:assert/strict';
import { observeCompanion, recordCompanionAction, companionProfile, companionScope, createCompanionJournal } from '../src/shared/companion-journal.js';
import { scopedQAStorage } from '../src/shared/qa-environment.js';
import { createQAState } from '../src/game/qa-state.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key), key: (i) => [...data.keys()][i],
    get length() { return data.size; }
  };
}
const a = { connected: true, playerId: '00000000-0000-0000-0000-000000000001' };
const b = { connected: true, playerId: '00000000-0000-0000-0000-000000000002' };

test('descobertas conhecidas formam traços e gostos determinísticos, sem afetar economia', () => {
  const snapshot = { xp: 250, wallet: 100, dailyBonusDay: '2026-10-07', adventure: { discoveries: [{ id: 'borboleta_azul' }, { id: 'dragao_papel' }, { id: 'unknown' }] } };
  const before = JSON.stringify(snapshot);
  const state = observeCompanion({}, snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(observeCompanion(state, snapshot), state);
  const profile = companionProfile(state);
  assert.equal(profile.traits.length, 4);
  assert.ok(profile.traits.some((t) => t.id === 'artist' && t.expression === 'Aparecendo'));
  assert.ok(profile.traits.some((t) => t.id === 'caring' && t.expression === 'Aparecendo'));
  assert.deepEqual(profile.likes.map((l) => l.id), ['books', 'plants']);
  for (const id of ['first_day', 'first_adventure', 'first_discovery', 'found:borboleta_azul', 'level:3']) assert.ok(state.memories.includes(id));
  assert.equal(state.discoveries.length, 2);
});

test('ausência ou snapshot mais baixo não apagam gostos, traços ou memórias', () => {
  let state = observeCompanion({}, { xp: 4500, adventure: { discoveries: ['coelho_lunar'] } });
  state = recordCompanionAction(state, 'hug', '2026-10-07');
  const profile = companionProfile(state);
  assert.deepEqual(companionProfile(observeCompanion(state, { xp: 0 })), profile);
  assert.ok(state.memories.includes('level:10'));
});

test('interações contribuem uma vez por tipo/dia e contadores ficam limitados', () => {
  let state = {};
  for (let i = 0; i < 100; i++) state = recordCompanionAction(state, 'hug', '2026-10-07');
  assert.equal(state.actions.hug, 1);
  assert.equal(companionProfile(state).likes.length, 0);
  state = recordCompanionAction(state, 'hug', '2026-10-08');
  assert.ok(companionProfile(state).likes.some((l) => l.id === 'company'));
  for (let i = 1; i <= 28; i++) state = recordCompanionAction(state, 'hug', `2026-11-${String(i).padStart(2, '0')}`);
  assert.equal(state.actions.hug, 12);
  assert.deepEqual(recordCompanionAction(state, '__proto__'), state);
  assert.deepEqual(recordCompanionAction(state, 'hug', 'invalid'), state);
});

test('diário separa jogadores, demonstração e conexão sem identidade', () => {
  const storage = memoryStorage();
  const journal = createCompanionJournal(storage);
  journal.observe({ ...a, xp: 250 });
  assert.ok(createCompanionJournal(storage).observe(a).memories.some((m) => m.id === 'level:3'));
  assert.equal(journal.observe(b).memories.length, 0);
  assert.equal(journal.observe({ connected: false }).memories.length, 0);
  assert.equal(companionScope({ connected: true }), null);
  assert.equal(journal.observe({ connected: true, playerId: '../secret', xp: 4500 }).memories.length, 0);
  assert.equal(storage.length, 3);
});

test('storage corrompido ou indisponível não interrompe o app', () => {
  const storage = memoryStorage();
  storage.setItem('desafia-companion-v1:local', '{bad');
  const journal = createCompanionJournal(storage);
  assert.equal(journal.observe({ connected: false }).traits.length, 4);
  const blocked = createCompanionJournal({ getItem() { return null; }, setItem() { throw new Error('quota'); } });
  blocked.observe({ connected: false, xp: 250 });
  assert.ok(blocked.observe({ connected: false }).memories.some((m) => m.id === 'level:3'));
  assert.doesNotThrow(() => companionProfile({ actions: { hug: -10 }, discoveries: 'bad', memories: ['<script>'], todayActions: null }));
  assert.equal(companionProfile({ memories: ['<script>'] }).memories.length, 0);
});

test('reset QA remove memórias isoladas sem atingir diário real', async () => {
  const storage = memoryStorage();
  const normal = createCompanionJournal(storage);
  normal.observe({ ...a, xp: 250 });
  const qaStorage = scopedQAStorage(storage);
  const qa = createQAState(qaStorage);
  const journal = createCompanionJournal(qaStorage);
  qa.progress('high');
  assert.ok(journal.observe(await qa.api.snapshot()).memories.length);
  qa.reset();
  assert.equal(journal.observe(await qa.api.snapshot()).memories.length, 0);
  assert.ok(normal.observe(a).memories.some((m) => m.id === 'level:3'));
});


test('estado remoto é autoritativo para interações e preserva memórias derivadas', () => {
  const storage = memoryStorage();
  const journal = createCompanionJournal(storage);
  const synced = {
    ...a,
    xp: 0,
    adventure: { discoveries: [] },
    companionJournal: {
      actions: { hug: 2 },
      action_day: '2026-10-07',
      today_actions: ['hug'],
      has_completed_day: true
    }
  };
  const profile = journal.observe(synced);
  assert.ok(profile.likes.some((like) => like.id === 'company'));
  assert.ok(profile.memories.some((memory) => memory.id === 'first_day'));

  const authoritativeReset = journal.observe({
    ...synced,
    companionJournal: {
      actions: { hug: 0 },
      action_day: '2026-10-07',
      today_actions: [],
      has_completed_day: true
    }
  });
  assert.ok(!authoritativeReset.likes.some((like) => like.id === 'company'));
  assert.ok(authoritativeReset.memories.some((memory) => memory.id === 'first_day'));
});
