import { levelOf } from './progression.js';
import { companionScope } from './companion-journal.js';

const PLACES = ['colina', 'jardim', 'leitura', 'observatorio', 'parque'];
const EVENTS = ['observatorio-ceu', 'observatorio-cometa'];
const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(12, Number(value))) : 0;
const tier = (value) => value >= 6 ? 3 : value >= 3 ? 2 : value >= 1 ? 1 : 0;

// Decorative only: never modifies progression, rewards or permissions.
export function worldVisualState({ xp = 0, actions = {}, profile = {}, treasures = [], seenEvents = [], previous = {} } = {}) {
  previous = previous && typeof previous === 'object' ? previous : {};
  const seen = [...new Set([...(Array.isArray(previous.seenEvents) ? previous.seenEvents : []),
    ...(Array.isArray(seenEvents) ? seenEvents : [])].filter((id) => EVENTS.includes(id)))];
  const memories = Array.isArray(profile.memories) ? profile.memories : [];
  const stories = memories.filter((m) => ['found:marcador_dourado', 'found:dragao_papel'].includes(m?.id)).length;
  const level = levelOf(xp);
  const derived = {
    colina: level >= 9 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : tier(count(actions.hug)),
    jardim: tier(count(actions.scenePlant) + count(actions.sceneTree)),
    leitura: tier(count(actions.sceneBooks) + stories),
    observatorio: tier(count(actions.sceneTelescope) + seen.length),
    parque: Math.min(3, new Set((Array.isArray(treasures) ? treasures : []).map((t) => t?.gameId).filter(Boolean)).size)
  };
  return {
    stages: Object.fromEntries(PLACES.map((id) => [id, Math.max(derived[id], Math.min(3, Math.floor(count(previous.stages?.[id]))))])),
    seenEvents: seen
  };
}

export function createWorldVisualMemory(storage) {
  const volatile = new Map();
  const unsaved = new Set();
  return {
    observe(snapshot, context, seenEvents = []) {
      const scope = companionScope(snapshot);
      if (!scope) return worldVisualState(context);
      const key = `desafia-world-visual-v1:${scope}`;
      let previous = volatile.get(key) || {};
      try { if(!unsaved.has(key))previous = JSON.parse(storage.getItem(key) || '{}'); } catch { /* session fallback */ }
      // A reset of normal/QA storage also resets this decorative state.
      const next = worldVisualState({ ...context, previous, seenEvents });
      try { storage.setItem(key, JSON.stringify(next)); unsaved.delete(key); } catch { unsaved.add(key); /* no runtime failure on quota */ }
      volatile.set(key, next);
      return next;
    }
  };
}
