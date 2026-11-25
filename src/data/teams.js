// =====================================================================
//  TIMES E JOGADORES (inspirados na NBA, nomes parecidos mas não idênticos).
//  30 franquias atuais (15 Leste / 15 Oeste) + 1 versão HISTÓRICA de cada = 60 times.
//  Cada time tem 5 jogadores na ordem PG, SG, SF, PF, C. O PG é você.
//
//  P(nome, apelido, altura_cm, [3pts, meia, final, passe, veloc, defesa, rebote])
//  Ratings de 40 a 99. A altura muda o tamanho do sprite, o rebote, o toco
//  e a contestação de arremessos.
// =====================================================================
import { RATING } from '../config.js';

const KEYS = ['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'];
const P = (name, nick, cm, r) => ({ name, nick, cm, r: Object.fromEntries(KEYS.map((k, i) => [k, r[i]])) });
const COL = (jersey, dark, trim) => ({ jersey, dark, trim, shorts: jersey, shoes: trim });
const T = (id, conf, name, city, style, colors, players) => ({ id, conf, name, city, style, colors, players });

export const TEAMS = [
  // ------------------------------------------------------------- OESTE
  T('ondas', 'W', 'Warriors', 'Golden State', 'Chuva de 3 e muita movimentacao', COL('#1d5fd1', '#123f91', '#ffc72c'), [
    P('Stephen Curry', 'Chef', 188, [98, 92, 84, 88, 84, 62, 50]),
    P('Brandin Podziemski', 'Podz', 193, [82, 76, 74, 78, 78, 76, 60]),
    P('Jimmy Butler', 'Jimmy Buckets', 201, [74, 86, 88, 82, 78, 86, 68]),
    P('Draymond Green', 'Dray', 198, [64, 58, 64, 90, 68, 90, 78]),
    P('Al Horford', 'Big Al', 206, [82, 72, 66, 74, 50, 80, 76]),
  ]),
  T('astros', 'W', 'Lakers', 'Los Angeles', 'Showtime: estrelas e passes magicos', COL('#6a2fa0', '#46206b', '#fdb927'), [
    P('Luka Doncic', 'Luka Magic', 201, [88, 92, 90, 96, 72, 62, 82]),
    P('Austin Reaves', 'AR15', 196, [84, 82, 80, 82, 78, 68, 52]),
    P('LeBron James', 'King', 206, [80, 86, 92, 92, 82, 78, 80]),
    P('Rui Hachimura', 'Rui', 203, [84, 82, 78, 58, 74, 72, 62]),
    P('Deandre Ayton', 'DA', 213, [30, 74, 86, 58, 64, 74, 86]),
  ]),
  T('fenix', 'W', 'Suns', 'Phoenix', 'Meia distancia cirurgica', COL('#e56020', '#a5420f', '#2b1a5a'), [
    P('Devin Booker', 'Book', 196, [88, 95, 86, 86, 80, 68, 54]),
    P('Jalen Green', 'JG', 193, [82, 80, 88, 70, 94, 62, 52]),
    P('Dillon Brooks', 'Villain', 198, [80, 74, 70, 58, 74, 86, 52]),
    P("Royce O'Neale", 'Royce', 198, [84, 66, 64, 62, 70, 80, 62]),
    P('Mark Williams', 'Mark', 213, [10, 40, 84, 48, 62, 82, 88]),
  ]),
  T('trovoes', 'W', 'Thunder', 'Oklahoma City', 'Defesa sufocante e o melhor cavador de faltas', COL('#0a7ac4', '#065489', '#ef3b24'), [
    P('Shai Gilgeous-Alexander', 'SGA', 198, [84, 97, 94, 86, 90, 84, 58]),
    P('Luguentz Dort', 'Lu', 193, [82, 62, 72, 58, 82, 94, 52]),
    P('Jalen Williams', 'J-Dub', 196, [80, 88, 88, 82, 84, 86, 62]),
    P('Chet Holmgren', 'Chet', 216, [82, 80, 82, 66, 72, 92, 84]),
    P('Isaiah Hartenstein', 'Stein', 213, [20, 58, 80, 80, 56, 82, 92]),
  ]),
  T('cavaleiros', 'W', 'Mavericks', 'Dallas', 'Gigantes na defesa e um novato prodigio', COL('#0f5a98', '#0a3d68', '#b8c4ca'), [
    P('Kyrie Irving', 'Uncle Drew', 188, [90, 94, 94, 86, 86, 66, 48]),
    P('Klay Thompson', 'Klay', 198, [90, 84, 70, 62, 68, 72, 44]),
    P('Cooper Flagg', 'Flagg', 206, [74, 78, 84, 80, 82, 86, 74]),
    P('Anthony Davis', 'AD', 208, [64, 82, 92, 68, 74, 94, 90]),
    P('Dereck Lively II', 'Lively', 216, [10, 40, 86, 56, 62, 84, 88]),
  ]),
  T('pepitas', 'W', 'Nuggets', 'Denver', 'Pivo armador: tudo passa pelo garrafao', COL('#16305e', '#0d1d3a', '#fec524'), [
    P('Jamal Murray', 'Blue Arrow', 193, [86, 92, 86, 84, 80, 64, 52]),
    P('Christian Braun', 'CB', 198, [74, 72, 80, 60, 82, 82, 62]),
    P('Cam Johnson', 'Cam', 203, [88, 78, 72, 60, 72, 72, 56]),
    P('Aaron Gordon', 'AG', 203, [66, 70, 90, 70, 80, 86, 76]),
    P('Nikola Jokic', 'Joker', 211, [82, 94, 92, 99, 55, 72, 96]),
  ]),
  T('veleiros', 'W', 'Clippers', 'Los Angeles', 'Veteranos frios no meio da quadra', COL('#c8102e', '#8a0b1f', '#1d428a'), [
    P('James Harden', 'The Beard', 196, [88, 84, 88, 94, 72, 62, 62]),
    P('Bradley Beal', 'Beal', 193, [84, 86, 84, 74, 76, 62, 52]),
    P('Kawhi Leonard', 'The Klaw', 201, [86, 92, 86, 72, 76, 90, 68]),
    P('John Collins', 'JC', 206, [76, 74, 86, 52, 76, 72, 78]),
    P('Ivica Zubac', 'Zu', 213, [10, 50, 88, 56, 50, 84, 92]),
  ]),
  T('foguetes', 'W', 'Rockets', 'Houston', 'Atletas longos e rebote ofensivo', COL('#ce1141', '#8a0b2b', '#c4ced4'), [
    P('Amen Thompson', 'Amen', 201, [56, 62, 88, 76, 95, 94, 78]),
    P('Reed Sheppard', 'Reed', 188, [86, 76, 72, 78, 82, 64, 44]),
    P('Kevin Durant', 'KD', 211, [88, 97, 88, 76, 74, 80, 72]),
    P('Jabari Smith Jr.', 'Jabari', 211, [82, 74, 74, 52, 70, 84, 80]),
    P('Alperen Sengun', 'Sengun', 211, [60, 82, 90, 90, 58, 72, 90]),
  ]),
  T('ursos', 'W', 'Grizzlies', 'Memphis', 'Velocidade e gigantes no garrafao', COL('#5d76a9', '#12173f', '#f5b112'), [
    P('Ja Morant', 'Ja', 188, [70, 80, 96, 86, 99, 62, 58]),
    P('Ty Jerome', 'Ty', 196, [84, 82, 76, 80, 74, 72, 50]),
    P('Jaylen Wells', 'Wells', 201, [80, 72, 74, 58, 74, 76, 58]),
    P('Jaren Jackson Jr.', 'Trip J', 208, [80, 76, 80, 56, 70, 94, 74]),
    P('Zach Edey', 'Edey', 224, [10, 56, 90, 48, 40, 80, 94]),
  ]),
  T('lobos', 'W', 'Timberwolves', 'Minnesota', 'Defesa de elite e um ala explosivo', COL('#0c2340', '#071528', '#78be20'), [
    P('Mike Conley', 'Conley', 185, [84, 80, 72, 84, 70, 74, 44]),
    P('Anthony Edwards', 'Ant', 193, [88, 86, 94, 76, 92, 80, 62]),
    P('Jaden McDaniels', 'Jaden', 206, [76, 70, 76, 56, 78, 94, 60]),
    P('Julius Randle', 'Julius', 203, [74, 82, 88, 76, 68, 70, 82]),
    P('Rudy Gobert', 'Torre', 216, [10, 30, 86, 52, 52, 97, 94]),
  ]),
  T('pelicanos', 'W', 'Pelicans', 'New Orleans', 'Forca bruta no garrafao', COL('#0c2340', '#071528', '#b4975a'), [
    P('Jordan Poole', 'Poole', 193, [84, 80, 80, 74, 80, 54, 44]),
    P('Trey Murphy III', 'Trey', 203, [88, 80, 80, 58, 78, 72, 58]),
    P('Herbert Jones', 'Herb', 203, [74, 66, 72, 62, 76, 96, 58]),
    P('Zion Williamson', 'Zion', 198, [40, 74, 98, 76, 84, 66, 82]),
    P('Yves Missi', 'Yves', 211, [10, 40, 82, 48, 72, 82, 84]),
  ]),
  T('desbravadores', 'W', 'Trail Blazers', 'Portland', 'Jovens longos e defesa no perimetro', COL('#e03a3e', '#111111', '#ffffff'), [
    P('Jrue Holiday', 'Jrue', 193, [82, 82, 80, 82, 76, 92, 56]),
    P('Shaedon Sharpe', 'Shaedon', 196, [80, 80, 88, 60, 88, 66, 56]),
    P('Deni Avdija', 'Deni', 206, [78, 80, 86, 82, 78, 80, 76]),
    P('Jerami Grant', 'Jerami', 203, [80, 80, 80, 60, 74, 74, 58]),
    P('Donovan Clingan', 'Clingan', 218, [30, 44, 84, 60, 50, 88, 92]),
  ]),
  T('reis', 'W', 'Kings', 'Sacramento', 'Pontuadores de meia distancia', COL('#5a2d81', '#3a1d55', '#a3aab0'), [
    P('Dennis Schroder', 'Schroder', 185, [80, 80, 80, 80, 88, 72, 42]),
    P('Zach LaVine', 'Zach', 196, [88, 86, 90, 72, 86, 58, 52]),
    P('DeMar DeRozan', 'Deebo', 198, [60, 96, 86, 76, 74, 64, 58]),
    P('Keegan Murray', 'Keegan', 203, [84, 72, 76, 56, 72, 80, 72]),
    P('Domantas Sabonis', 'Sabas', 211, [56, 80, 88, 88, 58, 66, 96]),
  ]),
  T('esporas', 'W', 'Spurs', 'San Antonio', 'Um alienigena protegendo o aro', COL('#c4ced4', '#8a959c', '#111111'), [
    P("De'Aaron Fox", 'Swipa', 191, [80, 86, 90, 82, 97, 74, 48]),
    P('Stephon Castle', 'Castle', 198, [70, 76, 88, 80, 84, 82, 60]),
    P('Devin Vassell', 'Vassell', 196, [86, 80, 74, 62, 76, 78, 54]),
    P('Harrison Barnes', 'Black Falcon', 203, [82, 74, 74, 58, 64, 72, 60]),
    P('Victor Wembanyama', 'Wemby', 224, [82, 80, 90, 70, 74, 99, 92]),
  ]),
  T('jazz', 'W', 'Jazz', 'Utah', 'Jovens e um ala que chuta de longe', COL('#3e2680', '#24164d', '#f9a01b'), [
    P('Keyonte George', 'Keyonte', 193, [84, 78, 76, 80, 80, 58, 48]),
    P('Isaiah Collier', 'Collier', 191, [70, 70, 80, 84, 88, 62, 46]),
    P('Ace Bailey', 'Ace', 203, [80, 82, 82, 58, 80, 66, 62]),
    P('Lauri Markkanen', 'Lauri', 213, [88, 86, 82, 56, 70, 64, 76]),
    P('Walker Kessler', 'Kessler', 213, [10, 30, 84, 48, 56, 92, 92]),
  ]),
  // ------------------------------------------------------------- LESTE
  T('trevos', 'E', 'Celtics', 'Boston', 'Defesa forte e todo mundo arremessa', COL('#0f8a43', '#0a5e2e', '#ffffff'), [
    P('Derrick White', 'Whyte', 193, [84, 80, 80, 82, 80, 90, 56]),
    P('Jaylen Brown', 'JB', 198, [78, 86, 90, 74, 86, 84, 62]),
    P('Jayson Tatum', 'JT', 203, [86, 88, 88, 82, 80, 84, 78]),
    P('Sam Hauser', 'Hauser', 201, [90, 74, 64, 58, 68, 70, 56]),
    P('Neemias Queta', 'Queta', 213, [20, 48, 80, 52, 60, 82, 84]),
  ]),
  T('touros', 'E', 'Bulls', 'Chicago', 'Correria e passe do armador gigante', COL('#d01045', '#8e0a2e', '#111111'), [
    P('Josh Giddey', 'Giddey', 203, [76, 70, 78, 92, 76, 66, 82]),
    P('Coby White', 'Coby', 193, [86, 84, 80, 74, 84, 64, 48]),
    P('Matas Buzelis', 'Matas', 206, [80, 72, 78, 60, 78, 76, 66]),
    P('Patrick Williams', 'Pat', 201, [76, 66, 72, 52, 74, 80, 62]),
    P('Nikola Vucevic', 'Vooch', 208, [80, 82, 80, 74, 48, 66, 88]),
  ]),
  T('cervos', 'E', 'Bucks', 'Milwaukee', 'O monstro grego ataca o aro', COL('#0b5a2e', '#063b1d', '#eee1c6'), [
    P('Kevin Porter Jr.', 'KPJ', 193, [80, 82, 82, 84, 82, 64, 52]),
    P('Gary Trent Jr.', 'GTJ', 196, [86, 76, 70, 56, 74, 74, 44]),
    P('Kyle Kuzma', 'Kuz', 206, [76, 76, 80, 62, 74, 70, 68]),
    P('Giannis Antetokounmpo', 'Greek Freak', 211, [55, 76, 99, 84, 86, 92, 92]),
    P('Myles Turner', 'Myles', 211, [84, 70, 74, 52, 60, 88, 78]),
  ]),
  T('calor', 'E', 'Heat', 'Miami', 'Intensidade e defesa por zona', COL('#98002e', '#62001e', '#f9a01b'), [
    P('Davion Mitchell', 'Off Night', 183, [76, 72, 74, 80, 84, 90, 44]),
    P('Tyler Herro', 'Boy Wonder', 196, [90, 90, 80, 80, 78, 62, 54]),
    P('Andrew Wiggins', 'Wiggs', 201, [80, 78, 82, 60, 82, 80, 58]),
    P('Bam Adebayo', 'Bam', 206, [50, 80, 84, 82, 78, 92, 86]),
    P("Kel'el Ware", 'Kelel', 213, [70, 60, 82, 50, 64, 82, 86]),
  ]),
  T('falcoes', 'E', 'Hawks', 'Atlanta', 'Longos, rapidos e muito roubo de bola', COL('#e03a3e', '#9c2028', '#c1d32f'), [
    P('Trae Young', 'Ice Trae', 185, [90, 86, 82, 97, 84, 50, 44]),
    P('Dyson Daniels', 'Dyson', 201, [72, 66, 74, 76, 82, 96, 62]),
    P('Jalen Johnson', 'JJ', 206, [74, 76, 88, 80, 82, 78, 82]),
    P('Kristaps Porzingis', 'Unicornio', 221, [84, 80, 80, 56, 54, 84, 78]),
    P('Onyeka Okongwu', 'Gu', 206, [56, 56, 82, 54, 74, 84, 86]),
  ]),
  T('redes', 'E', 'Nets', 'Brooklyn', 'Reconstrucao com arremessadores', COL('#2a2a2a', '#0d0d0d', '#ffffff'), [
    P('Egor Demin', 'Egor', 203, [76, 68, 72, 86, 72, 66, 62]),
    P('Cam Thomas', 'Cam', 191, [80, 90, 86, 66, 82, 52, 44]),
    P('Michael Porter Jr.', 'MPJ', 208, [88, 86, 80, 56, 70, 62, 72]),
    P('Noah Clowney', 'Noah', 208, [76, 62, 72, 50, 70, 74, 70]),
    P('Nic Claxton', 'Clax', 211, [10, 40, 84, 62, 70, 84, 82]),
  ]),
  T('vespas', 'E', 'Hornets', 'Charlotte', 'Passes de efeito e muita bola de 3', COL('#00788c', '#1d1160', '#a1a1a4'), [
    P('LaMelo Ball', 'Melo', 201, [86, 82, 84, 92, 82, 62, 70]),
    P('Brandon Miller', 'B-Miller', 206, [86, 84, 80, 66, 78, 72, 60]),
    P('Kon Knueppel', 'Kon', 198, [88, 80, 72, 72, 70, 64, 58]),
    P('Miles Bridges', 'Miles', 201, [80, 78, 84, 66, 78, 72, 68]),
    P('Ryan Kalkbrenner', 'Kalk', 216, [20, 50, 82, 50, 52, 82, 84]),
  ]),
  T('paladinos', 'E', 'Cavaliers', 'Cleveland', 'Dois armadores rapidos e gigantes atras', COL('#860038', '#5a0026', '#fdbb30'), [
    P('Darius Garland', 'DG', 185, [88, 90, 84, 90, 86, 58, 44]),
    P('Donovan Mitchell', 'Spida', 191, [88, 90, 90, 82, 88, 74, 52]),
    P("De'Andre Hunter", 'Dre', 203, [82, 74, 74, 56, 72, 76, 56]),
    P('Evan Mobley', 'Mob', 213, [70, 80, 88, 74, 74, 96, 88]),
    P('Jarrett Allen', 'JA', 211, [10, 40, 88, 54, 64, 86, 90]),
  ]),
  T('pistoes', 'E', 'Pistons', 'Detroit', 'Fisicos: defesa dura e rebote', COL('#1d42ba', '#102a7a', '#c8102e'), [
    P('Cade Cunningham', 'Cade', 198, [82, 88, 88, 92, 80, 78, 68]),
    P('Jaden Ivey', 'Ivey', 193, [80, 76, 86, 72, 94, 64, 52]),
    P('Ausar Thompson', 'Ausar', 198, [55, 62, 84, 70, 90, 94, 74]),
    P('Tobias Harris', 'Tobi', 203, [82, 84, 78, 64, 68, 72, 66]),
    P('Jalen Duren', 'Duren', 208, [10, 40, 88, 56, 70, 80, 92]),
  ]),
  T('ritmo', 'E', 'Pacers', 'Indiana', 'Ritmo alucinante e bola rodando', COL('#002d62', '#001a3a', '#fdbb30'), [
    P('Tyrese Haliburton', 'Hali', 196, [88, 82, 80, 97, 84, 68, 52]),
    P('Andrew Nembhard', 'Nembhard', 196, [78, 80, 76, 82, 76, 86, 52]),
    P('Aaron Nesmith', 'Nesmith', 196, [86, 70, 72, 52, 74, 82, 56]),
    P('Pascal Siakam', 'Spicy P', 203, [72, 86, 90, 74, 80, 80, 76]),
    P('Isaiah Jackson', 'Jax', 208, [10, 40, 82, 48, 72, 82, 82]),
  ]),
  T('metro', 'E', 'Knicks', 'New York', 'Armador frio no fim do jogo', COL('#006bb6', '#004a80', '#f58426'), [
    P('Jalen Brunson', 'Captain Clutch', 188, [86, 94, 90, 86, 80, 64, 48]),
    P('Mikal Bridges', 'Mikal', 198, [82, 82, 78, 66, 80, 88, 56]),
    P('OG Anunoby', 'OG', 201, [84, 72, 76, 56, 78, 94, 62]),
    P('Josh Hart', 'Hart', 193, [70, 66, 76, 80, 82, 82, 86]),
    P('Karl-Anthony Towns', 'KAT', 213, [88, 88, 84, 72, 64, 70, 90]),
  ]),
  T('magos', 'E', 'Magic', 'Orlando', 'Alas enormes e defesa fisica', COL('#0077c0', '#004e80', '#c4ced4'), [
    P('Jalen Suggs', 'Suggs', 196, [80, 74, 80, 76, 84, 92, 54]),
    P('Desmond Bane', 'Bane', 196, [88, 86, 80, 76, 76, 78, 58]),
    P('Franz Wagner', 'Franz', 208, [76, 80, 88, 82, 80, 80, 66]),
    P('Paolo Banchero', 'Paolo', 208, [72, 86, 90, 82, 78, 76, 80]),
    P('Wendell Carter Jr.', 'WCJ', 208, [70, 62, 78, 62, 60, 80, 84]),
  ]),
  T('fundadores', 'E', '76ers', 'Philadelphia', 'Velocidade no perimetro e um pivo dominante', COL('#1d428a', '#0f2a5e', '#ed174c'), [
    P('Tyrese Maxey', 'Maxey', 188, [86, 86, 88, 80, 97, 62, 48]),
    P('VJ Edgecombe', 'VJ', 196, [80, 74, 86, 70, 90, 76, 56]),
    P('Kelly Oubre Jr.', 'Oubre', 201, [76, 70, 80, 52, 82, 78, 58]),
    P('Paul George', 'PG13', 203, [86, 86, 78, 74, 72, 80, 62]),
    P('Joel Embiid', 'The Process', 213, [80, 92, 92, 70, 58, 84, 90]),
  ]),
  T('raptores', 'E', 'Raptors', 'Toronto', 'Alas versateis e muita troca', COL('#ce1141', '#8a0b2b', '#a1a1a4'), [
    P('Immanuel Quickley', 'IQ', 188, [86, 80, 78, 82, 84, 64, 48]),
    P('RJ Barrett', 'RJ', 198, [76, 78, 86, 72, 80, 66, 62]),
    P('Brandon Ingram', 'BI', 203, [80, 90, 84, 76, 74, 66, 62]),
    P('Scottie Barnes', 'Scottie', 201, [70, 78, 86, 86, 80, 88, 80]),
    P('Jakob Poeltl', 'Poeltl', 213, [10, 46, 84, 64, 50, 84, 88]),
  ]),
  T('feiticeiros', 'E', 'Wizards', 'Washington', 'Veteranos guiando jovens atletas', COL('#002b5c', '#001a3a', '#e31837'), [
    P('CJ McCollum', 'CJ', 191, [86, 90, 82, 78, 76, 58, 48]),
    P('Bub Carrington', 'Bub', 193, [78, 72, 72, 76, 78, 62, 52]),
    P('Khris Middleton', 'Khash Money', 201, [84, 88, 76, 72, 62, 70, 60]),
    P('Bilal Coulibaly', 'Bilal', 201, [72, 66, 78, 62, 86, 86, 60]),
    P('Alex Sarr', 'Sarr', 216, [70, 60, 78, 54, 70, 88, 78]),
  ]),
];

// ---------------------------------------------------------------------
//  TIMES HISTÓRICOS — uma versão clássica de cada franquia (base = id atual).
// ---------------------------------------------------------------------
const H = (base, era, style, players, colors = null) => ({ id: `${base}${String(era).slice(2)}`, base, era, style, players, colors });
export const HISTORIC = [
  // Oeste
  H('ondas', 2017, 'Chuva de 3 com quatro estrelas', [
    P('Stephen Curry', 'Chef', 188, [99, 94, 86, 90, 86, 64, 52]),
    P('Klay Thompson', 'Klay', 198, [95, 92, 74, 62, 74, 84, 46]),
    P('Kevin Durant', 'KD', 211, [90, 97, 90, 78, 78, 82, 74]),
    P('Draymond Green', 'Dray', 198, [62, 60, 66, 92, 70, 94, 80]),
    P('Zaza Pachulia', 'Zaza', 211, [20, 48, 72, 62, 44, 72, 82]),
  ]),
  H('astros', 1987, 'Showtime original', [
    P('Magic Johnson', 'Showtime', 206, [68, 82, 90, 99, 86, 72, 86]),
    P('Byron Scott', 'Scott', 191, [86, 84, 78, 68, 82, 72, 46]),
    P('James Worthy', 'Big Game', 206, [50, 84, 94, 70, 88, 72, 66]),
    P('A.C. Green', 'Iron Man', 206, [36, 60, 80, 58, 74, 78, 86]),
    P('Kareem Abdul-Jabbar', 'Skyhook', 218, [30, 90, 95, 72, 50, 86, 88]),
  ]),
  H('fenix', 2005, 'Sete segundos ou menos', [
    P('Steve Nash', 'Nash', 191, [90, 94, 80, 97, 80, 58, 46]),
    P('Joe Johnson', 'Iso Joe', 201, [86, 86, 80, 72, 76, 72, 58]),
    P('Quentin Richardson', 'Q', 198, [86, 72, 74, 58, 78, 70, 62]),
    P('Shawn Marion', 'Matrix', 201, [62, 72, 86, 62, 86, 88, 84]),
    P("Amar'e Stoudemire", 'STAT', 208, [30, 82, 96, 54, 82, 66, 84]),
  ]),
  H('trovoes', 2012, 'Tres futuros MVPs jovens', [
    P('Russell Westbrook', 'Brodie', 191, [60, 80, 94, 84, 98, 76, 82]),
    P('James Harden', 'The Beard', 196, [86, 84, 88, 86, 82, 62, 52]),
    P('Kevin Durant', 'KD', 206, [88, 96, 90, 74, 80, 74, 72]),
    P('Serge Ibaka', 'Air Congo', 208, [40, 80, 80, 48, 70, 90, 86]),
    P('Kendrick Perkins', 'Perk', 208, [20, 40, 72, 50, 50, 84, 82]),
  ]),
  H('cavaleiros', 2011, 'Fade-away de uma perna so', [
    P('Jason Kidd', 'J-Kidd', 193, [80, 72, 74, 96, 80, 88, 74]),
    P('Jason Terry', 'Jet', 188, [86, 88, 80, 76, 82, 64, 40]),
    P('Shawn Marion', 'Matrix', 201, [50, 70, 84, 64, 82, 88, 80]),
    P('Dirk Nowitzki', 'Dirk', 213, [86, 99, 74, 70, 58, 68, 80]),
    P('Tyson Chandler', 'Tyson', 216, [10, 30, 86, 46, 62, 90, 90]),
  ]),
  H('pepitas', 2023, 'O primeiro titulo do Joker', [
    P('Jamal Murray', 'Blue Arrow', 193, [86, 92, 88, 84, 80, 64, 52]),
    P('Kentavious Caldwell-Pope', 'KCP', 196, [86, 72, 72, 60, 78, 86, 48]),
    P('Michael Porter Jr.', 'MPJ', 208, [88, 84, 80, 56, 70, 62, 72]),
    P('Aaron Gordon', 'AG', 203, [66, 70, 90, 70, 80, 86, 76]),
    P('Nikola Jokic', 'Joker', 211, [80, 94, 92, 99, 55, 72, 96]),
  ]),
  H('veleiros', 2014, 'Lob City: pontes aereas sem parar', [
    P('Chris Paul', 'CP3', 183, [82, 96, 82, 98, 84, 92, 56]),
    P('JJ Redick', 'JJ', 193, [95, 88, 66, 64, 70, 58, 40]),
    P('Matt Barnes', 'Barnes', 201, [78, 70, 72, 62, 74, 80, 62]),
    P('Blake Griffin', 'Blake', 208, [40, 82, 96, 82, 82, 70, 86]),
    P('DeAndre Jordan', 'DJ', 211, [10, 20, 90, 44, 72, 90, 97]),
  ]),
  H('foguetes', 1995, 'O sonho no garrafao e bolas decisivas', [
    P('Kenny Smith', 'The Jet', 191, [88, 80, 72, 84, 84, 62, 44]),
    P('Clyde Drexler', 'The Glide', 201, [74, 86, 92, 82, 90, 80, 72]),
    P('Mario Elie', 'Junkyard Dog', 196, [84, 74, 70, 62, 72, 80, 52]),
    P('Robert Horry', 'Big Shot Rob', 206, [84, 70, 72, 64, 70, 82, 76]),
    P('Hakeem Olajuwon', 'The Dream', 213, [30, 92, 96, 72, 72, 97, 94]),
  ]),
  H('ursos', 2013, 'Grit and grind: defesa e garrafao', [
    P('Mike Conley', 'Conley', 185, [82, 84, 80, 86, 82, 82, 46]),
    P('Tony Allen', 'Grindfather', 193, [40, 66, 80, 52, 82, 97, 62]),
    P('Tayshaun Prince', 'Prince', 206, [74, 76, 70, 62, 66, 82, 56]),
    P('Zach Randolph', 'Z-Bo', 206, [30, 84, 92, 62, 50, 66, 95]),
    P('Marc Gasol', 'Big Spain', 216, [56, 82, 82, 84, 48, 94, 82]),
  ]),
  H('lobos', 2004, 'O Big Ticket no auge', [
    P('Sam Cassell', 'Sam I Am', 191, [72, 92, 82, 86, 78, 66, 48]),
    P('Latrell Sprewell', 'Spree', 196, [76, 80, 86, 68, 84, 78, 52]),
    P('Trenton Hassell', 'Hassell', 198, [60, 66, 66, 58, 74, 90, 58]),
    P('Kevin Garnett', 'Big Ticket', 211, [56, 92, 88, 84, 76, 95, 96]),
    P('Ervin Johnson', 'Ervin', 211, [10, 30, 70, 42, 50, 86, 88]),
  ]),
  H('pelicanos', 2008, 'CP3 e o pick and roll com West', [
    P('Chris Paul', 'CP3', 183, [82, 94, 86, 98, 90, 90, 58]),
    P('Morris Peterson', 'Mo Pete', 201, [82, 72, 72, 60, 72, 74, 52]),
    P('Peja Stojakovic', 'Peja', 208, [95, 86, 70, 62, 64, 58, 58]),
    P('David West', 'D-West', 206, [40, 92, 82, 70, 66, 76, 82]),
    P('Tyson Chandler', 'Tyson', 216, [10, 30, 86, 46, 66, 90, 94]),
  ]),
  H('desbravadores', 1977, 'Bola rodando e o pivo ruivo', [
    P('Lionel Hollins', 'L-Train', 191, [50, 82, 80, 82, 84, 86, 52]),
    P('Dave Twardzik', 'Twardzik', 185, [50, 80, 78, 84, 80, 72, 44]),
    P('Bob Gross', 'Gross', 198, [50, 80, 80, 72, 78, 76, 62]),
    P('Maurice Lucas', 'The Enforcer', 206, [30, 84, 86, 62, 70, 86, 90]),
    P('Bill Walton', 'Big Red', 211, [20, 76, 90, 92, 62, 96, 96]),
  ]),
  H('reis', 2002, 'Greatest Show on Court: passe de pivo', [
    P('Mike Bibby', 'Bibby', 185, [88, 86, 78, 86, 80, 62, 44]),
    P('Doug Christie', 'Christie', 198, [74, 72, 72, 72, 82, 92, 58]),
    P('Peja Stojakovic', 'Peja', 208, [96, 88, 72, 62, 66, 60, 60]),
    P('Chris Webber', 'C-Webb', 208, [50, 88, 90, 90, 72, 82, 90]),
    P('Vlade Divac', 'Vlade', 216, [50, 76, 78, 88, 46, 76, 84]),
  ]),
  H('esporas', 2014, 'Bola rodando: o jogo bonito', [
    P('Tony Parker', 'TP', 188, [72, 90, 92, 86, 92, 64, 40]),
    P('Danny Green', 'Icy Hot', 198, [90, 78, 70, 62, 74, 82, 48]),
    P('Kawhi Leonard', 'The Klaw', 201, [84, 84, 82, 66, 82, 96, 72]),
    P('Tim Duncan', 'Big Fundamental', 211, [25, 88, 88, 78, 56, 92, 90]),
    P('Tiago Splitter', 'Splitter', 211, [20, 60, 82, 64, 58, 78, 80]),
  ]),
  H('jazz', 1997, 'Pick and roll do carteiro', [
    P('John Stockton', 'Stock', 185, [80, 88, 80, 99, 80, 88, 48]),
    P('Jeff Hornacek', 'Horny', 191, [90, 90, 74, 72, 70, 66, 48]),
    P('Bryon Russell', 'Bryon', 201, [82, 70, 72, 56, 74, 84, 60]),
    P('Karl Malone', 'The Mailman', 206, [30, 94, 94, 72, 74, 82, 92]),
    P('Greg Ostertag', 'Ostertag', 218, [10, 30, 70, 40, 40, 86, 88]),
  ]),
  // Leste
  H('trevos', 2008, 'Big Three e defesa sufocante', [
    P('Rajon Rondo', 'Rondo', 185, [55, 72, 84, 92, 92, 88, 70]),
    P('Ray Allen', 'Jesus', 196, [95, 92, 78, 72, 78, 70, 45]),
    P('Paul Pierce', 'The Truth', 201, [86, 92, 86, 80, 74, 78, 62]),
    P('Kevin Garnett', 'Big Ticket', 211, [40, 88, 84, 80, 74, 94, 90]),
    P('Kendrick Perkins', 'Perk', 208, [20, 40, 72, 50, 50, 84, 82]),
  ]),
  H('touros', 1996, 'O maior time: triangulo e defesa', [
    P('Ron Harper', 'Harp', 198, [70, 72, 74, 74, 74, 82, 52]),
    P('Michael Jordan', 'Air', 198, [80, 99, 98, 82, 94, 96, 66]),
    P('Scottie Pippen', 'Pip', 203, [72, 80, 86, 88, 86, 97, 74]),
    P('Dennis Rodman', 'The Worm', 201, [30, 40, 64, 68, 74, 92, 99]),
    P('Luc Longley', 'Luc', 218, [22, 62, 70, 60, 44, 70, 78]),
  ]),
  H('cervos', 2021, 'O grego campeao', [
    P('Jrue Holiday', 'Jrue', 193, [80, 80, 80, 82, 78, 94, 56]),
    P('Donte DiVincenzo', 'Big Ragu', 193, [84, 72, 74, 74, 80, 82, 62]),
    P('Khris Middleton', 'Khash Money', 201, [86, 92, 78, 76, 70, 74, 64]),
    P('Giannis Antetokounmpo', 'Greek Freak', 211, [55, 78, 99, 84, 90, 94, 92]),
    P('Brook Lopez', 'Splash Mountain', 213, [80, 72, 78, 50, 44, 90, 74]),
  ]),
  H('calor', 2013, 'Big Three do sul da Florida', [
    P('Mario Chalmers', 'Rio', 188, [86, 76, 74, 76, 82, 80, 44]),
    P('Dwyane Wade', 'Flash', 193, [52, 86, 94, 84, 90, 84, 58]),
    P('LeBron James', 'King', 206, [80, 88, 98, 95, 94, 92, 86]),
    P('Chris Bosh', 'CB4', 211, [74, 90, 80, 64, 70, 80, 78]),
    P('Udonis Haslem', 'UD', 203, [30, 78, 64, 52, 58, 86, 80]),
  ]),
  H('falcoes', 2015, 'Bola rodando, cinco no All-Star', [
    P('Jeff Teague', 'Teague', 188, [80, 80, 84, 84, 88, 66, 44]),
    P('Kyle Korver', 'Korver', 201, [97, 82, 60, 62, 62, 64, 48]),
    P('DeMarre Carroll', 'Junkyard', 203, [80, 72, 74, 54, 74, 84, 58]),
    P('Paul Millsap', 'Sap', 203, [74, 82, 82, 74, 70, 84, 82]),
    P('Al Horford', 'Big Al', 208, [66, 86, 82, 76, 62, 84, 82]),
  ]),
  H('redes', 2003, 'Contra-ataque do Kidd', [
    P('Jason Kidd', 'J-Kidd', 193, [74, 72, 80, 97, 88, 90, 80]),
    P('Kerry Kittles', 'Kittles', 196, [82, 80, 80, 62, 80, 72, 52]),
    P('Richard Jefferson', 'RJ', 201, [72, 78, 88, 64, 86, 74, 62]),
    P('Kenyon Martin', 'K-Mart', 206, [30, 70, 90, 56, 82, 84, 82]),
    P('Dikembe Mutombo', 'Mt. Mutombo', 218, [10, 40, 72, 40, 40, 92, 92]),
  ]),
  H('vespas', 1993, 'O menor e o maior em quadra', [
    P('Muggsy Bogues', 'Muggsy', 160, [64, 74, 70, 92, 96, 84, 40]),
    P('Dell Curry', 'Dell', 193, [92, 86, 72, 62, 72, 62, 46]),
    P('Kendall Gill', 'Kendall', 196, [70, 80, 84, 70, 82, 78, 58]),
    P('Larry Johnson', 'Grandmama', 201, [62, 82, 90, 72, 78, 74, 82]),
    P('Alonzo Mourning', 'Zo', 208, [20, 72, 92, 52, 62, 96, 90]),
  ]),
  H('paladinos', 2016, 'A virada historica de 3-1', [
    P('Kyrie Irving', 'Uncle Drew', 191, [86, 92, 96, 84, 88, 64, 46]),
    P('JR Smith', 'JR', 198, [88, 76, 72, 58, 74, 72, 48]),
    P('LeBron James', 'King', 203, [80, 88, 98, 95, 92, 90, 86]),
    P('Kevin Love', 'K-Love', 208, [86, 80, 78, 72, 56, 66, 92]),
    P('Tristan Thompson', 'TT', 206, [10, 30, 82, 48, 70, 80, 92]),
  ]),
  H('pistoes', 2004, 'Defesa coletiva campea', [
    P('Chauncey Billups', 'Mr. Big Shot', 191, [88, 86, 80, 86, 78, 82, 52]),
    P('Richard Hamilton', 'Rip', 201, [70, 95, 78, 70, 82, 72, 50]),
    P('Tayshaun Prince', 'Prince', 206, [76, 80, 76, 66, 72, 92, 60]),
    P('Rasheed Wallace', 'Sheed', 211, [78, 88, 82, 66, 62, 90, 80]),
    P('Ben Wallace', 'Big Ben', 206, [10, 30, 72, 56, 70, 99, 97]),
  ]),
  H('ritmo', 2000, 'O arremessador mais frio do Leste', [
    P('Mark Jackson', 'Action', 191, [72, 76, 72, 96, 68, 72, 62]),
    P('Reggie Miller', 'Reggie', 201, [97, 90, 74, 66, 74, 66, 48]),
    P('Jalen Roze', 'Jalen', 203, [82, 82, 78, 74, 74, 66, 58]),
    P('Dale Davis', 'Dale', 211, [10, 50, 80, 44, 58, 86, 92]),
    P('Rik Smits', 'Dutchman', 224, [30, 86, 86, 52, 40, 78, 82]),
  ]),
  H('metro', 1994, 'Defesa brutal no garrafao', [
    P('Derek Harper', 'Harp', 193, [80, 80, 74, 82, 74, 80, 48]),
    P('John Starks', 'Starks', 196, [86, 80, 82, 70, 82, 78, 50]),
    P('Anthony Mason', 'Mase', 201, [40, 72, 82, 80, 70, 82, 84]),
    P('Charles Oakley', 'Oak', 206, [30, 76, 74, 62, 58, 90, 92]),
    P('Patrick Ewing', 'Hoya Destroya', 213, [30, 92, 92, 62, 62, 92, 90]),
  ]),
  H('magos', 1995, 'Penny e o gigante Shaq', [
    P('Penny Hardaway', 'Penny', 201, [80, 88, 92, 92, 90, 80, 64]),
    P('Nick Anderson', 'Nick', 198, [86, 80, 80, 62, 78, 76, 58]),
    P('Dennis Scott', '3-D', 203, [95, 78, 66, 58, 66, 62, 52]),
    P('Horace Grant', 'Horace', 208, [30, 82, 82, 62, 70, 88, 88]),
    P("Shaquille O'Neal", 'Shaq', 216, [10, 60, 99, 62, 72, 86, 96]),
  ]),
  H('fundadores', 2001, 'The Answer contra o mundo', [
    P('Eric Snow', 'Snow', 191, [56, 76, 74, 86, 80, 86, 48]),
    P('Allen Iverson', 'The Answer', 183, [76, 88, 94, 74, 99, 76, 48]),
    P('Aaron McKie', 'McKie', 196, [80, 76, 72, 72, 74, 84, 58]),
    P('Tyrone Hill', 'Hill', 206, [10, 60, 80, 44, 62, 82, 90]),
    P('Dikembe Mutombo', 'Mt. Mutombo', 218, [10, 44, 74, 40, 44, 97, 96]),
  ]),
  H('raptores', 2019, 'O arremesso que quicou quatro vezes', [
    P('Kyle Lowry', 'Lowry', 183, [86, 80, 80, 88, 78, 86, 56]),
    P('Danny Green', 'Icy Hot', 198, [90, 72, 66, 60, 70, 84, 52]),
    P('Kawhi Leonard', 'The Klaw', 201, [84, 95, 90, 72, 82, 96, 74]),
    P('Pascal Siakam', 'Spicy P', 206, [70, 84, 92, 70, 84, 84, 80]),
    P('Marc Gasol', 'Big Spain', 216, [80, 78, 72, 86, 44, 88, 82]),
  ]),
  H('feiticeiros', 2017, 'Velocidade pura do armador', [
    P('John Wall', 'Optimus Dime', 193, [70, 80, 92, 94, 98, 76, 56]),
    P('Bradley Beal', 'Beal', 193, [88, 88, 84, 72, 82, 68, 52]),
    P('Otto Porter Jr.', 'Otto', 203, [88, 78, 74, 60, 72, 78, 64]),
    P('Markieff Morris', 'Kieff', 206, [70, 80, 76, 58, 64, 74, 74]),
    P('Marcin Gortat', 'Polish Hammer', 211, [10, 60, 82, 58, 50, 80, 88]),
  ]),
];
const modernById = (id) => TEAMS.find((t) => t.id === id);
for (const h of HISTORIC) {
  const m = modernById(h.base);
  h.conf = m.conf;
  h.name = `${m.name} ${String(h.era).slice(2)}`;
  h.city = m.city;
  if (!h.colors) h.colors = m.colors;
}
TEAMS.push(...HISTORIC);

// Franquias (as 30 atuais) e a versão histórica de cada uma.
export const FRANCHISES = TEAMS.filter((t) => !t.era);
export const franchiseOf = (team) => team.base || team.id;
export const historicOf = (frId) => HISTORIC.find((h) => h.base === frId) || null;

// ---------------------------------------------------------------------
//  RESERVAS — gerados a partir dos titulares (um por posição, mais fracos).
// ---------------------------------------------------------------------
const BENCH_NAMES = ['Silva', 'Souza', 'Costa', 'Rocha', 'Lima', 'Alves', 'Nunes', 'Melo', 'Dias', 'Ramos', 'Pinto', 'Moura', 'Farias', 'Torres', 'Vieira'];
export function benchOf(team) {
  if (team.bench) return team.bench;
  const seed = [...team.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  team.bench = team.players.map((s, i) => {
    const drop = 9 + ((seed + i * 7) % 7);
    const r = Object.fromEntries(Object.entries(s.r).map(([k, v]) => [k, Math.max(40, v - drop)]));
    const name = `${['Leo', 'Davi', 'Caio', 'Igor', 'Theo', 'Raul', 'Enzo', 'Joao'][(seed + i) % 8]} ${BENCH_NAMES[(seed + i * 3) % BENCH_NAMES.length]}`;
    return { name, nick: 'Reserva', cm: s.cm + (((seed + i) % 5) - 2), r, bench: true };
  });
  return team.bench;
}

// Times extras (universitários da carreira): não aparecem na seleção nem no campeonato.
export const EXTRA_TEAMS = [];
export const registerTeams = (list) => EXTRA_TEAMS.push(...list);
export const teamById = (id) => TEAMS.find((t) => t.id === id) || EXTRA_TEAMS.find((t) => t.id === id) || TEAMS[0];
// Cor do time para textos: cores muito escuras são clareadas para dar leitura no fundo escuro.
export const teamHudColor = (team) => {
  const n = parseInt(team.colors.jersey.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 110) {
    const k = (110 - lum) / 110 + 0.35;
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * Math.min(0.7, k)));
  }
  return (r << 16) | (g << 8) | b;
};
export const POS = ['PG', 'SG', 'SF', 'PF', 'C'];

// rating 40..99 -> multiplicador
export const ratingMult = (r) => RATING.min + ((Math.max(40, Math.min(99, r)) - 40) / 59) * (RATING.max - RATING.min);

// Melhor nota do jogador (para "craque" e dobras).
export const bestRating = (p) => Math.max(p.r.three, p.r.mid, p.r.fin, p.r.pass);

export const fmtHeight = (cm) => `${Math.floor(cm / 100)},${String(cm % 100).padStart(2, '0')}M`;
