import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES, GAME_IDS, FREE_GAME_IDS, PLUS_GAME_IDS,
  gameRequiresPlus, parkTreasures
} from '../src/games/registry.js';

test('catálogo mantém 10 jogos grátis e adiciona 6 jogos Plus', () => {
  assert.equal(GAMES.length, 16);
  assert.equal(FREE_GAME_IDS.length, 10);
  assert.deepEqual(PLUS_GAME_IDS, ['labirinto','constelacoes','ritmo','quebracabeca','robo','cozinha']);
  assert.equal(new Set(GAME_IDS).size, GAME_IDS.length);
});

test('cada jogo Plus tem coleção própria e lazy load', () => {
  for (const id of PLUS_GAME_IDS) {
    const game=GAMES.find((g)=>g.id===id);
    assert.equal(gameRequiresPlus(id), true);
    assert.ok(game.collectible?.icon);
    assert.ok(game.collectible?.title);
    assert.equal(typeof game.load, 'function');
  }
  assert.equal(gameRequiresPlus('memoria'), false);
});

test('Tesouros do Parque são derivados dos recordes e não de nova economia', () => {
  assert.equal(parkTreasures({}).length, 0);
  const one=parkTreasures({labirinto:300});
  assert.equal(one.length,1);
  assert.equal(one[0].gameId,'labirinto');
  assert.equal(one[0].title,'Mapa Secreto');
  assert.equal(one[0].medal,1);
  const all=parkTreasures({
    labirinto:1200,constelacoes:1800,ritmo:2200,
    quebracabeca:1700,robo:1900,cozinha:1900
  });
  assert.equal(all.length,6);
  assert.ok(all.every((item)=>item.medal===3));
});
