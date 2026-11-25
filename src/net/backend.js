// =====================================================================
//  BACKEND — perfis (nome + PIN), moedas, jogadores desbloqueados e ranking.
//  Online: Supabase (REST/PostgREST, sem biblioteca extra).
//  Offline (sem configuração ou sem internet): localStorage deste navegador.
//  O PIN nunca é salvo: guardamos só um hash SHA-256 (nome + PIN).
// =====================================================================
import { SUPABASE } from './config.js';

const LOCAL_PROFILES = 'armador_perfis';
const LOCAL_RANKING = 'armador_ranking';
const LAST_NAME = 'armador_ultimo_nome';

export const isOnline = () => !!(SUPABASE.url && SUPABASE.anonKey);

const readLS = (k, def) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? def;
  } catch {
    return def;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export const lastName = () => readLS(LAST_NAME, '');
export const knownNames = () => Object.keys(readLS(LOCAL_PROFILES, {}));

export async function hashPin(name, pin) {
  const data = new TextEncoder().encode(`armador|${name.toUpperCase()}|${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE.anonKey,
    'Content-Type': 'application/json',
  };
  // chave antiga (JWT "eyJ...") também vai no Authorization; a nova (sb_publishable_...) só no apikey
  if (!SUPABASE.anonKey.startsWith('sb_')) headers.Authorization = `Bearer ${SUPABASE.anonKey}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE.url.replace(/\/$/, '')}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

const blank = (name, pinHash) => ({ name, pin_hash: pinHash, coins: 0, unlocked: [], best: 0, games: 0 });

// Entra (ou cria a conta se o nome é novo). Retorna { ok, profile, created, error, offline }.
export async function login(rawName, pin) {
  const name = rawName.trim().toUpperCase();
  if (name.length < 2) return { ok: false, error: 'APELIDO COM 2 LETRAS OU MAIS' };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'O PIN TEM 4 NUMEROS' };
  const pinHash = await hashPin(name, pin);
  writeLS(LAST_NAME, name);
  if (isOnline()) {
    try {
      const rows = await rest(`players?name=eq.${encodeURIComponent(name)}&select=*`);
      if (rows.length) {
        if (rows[0].pin_hash !== pinHash) return { ok: false, error: 'PIN ERRADO' };
        return { ok: true, profile: rows[0] };
      }
      const created = await rest('players', { method: 'POST', body: blank(name, pinHash), prefer: 'return=representation' });
      return { ok: true, profile: created[0], created: true };
    } catch (e) {
      return { ok: false, error: 'SEM CONEXAO COM O SERVIDOR', detail: e.message };
    }
  }
  const all = readLS(LOCAL_PROFILES, {});
  if (all[name]) {
    if (all[name].pin_hash !== pinHash) return { ok: false, error: 'PIN ERRADO' };
    return { ok: true, profile: all[name], offline: true };
  }
  all[name] = blank(name, pinHash);
  writeLS(LOCAL_PROFILES, all);
  return { ok: true, profile: all[name], created: true, offline: true };
}

// Salva moedas / desbloqueados / recorde do perfil.
export async function saveProfile(p) {
  const patch = { coins: p.coins, unlocked: p.unlocked, best: p.best, games: p.games };
  if (isOnline()) {
    try {
      await rest(`players?name=eq.${encodeURIComponent(p.name)}`, { method: 'PATCH', body: patch });
      return true;
    } catch {
      return false;
    }
  }
  const all = readLS(LOCAL_PROFILES, {});
  all[p.name] = { ...all[p.name], ...patch };
  writeLS(LOCAL_PROFILES, all);
  return true;
}

export async function submitScore(entry) {
  const row = { name: entry.name, score: entry.score, baskets: entry.baskets, assists: entry.assists, pg: entry.pg };
  if (isOnline()) {
    try {
      await rest('scores', { method: 'POST', body: row });
      return true;
    } catch {
      return false;
    }
  }
  const list = readLS(LOCAL_RANKING, []);
  list.push({ ...row, created_at: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  writeLS(LOCAL_RANKING, list.slice(0, 100));
  return true;
}

export async function topScores(limit = 10) {
  if (isOnline()) {
    try {
      return await rest(`scores?select=name,score,baskets,assists,pg,created_at&order=score.desc,created_at.asc&limit=${limit}`);
    } catch {
      return null;
    }
  }
  return readLS(LOCAL_RANKING, []).slice(0, limit);
}
