// Os n jogadores da lista mais próximos de um ponto (ignora desequilibrados).
export function nearestN(list, point, n) {
  return list
    .filter((p) => p.stun <= 0)
    .map((p) => ({ p, d: Math.hypot(p.x - point.x, p.y - point.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((e) => e.p);
}
