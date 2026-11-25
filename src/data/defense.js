// =====================================================================
//  PLAYBOOK DEFENSIVO — esquemas que qualquer time pode usar.
//   pnr: como a defesa reage ao pick and roll
//     drop   o marcador do bloqueador recua para proteger o garrafão
//            (leitura: arremesso de meia distância)
//     hedge  o marcador do bloqueador sai no armador e depois volta
//            (leitura: passe rápido para quem rola)
//     blitz  dobra no armador no bloqueio (leitura: passe para quem rola/abre)
//     switch troca a marcação (leitura: ataque o desencontro de tamanho)
//   zone       defesa por zona 2-3
//   press      pressão e dobra já no campo de defesa
//   doublePG   dobra sempre no armador com a bola
// Na defesa: teclas 1..6 ou TAB (playbook). O adversário escolhe sozinho.
// =====================================================================
export const DEF_SCHEMES = [
  { id: 'man', name: 'Individual', desc: 'Cada um no seu homem; no bloqueio o pivo recua (drop)', pnr: 'drop' },
  { id: 'switch', name: 'Individual com trocas', desc: 'Troca a marcacao em todo bloqueio', pnr: 'switch' },
  { id: 'hedge', name: 'Hedge no pick and roll', desc: 'Pivo sai no armador para frear e volta', pnr: 'hedge' },
  { id: 'blitz', name: 'Dobrar no armador', desc: 'Dobra o armador sempre que ele tem a bola', pnr: 'blitz', doublePG: true },
  { id: 'zone', name: 'Zona 2-3', desc: 'Cada um protege uma area e fecha o garrafao', pnr: 'drop', zone: true },
  { id: 'press', name: 'Pressao quadra toda', desc: 'Marca e dobra desde o campo de defesa', pnr: 'switch', press: true },
];

export const schemeById = (id) => DEF_SCHEMES.find((s) => s.id === id) || DEF_SCHEMES[0];

// Posições da zona 2-3 (coordenadas canônicas) por posição do defensor.
export const ZONE_SPOTS = {
  PG: { x: 206, y: 182 },
  SG: { x: 274, y: 182 },
  SF: { x: 126, y: 104 },
  C: { x: 240, y: 92 },
  PF: { x: 354, y: 104 },
};
