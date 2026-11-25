// =====================================================================
//  Dados SEPARADOS do Armador 64 (importado PRIMEIRO no main3d.js).
//  - Supabase: tabelas players64 / scores64 (contas, moedas e ranking próprios)
//  - navegador: toda chave do localStorage ganha o prefixo "a64:" — carreira,
//    franquia, campeonato, controles, som e contas offline não se misturam
//    com os do 16-bit (que roda no mesmo site, então dividiria o mesmo armazenamento).
// =====================================================================
import { useTables } from '../net/backend.js';

useTables('64');

const PREFIX = 'a64:';
const S = Storage.prototype;
const { getItem, setItem, removeItem } = S;
const k = (key) => (String(key).startsWith(PREFIX) ? key : PREFIX + key);
S.getItem = function (key) {
  return getItem.call(this, k(key));
};
S.setItem = function (key, value) {
  return setItem.call(this, k(key), value);
};
S.removeItem = function (key) {
  return removeItem.call(this, k(key));
};
