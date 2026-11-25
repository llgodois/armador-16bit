// =====================================================================
//  Posições da meia quadra (cesta em x=240, y=74). Usadas pelo spacing,
//  pela movimentação sem bola e pelas jogadas.
// =====================================================================
export const ROLES = ['PG', 'SG', 'SF', 'PF', 'C'];

export const SLOTS = {
  cornerL: { x: 66, y: 66 },
  cornerR: { x: 414, y: 66 },
  wingL: { x: 108, y: 158 },
  wingR: { x: 372, y: 158 },
  slotL: { x: 186, y: 204 },
  slotR: { x: 294, y: 204 },
  top: { x: 240, y: 214 },
  blockL: { x: 214, y: 94 },
  blockR: { x: 266, y: 94 },
  elbowL: { x: 206, y: 136 },
  elbowR: { x: 274, y: 136 },
  dunkerL: { x: 180, y: 80 },
  dunkerR: { x: 300, y: 80 },
  rim: { x: 240, y: 96 },
};

// Vagas de perímetro em ordem (vizinhos = adjacentes na lista).
export const PERIMETER = ['cornerL', 'wingL', 'slotL', 'top', 'slotR', 'wingR', 'cornerR'];
export const INSIDE = ['blockL', 'blockR', 'dunkerL', 'dunkerR', 'elbowL', 'elbowR'];

// Formação base "4 abertos + 1 dentro".
export const BASE_SLOTS = { PG: 'top', SG: 'wingR', SF: 'wingL', PF: 'cornerL', C: 'blockR' };

// Espelha o nome de uma vaga (L <-> R).
export const mirrorSlot = (name) => (name.endsWith('L') ? name.slice(0, -1) + 'R' : name.endsWith('R') ? name.slice(0, -1) + 'L' : name);
