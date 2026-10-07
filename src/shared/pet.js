import { stageOf } from './progression.js';

export const PET_NAMES = ['Pipo', 'Lumi', 'Nino', 'Zupi'];

export const COLORS = {
  rosa:    { name: 'Rosa',    g: ['#FFBCC8', '#FF8FA3', '#EE6684'], limb: '#F27A93', foot: '#E35C7A', belly: '#FFE4EA', cheek: '#FF5577' },
  azul:    { name: 'Azul',    g: ['#C4E6FF', '#72B9FF', '#4A8FE6'], limb: '#62A8F2', foot: '#3F7FD6', belly: '#E6F4FF', cheek: '#FF7A9A' },
  verde:   { name: 'Verde',   g: ['#CFF3CD', '#7FD67F', '#4DB356'], limb: '#69C46E', foot: '#3F9E48', belly: '#EAFBE8', cheek: '#FF7A8A' },
  amarelo: { name: 'Amarelo', g: ['#FFF1B8', '#FFD24D', '#F2AE1E'], limb: '#F5C23A', foot: '#E09E12', belly: '#FFF8DC', cheek: '#FF8A65' },
  lilas:   { name: 'Lilás',   g: ['#E0D6FF', '#AB8FFF', '#7F62E8'], limb: '#987AF5', foot: '#6E52D6', belly: '#F2EDFF', cheek: '#FF7AAE' }
};

export const HATS = [
  { id: 'none', em: '✨', name: 'Sem chapéu', level: 1 },
  { id: 'bone', em: '🧢', name: 'Boné', level: 2 },
  { id: 'festa', em: '🥳', name: 'Festa', level: 3 },
  { id: 'gorro', em: '🧶', name: 'Gorro', level: 4 },
  { id: 'coroa', em: '👑', name: 'Coroa', level: 6 },
  { id: 'mago', em: '🧙', name: 'Mago', level: 9 }
];

export const ACCS = [
  { id: 'none', em: '✨', name: 'Sem acessório', level: 1 },
  { id: 'oculos', em: '👓', name: 'Óculos', level: 2 },
  { id: 'laco', em: '🎀', name: 'Laço', level: 3 },
  { id: 'gravata', em: '🦋', name: 'Gravatinha', level: 5 }
];

export const DEFAULT_LOOK = { color: 'rosa', hat: 'none', acc: 'none' };

let uid = 0;
export function petMarkup(prefix) {
  const p = prefix || `pet-${++uid}`;
  return `
<svg class="pet-svg" viewBox="0 0 200 200" data-stage="1" data-hat="none" data-acc="none" aria-hidden="true" focusable="false">
  <defs><radialGradient id="${p}-body" cx="36%" cy="30%" r="78%"><stop class="g0" offset="0" stop-color="#FFBCC8"/><stop class="g1" offset=".58" stop-color="#FF8FA3"/><stop class="g2" offset="1" stop-color="#EE6684"/></radialGradient></defs>
  <ellipse cx="100" cy="190" rx="56" ry="7" fill="#000" opacity=".13"/>
  <path d="M100 48 C98 36 102 28 100 16" stroke="#3FA86E" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M100 32 C88 21 75 24 70 31 C79 40 92 40 100 32Z" fill="#5CCB8A"/>
  <path class="grow-part s2" d="M100 25 C112 13 126 16 131 23 C123 33 108 33 100 25Z" fill="#76DDA0"/>
  <g class="grow-part s3"><circle cx="100" cy="7" r="6" fill="#FFD54A"/><circle cx="92" cy="13" r="6" fill="#FFD54A"/><circle cx="108" cy="13" r="6" fill="#FFD54A"/><circle cx="95" cy="21" r="6" fill="#FFD54A"/><circle cx="105" cy="21" r="6" fill="#FFD54A"/><circle cx="100" cy="15" r="5" fill="#FF8C42"/></g>
  <g class="pet-foot pet-foot-left"><ellipse class="foot" cx="72" cy="179" rx="17" ry="9" fill="#E35C7A"/></g><g class="pet-foot pet-foot-right"><ellipse class="foot" cx="128" cy="179" rx="17" ry="9" fill="#E35C7A"/></g>
  <g class="pet-arm pet-arm-left"><ellipse class="limb" cx="29" cy="134" rx="10" ry="17" fill="#F27A93" transform="rotate(22 29 134)"/></g><g class="pet-arm pet-arm-right"><ellipse class="limb" cx="171" cy="134" rx="10" ry="17" fill="#F27A93" transform="rotate(-22 171 134)"/></g>
  <path d="M100 44 C150 44 176 84 176 124 C176 162 146 182 100 182 C54 182 24 162 24 124 C24 84 50 44 100 44Z" fill="url(#${p}-body)"/>
  <ellipse class="belly" cx="100" cy="148" rx="46" ry="30" fill="#FFE4EA"/>
  <g class="eyes"><ellipse cx="76" cy="106" rx="10" ry="13" fill="#2A2350"/><circle cx="79.5" cy="101" r="4.2" fill="#fff"/><circle cx="73" cy="111.5" r="1.8" fill="#fff"/><ellipse cx="124" cy="106" rx="10" ry="13" fill="#2A2350"/><circle cx="127.5" cy="101" r="4.2" fill="#fff"/><circle cx="121" cy="111.5" r="1.8" fill="#fff"/></g>
  <g class="eyes-sleep" fill="none" stroke="#2A2350" stroke-width="4.5" stroke-linecap="round"><path d="M65 106 Q76 116 87 106"/><path d="M113 106 Q124 116 135 106"/></g>
  <ellipse class="cheek" cx="59" cy="127" rx="10" ry="6" fill="#FF5577" opacity=".45"/><ellipse class="cheek" cx="141" cy="127" rx="10" ry="6" fill="#FF5577" opacity=".45"/>
  <path class="mouth" d="M88 124 Q100 136 112 124" stroke="#2A2350" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <g class="acc acc-oculos"><circle cx="76" cy="106" r="18" fill="rgba(255,255,255,.22)" stroke="#2A2350" stroke-width="4"/><circle cx="124" cy="106" r="18" fill="rgba(255,255,255,.22)" stroke="#2A2350" stroke-width="4"/><path d="M94 104 Q100 98 106 104" stroke="#2A2350" stroke-width="4" fill="none"/></g>
  <g class="acc acc-laco" transform="translate(60 60) rotate(-22)"><path d="M0 0 L-17 -11 L-15 11Z" fill="#FF5FA2"/><path d="M0 0 L17 -11 L15 11Z" fill="#FF5FA2"/><circle r="5.5" fill="#FF8CC0"/></g>
  <g class="acc acc-gravata"><path d="M100 168 L83 158 L83 178Z" fill="#7B61FF"/><path d="M100 168 L117 158 L117 178Z" fill="#7B61FF"/><circle cx="100" cy="168" r="5.5" fill="#9C88FF"/></g>
  <g class="hat hat-bone" transform="translate(132 56) rotate(20)"><path d="M-24 0 C-24 -30 24 -30 24 0 Z" fill="#FF5A5F"/><path d="M8 -2 Q30 -4 42 2 Q40 8 8 6 Z" fill="#D63B40"/></g>
  <g class="hat hat-coroa" transform="translate(132 56) rotate(18)"><path d="M-22 0 L-25 -28 L-11 -14 L0 -32 L11 -14 L25 -28 L22 0 Z" fill="#FFD54A" stroke="#E0A800" stroke-width="2.5"/><circle cx="0" cy="-8" r="4" fill="#FF5A7A"/></g>
  <g class="hat hat-festa" transform="translate(132 56) rotate(20)"><path d="M-19 0 L0 -46 L19 0 Z" fill="#7B61FF"/><path d="M-12 -16 L11 -22 M-7 -30 L6 -33" stroke="#FFD54A" stroke-width="4"/><circle cy="-48" r="6" fill="#FFD54A"/></g>
  <g class="hat hat-gorro" transform="translate(132 56) rotate(18)"><path d="M-24 0 C-24 -32 24 -32 24 0 Z" fill="#3FBF9F"/><rect x="-27" y="-7" width="54" height="11" rx="5" fill="#2E9C80"/><circle cy="-27" r="8" fill="#fff"/></g>
  <g class="hat hat-mago" transform="translate(132 58) rotate(16)"><ellipse rx="31" ry="7" fill="#3B2F8F"/><path d="M-17 -3 Q-2 -40 10 -64 Q14 -40 17 -3 Z" fill="#4B3BB0"/><circle cx="-3" cy="-22" r="3" fill="#FFD54A"/><circle cx="7" cy="-38" r="2.5" fill="#FFD54A"/></g>
</svg>`;
}

export function applyLook(svg, look, xp) {
  if (!svg) return;
  const value = { ...DEFAULT_LOOK, ...(look || {}) };
  const color = COLORS[value.color] || COLORS.rosa;
  svg.querySelector('.g0')?.setAttribute('stop-color', color.g[0]);
  svg.querySelector('.g1')?.setAttribute('stop-color', color.g[1]);
  svg.querySelector('.g2')?.setAttribute('stop-color', color.g[2]);
  svg.querySelectorAll('.limb').forEach((e) => e.setAttribute('fill', color.limb));
  svg.querySelectorAll('.foot').forEach((e) => e.setAttribute('fill', color.foot));
  svg.querySelectorAll('.cheek').forEach((e) => e.setAttribute('fill', color.cheek));
  svg.querySelector('.belly')?.setAttribute('fill', color.belly);
  svg.dataset.hat = value.hat;
  svg.dataset.acc = value.acc;
  svg.dataset.stage = String(stageOf(xp));
}
