import { levelOf } from './progression.js';

export const WORLD_PLACES = [
  {
    id:'colina', icon:'🏡', title:'Colina do Pipo', level:1,
    short:'Nosso cantinho principal.',
    speech:'Voltamos para o nosso cantinho! 💜',
    objects:['sceneRug','sceneLamp','sceneCushion','sceneLittleHouse','sceneTreasure']
  },
  {
    id:'parque', icon:'🎠', title:'Parque', level:2,
    short:'Jogos, medalhas e Tesouros do Parque.',
    speech:'Chegamos ao Parque! Será que temos algum tesouro por aqui? 🎮',
    objects:['sceneRug','sceneTreasure']
  },
  {
    id:'leitura', icon:'📚', title:'Cantinho de Leitura', level:4,
    short:'Um lugar quietinho para histórias e imaginação.',
    speech:'Shhh… acho que tem uma história esperando por nós. 📚',
    objects:['sceneBooks','sceneLamp','sceneCushion']
  },
  {
    id:'jardim', icon:'🌻', title:'Jardim', level:5,
    short:'Árvore, flores e plantinhas para observar.',
    speech:'Olha o jardim! Vamos ver o que mudou por aqui. 🌱',
    objects:['scenePlant','sceneTree','sceneFlowers']
  },
  {
    id:'observatorio', icon:'🔭', title:'Observatório', level:7,
    short:'Um lugar para olhar o céu e fazer descobertas.',
    speech:'Chegamos ao Observatório. Vou procurar uma estrela diferente! ✨',
    objects:['sceneTelescope','sceneLamp']
  }
];

export function worldPlaceById(id) {
  return WORLD_PLACES.find((place)=>place.id===id) || WORLD_PLACES[0];
}

export function unlockedWorldPlaces(xp=0) {
  const level=levelOf(xp);
  return WORLD_PLACES.filter((place)=>level>=place.level);
}

export function isWorldPlaceUnlocked(id,xp=0) {
  const place=worldPlaceById(id);
  return levelOf(xp)>=place.level;
}

export function normalizeWorldPlace(id,xp=0) {
  return isWorldPlaceUnlocked(id,xp) ? worldPlaceById(id).id : 'colina';
}

export function placeShowsObject(placeId, objectId) {
  return worldPlaceById(placeId).objects.includes(objectId);
}
