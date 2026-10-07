import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVENTURES,
  DISCOVERIES,
  adventureForDay,
  collectedDiscoveries,
  discoveryById,
  findAdventureChoice
} from '../src/shared/adventures.js';

test('catálogo inicial tem aventuras com duas escolhas e descobertas únicas', () => {
  assert.equal(ADVENTURES.length, 8);
  assert.equal(DISCOVERIES.length, 16);
  assert.equal(new Set(DISCOVERIES.map((item) => item.id)).size, DISCOVERIES.length);
  for (const adventure of ADVENTURES) assert.equal(adventure.choices.length, 2);
});

test('aventura do dia é determinística e prioriza conteúdo ainda não descoberto', () => {
  const first = adventureForDay('2026-10-07', []);
  const second = adventureForDay('2026-10-07', []);
  assert.equal(first.id, second.id);

  const discovered = first.choices.map((choice) => ({ id: choice.discovery.id }));
  const next = adventureForDay('2026-10-07', discovered);
  assert.notEqual(next.id, first.id);
});

test('escolhas e álbum usam apenas o catálogo conhecido', () => {
  const adventure = ADVENTURES[0];
  const choice = adventure.choices[0];
  assert.equal(findAdventureChoice(adventure.id, choice.id)?.discovery.id, choice.discovery.id);
  assert.equal(discoveryById(choice.discovery.id)?.name, choice.discovery.name);
  assert.equal(collectedDiscoveries([{ id: choice.discovery.id, first_found_at: '2026-10-07T00:00:00Z' }]).length, 1);
});
