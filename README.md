# Armador 16-bit 🏀

Basquete 2D em pixel art, **quadra inteira, jogo contínuo, 5x5**. Você é sempre o **armador**: no ataque lê a defesa e escolhe a jogada; na defesa marca o armador adversário. **Primeiro a 21 vence.**

Phaser 3 + Vite. Sem backend e sem assets externos (sprites, fonte e sons gerados em código).

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/ para GitHub Pages / Netlify
```

## Fluxo

Título (menu) → **Monte seu jogo** (seu time, adversário, estilo do armador) → partida contínua → fim de jogo.
Na partida: **ESC/P** pausa (continuar, playbook, controles, reiniciar, sair) e **TAB** abre o playbook com o jogo parado.

O jogo não para: depois de cesta há uma reposição rápida pela linha de fundo; rebote defensivo e roubo viram contra-ataque na hora. A casa ataca a cesta de cima, o visitante a de baixo.

## Controles

| Ataque | |
|---|---|
| WASD / setas | mover (ao encostar no marcador, você contorna) |
| Shift | sprint (gasta GAS) |
| J | segure: mira o passe (seta) · solte: passa |
| **J + 1..4** | passe direto por ícone (1 SG, 2 SF, 3 PF, 4 C) |
| K | fora do garrafão: segure e solte no verde · **no garrafão: bandeja/enterrada** |
| L | crossover |
| 1..9 | jogadas rápidas (as 9 primeiras do playbook) |
| J sem a bola | pedir a bola |

| Defesa (você marca o armador adversário) | |
|---|---|
| K | roubar / interceptar / pular no arremesso (toco) |
| L | deslize rápido |
| J | pedir dobra no homem da bola |

## Como abrir

Dê dois cliques em **Jogar.bat** (liga o servidor e abre o navegador). Ou, no terminal, dentro da pasta: `npm.cmd run dev`.

## Novidades da leva 11

- **Login** ao abrir o jogo: apelido + PIN de 4 números (nome novo = conta nova). "Jogar sem conta" entra como convidado.
- **COMPETITIVO (Sobrevivência)**: só posses de ataque, **3 vidas**. Posse sem pontuar = perde uma vida. A cada 4 posses certas a defesa aperta. **Ranking = suas cestas + suas assistências**. Cada ponto vale 10 moedas.
- **Lendas bloqueadas** fora do Arcade (no Arcade tudo é liberado): 6 livres; as outras 24 liberam por **desafio** (ex.: Stockton = 10 assistências numa partida) ou comprando com **moedas** (Competitivo → Lendas). Assim cada irmão tem o seu elenco.
- **IA com as mesmas armas**: crossover, hesitação e giro na infiltração (pode te pegar se você der bote), euro step, reversa e hop step, passe quicado e finta de passe.
- **Treino → Mecânicas**: 15 lições de 1 posse (giro, hesitação, size-up, euro, reversa, quicado, finta, chamar bloqueio, bloquear, mandar chutar, jogada sem bola, mão alta, falta de ataque, box out, pedir troca).
- **Música 16-bit** (menu e partida; liga/desliga no título) e sons novos: verde, toco, vida perdida.
- **Narração** dos lances novos: verde, giro, hesitação, euro, reversa, hop, falta de ataque, finta, bloqueio, insígnias.
- **Carreira**: pontos de evolução em **ZONAS QUENTES** (esquenta todas as suas zonas) e **INSÍGNIAS** (começa os jogos já no bronze/prata/ouro). **Franquia**: títulos fazem seu armador começar com as insígnias mais quentes.

### Ligar o ranking online (Supabase)
1. Crie uma conta grátis em supabase.com e um projeto novo.
2. No projeto: **SQL Editor** → cole o arquivo `supabase.sql` desta pasta → **Run**.
3. Em **Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Cole as duas em `src/net/config.js` (ou me passe que eu coloco).
Sem isso o jogo funciona offline: contas, moedas e ranking ficam só no navegador.
## Novidades da leva 10

- **Monte seu jogo em etapas**: 1 seu time (Leste/Oeste → time → atual/histórico) · 2 seu armador · 3 adversário · 4 regras (arremesso, dificuldade, modo) · 5 confirmar. Uma coisa por tela; ENTER/A avança, ESC/B volta. O **estilo** (Passador/Chutador/Infiltrador) não se escolhe: é o do armador, pelo ponto forte dele.
- **Controles** (título e pausa) têm duas páginas: **teclado** e **joystick** (ESQ/DIR ou LB/RB). Com um controle conectado, abre direto na do joystick.
- **Dica do técnico**: quando a defesa adversária muda, ele sugere a contra-jogada do seu playbook. Some quando seu QI de leitura fica alto.
- **Zonas quentes**: cada jogador tem zonas quentes e frias (rating + estilo próprio) que mudam a chance real do arremesso. Na **visão de quadra (Q/LT)** aparecem as zonas de quem você está mirando: vermelho quente, azul frio.
- **Pedir troca na defesa** (C / LB): você passa a marcar o atacante mais perto e o colega fica com o seu. No modo por tempo, perdendo no último minuto, vira **falta intencional**.
- **Jogada do tempo (ATO)**: depois de um tempo técnico, a primeira jogada que você chamar rende mais.
- **Dribles estilo Pro Stick** (L): para o lado = crossover; para a cesta = **hesitação** (freia e explode); parado = **size-up** (o próximo movimento desequilibra mais); **L duas vezes = giro**.
- **Bandejas**: entrando no garrafão, segure **L** = **reversa** (difícil de tocar); direção para o lado = **euro step** (foge do contato); parado = **hop step** (força, mais falta).
- **Passes**: **J + L** = quicado (difícil de interceptar); **J + K** longe do aro = **finta de passe** (quem lia a linha morde); soltar logo depois de receber = **de primeira** (mais rápido).
- **Defesa**: **U / Y** = **mão alta** (contesta sem pular, sem falta e sem cair em finta). Pular cedo (K) agora pode cair na finta da IA. Ficar **parado na frente** de quem infiltra pode cavar **falta de ataque**. **L** com a bola no ar = **box out**; com a bola solta perto = **mergulho**.
- **Insígnias que acendem**: acertando, as suas sobem durante o jogo (bronze → prata → ouro → hall da fama, até +10% nos arremessos); errando, caem.
## Novidades da leva 9

- **Chamar bloqueio**: com a bola, **C** (ou toque no **LB/L1**) chama o grandalhão mais perto para fazer o pick and roll em você.
- **Você bloqueia**: sem a bola, **segure C** (ou **segure LB/L1**) para plantar um bloqueio. O defensor que bater em você fica preso um instante ("BLOQUEADO!") e, se era o marcador de quem está com a bola, o companheiro ataca o espaço.
- **"Chuta!"**: sem a bola, o botão de arremesso (**K** / **X/Quadrado**) manda o companheiro com a bola arremessar na hora (longe da cesta, ele ataca). Mandar arremessar quem está livre melhora a nota de companheiro.
- **Setas em todas as jogadas** (com e sem bola): rota tracejada de cada companheiro na cor da posição, quadrado amarelo onde vai o bloqueio, anel verde em quem é a leitura e a **sua rota em azul** (sem bola: para onde correr; com bola: para o lado do bloqueio).
## Novidades da leva 8

- **Nomes reais**: jogadores, lendas e times com os nomes de verdade (Golden State Warriors, Stephen Curry, Michael Jordan...).
- **Seleção por conferência**: na linha do time, **ENTER** (ou **A**) abre a escolha: **Leste/Oeste** → um dos 15 times → **Atual 2025-26** ou **Histórico**. ESQ/DIR e V continuam funcionando como atalho.
- **47 jogadas em páginas de 9** (teclas 1–9; **F** ou **R3** troca a página; o playbook da pausa mostra as páginas com ESQ/DIR):
  - **Com a bola**: pick and roll/pop, slip, ghost screen, short roll, pick and roll espaçado, 1-3, Horns, Horns flare, Spain, post up do pivô...
  - **Sem a bola (azul)**: você passa automaticamente e **corre pelos bloqueios seguindo o anel azul** — Bloqueio duplo, Pin-down, Flare, Curl, UCLA, Passa e corta, Floppy, Elevador, Chicago, Pistol. Quem recebeu devolve quando você sair livre (ou de mão em mão).
  - **Jogadas de franquia (amarelo)**, só do seu time/época: Split do Chef (Warriors), Luka e LeBron (Lakers), Joker hand-off (Nuggets), Iso no cotovelo (Thunder), Drag do Grego (Bucks), DHO do Bam (Heat), Lob do pivô, Pick and pop do gigante, Triângulo (Bulls 96), Stockton e Malone (Jazz 97), Dream shake (Rockets 95), Sete segundos (Suns 05). Elas aparecem na primeira página.
- **Verde = cesta (estilo 2K)**: a janela verde ficou menor, mas soltar no verde com um bom arremessador (3 pts ou meia ≥ 80) e sem marcação colada é **cesta garantida** — aparece "VERDE!", a rede acende verde e a tela pisca.
- **Rebote no ar**: a bola sai do aro mais baixa, os jogadores correm para onde ela vai cair e pegam no pulo (altura e rebote aumentam o alcance).
- **Laterais**: há espaço fora das linhas; a reposição é feita de fora da quadra de verdade, e pisar fora com a bola é posse do adversário.
- **Canto visível**: a câmera passa um pouco da linha de fundo e o medidor desce para baixo dos pés quando ficaria sob o placar.
- **Controle estilo NBA 2K e em todas as telas**:

| Botão (Xbox / PlayStation) | Ataque | Defesa |
|---|---|---|
| X / Quadrado | arremesso (toque: finta) | roubo |
| A / X | passe | pedir dobra |
| B / Bolinha | crossover (no arremesso: step-back) | deslize / corte |
| Y / Triângulo | ponte aérea / passe alto | pular para o toco |
| RB / R1 (segure) + A/B/X/Y | passe por ícone | — |
| LB / L1 (segure) + A/B/X/Y | comando para o companheiro | — |
| Direcional | jogadas 1–4 da página (LB + direcional: 5–8) | defesas |
| RT / R2 | sprint | sprint |
| LT / L2 | visão de quadra | — |
| R3 / L3 | próxima página de jogadas / replay | — |
| START / VIEW | pausa / playbook | |

  Nos menus: analógico/direcional navega, **A** confirma, **B** volta, **Y** alterna atual/histórico, **LB/RB** mudam de página. Tudo continua personalizável em Controles.
## Novidades da leva 7

- **60 times**: as 30 franquias atuais (15 no Leste, 15 no Oeste, elencos da temporada 2025-26) e **uma versão histórica de cada** (Touros 96, Foguetes 95, Magos 95, Jazz 97, Pistões 04, Raptores 19...). Na seleção, **ESQ/DIR** troca a franquia e **V** alterna entre **ATUAL** e **HISTÓRICO**. Nomes parecidos com os reais, mas não idênticos.
- **30 armadores lendários**: aos 10 anteriores somam-se Stokton, Kyrie Irvin, Damian Lilard, Penny Hardway, Tim Hardway, Bob Cousi, Walt Fraizer, Derrick Roze, Tony Parquer, Jerry Uest, Nate Archibal, Kevin Jonson, Mark Prise, Chauncey Bilups, Deron Willians, Rajon Rondu, Gilbert Arenaz, Steve Francys, Shai Gilgeus-Alexandre e Luka Doncik.
- **IA com fome de cesta**: com o caminho livre, ela ataca o aro na hora; passa pelo defensor que chega correndo para fechar; arremessa quando está livre; e só passa se a opção for claramente melhor. A IA agora também faz **ponte aérea** para grandalhões cortando livres.
- **Rua 3x3 de verdade**: **meia quadra** com uma cesta só, asfalto rachado, alambrado, muro com grafite e rede de corrente. Regra da **bola limpa**: depois de rebote de defesa ou roubo, é preciso levar a bola para **fora do arco** antes de pontuar (senão "NÃO VALEU" e a posse muda). Rebote ofensivo pode pontuar direto. Toda reposição é a bola checada no topo.
- **Em chamas mais alcançável**: o seu armador esquenta mais rápido (cestas, assistências, roubos, tocos e boas leituras contam), esfria mais devagar e errar tira menos.
- **Reposição sem teletransporte**: quem repõe pega a bola e caminha até a linha.
- **Franquia com playoffs jogáveis**: com 6 vitórias ou mais na temporada, você joga (ou simula) a semifinal e a final de conferência e as **Finais** contra o melhor time da outra conferência. Perdeu, caiu.
- **Campeonato** sorteia rivais da mesma "era": com um time atual, só times atuais; com um histórico, só históricos.
## Novidades da leva 6

- **Menu**: Arcade, Carreira, **Franquia**, Campeonato, **Mais modos** (Rua 3x3, Fim de semana das estrelas, Treino e desafios), Controles, Som.
- **Franquia**: você é o armador e o dono — elenco de 10 com idade e salário (teto), jogar ou simular cada jogo, **trocas** (o outro time avalia valor e salário), entressafra com evolução/declínio por idade, **aposentadoria** e **draft** de 3 prospectos. Várias temporadas, salvo no navegador.
- **Fim de semana das estrelas**: torneio de **3 pontos** (5 carrinhos, bola de ouro vale 2, 60 s), torneio de **enterradas** (segure K no garrafão, nota 30–50) e **Jogo das Estrelas** (Leste x Oeste com os melhores de cada posição).
- **Rua 3x3**: armador, ala e pivô; 1 ponto dentro do arco e 2 de fora; relógio de 12 s.
- **Narração em texto e torcida**: frases a cada lance ("QUE PASSE!", "TOCO!"), parciais ("PARCIAL DE 8 A 0"), sequência de bolas de 3, jogador em chamas e final apertado; a torcida vibra nos lances grandes.
- **Buzzer beater**: no modo por tempo, a bola no ar quando o cronômetro zera vale se cair; arremessos do meio da quadra e no estouro dos 24 s ganham narração especial.
- **Controles personalizáveis** (Controles → ENTER): troque as teclas e os botões do gamepad de cada ação.
## Novidades das levas 4 e 5

- **Treino e desafios** (título → Treino e desafios): 8 lições de leitura (drop, hedge, dobra, troca, zona, pressão, ajuda, dobra no atirador), 1 posse cada, até 3 estrelas; 4 desafios de lendas (virada, noite do Chef, show do passe, muralha). Progresso salvo.
- **Replay com análise**: aperte **R** depois de uma jogada — câmera lenta dos últimos segundos; o replay para na sua decisão e mostra a melhor opção que existia.
- **Fim de jogo em 3 páginas** (ESQ/DIR): resumo, box score dos 10 jogadores e mapa dos seus arremessos.
- **Carreira** (título → Carreira): crie seu armador (nome, altura, pele, cabelo, estilo), 3 jogos no universitário, draft, temporadas de 10 jogos com **plano de jogo** (3 jogadas ensaiadas + defesa do time), **pontos de evolução** ganhos com boas decisões (inclui o atributo VISÃO, que melhora a visão de quadra) e **prêmios** (MVP, defensor do ano, quinteto ideal, calouro do ano). Salvo no navegador.
## Novidades das levas 1 a 3

- **Leitura de jogo**: contra-jogadas (jogada certa contra a defesa dá bônus), defesa disfarçada, visão de quadra (Q), nota de companheiro (A+ a F) e QI do armador.
- **Mecânicas do 2K**: insígnias (vistas na seleção), takeover ("aquecendo" / "em chamas" — a defesa passa a dobrar), arremesso característico por jogador, perfil de arremesso (seguro/normal/arriscado), combos de crossover, corte defensivo (L sem direção), ponte aérea (J + K), finta (toque rápido no K), fadiga e substituições (pausa → Substituições; a IA troca sozinha).
- **Uniforme alternativo** quando os dois times têm cores parecidas.
- **Times históricos** (Trevos 08, Ondas 17, Touros 96, Astros 87, Calor 13, Esporas 14, Trovões 12, Cavaleiros 11) com nomes parecidos com os reais.
- **Modos**: Arcade e **Campeonato** (8 times, Leste/Oeste, semis → final de conferência → Finais; jogo único ou melhor de 3; scout do adversário; salvo no navegador — "Continuar campeonato" no título).
- **Tempo técnico** (pausa): relatório (dobras em você, defesa mais usada, pontos por jogada) e 2 ajustes até o fim do jogo.

Plano completo: [ROADMAP.md](ROADMAP.md).

## Novidades da versão 4

- **10 armadores lendários** (fictícios, inspirados nos maiores da história) para usar no lugar do armador do seu time — `src/data/legends.js`.
- **Playbook defensivo** (TAB → aba DEFESA, ou teclas 1–6 na defesa): Individual, Individual com trocas, Hedge no pick and roll, Dobrar no armador, Zona 2-3, Pressão quadra toda. O adversário escolhe a dele e muda durante o jogo (se você pontuar seguido, ele dobra em você ou vai para a zona). O HUD mostra a defesa adversária — leia e escolha a jogada certa. `src/data/defense.js`
- **Coberturas de pick and roll** pela IA: drop, hedge, blitz (dobra) e troca.
- **Volta na marcação**: depois de perder a bola, quem está atrás corre para proteger a cesta e cada um pega o atacante mais perigoso mais próximo.
- **Faltas e lances livres**: falta no arremesso (2 ou 3 lances, ou "cesta e falta" +1), falta ao tentar roubar, bônus a partir da 5ª falta coletiva. No seu lance livre: segure e solte K.
- **Comando de companheiro**: E + 1–4 manda o ala cortar para a cesta ou o grandalhão vir bloquear para você.
- **Step-back** (L enquanto segura K), **flutuante** e **gancho** automáticos quando há defensor colado entre você e o aro.
- **Dificuldade** (fácil/normal/difícil) e **modo** (até 21 ou 6 minutos com morte súbita).
- **Gamepad**: analógico/direcional move, A arremessa, X passa, B crossover, Y comando, RB sprint, START pausa, SELECT/LB playbook.

## Times e jogadores

30 franquias inspiradas na NBA (mais uma versão histórica de cada, 60 no total), cada uma com 5 jogadores (ratings de 3 pontos, meia distância, finalização, passe, velocidade, defesa, rebote e **altura**). O PG de cada time é um armador craque com estilo próprio (arremessador de elite, armador gigante, "professor" da meia distância, atleta explosivo...).

**A altura importa:** sprite maior, rebote, toco e contestação (um defensor mais alto reduz mais a chance do arremesso).

Estilos (builds) do seu armador: **Passador**, **Chutador**, **Infiltrador**.

## Lendo a defesa

- A IA marca conforme o estilo: cola em grandes atiradores, dá espaço para quem não arremessa e afunda no garrafão.
- **DOBRA!** — atirador de elite perto da linha de 3, finalizador no garrafão ou craque com a bola recebem marcação dupla. Quem saiu para dobrar deixou alguém livre: ache-o.
- **AJUDA** — se você passa do marcador, outro defensor fecha a cesta.
- Losango verde = companheiro livre · amarelo = leitura da jogada · seta do passe vermelha = linha arriscada.

## Playbook (17 jogadas)

Pick and roll, Pick and pop, Isolação, Corte pelas costas, Saída do bloqueio, Espaçar 5 abertos, Cortes cruzados, Horns, Spain pick and roll, Floppy, Hammer, Elevador, Zipper, Flex, Iverson, Stagger, Drag duplo. O playbook (TAB) mostra um diagrama de cada uma.

## Onde mexer

| O quê | Onde |
|---|---|
| Balanceamento (velocidades, chances, dobras, altura, pontuação) | `src/config.js` |
| Times, jogadores, ratings, alturas | `src/data/teams.js` |
| Builds | `src/data/builds.js` |
| Jogadas (dados) | `src/plays/library.js` · posições em `src/plays/spots.js` |
| Movimentação sem bola | `src/ai/MotionOffense.js` |
| Decisões de quem tem a bola, transição | `src/ai/OffenseAI.js` |
| Defesa (dobras, ajuda, leitura de estilo) | `src/ai/DefenseAI.js` |
| Regras, posse contínua, seus controles | `src/scenes/GameScene.js` |
| Pausa / playbook / controles | `src/scenes/MenuScene.js` |
| Arte | `src/art/sprites.js` |

Só a defesa adversária troca marcação nos bloqueios (`DEFENSE.pnrSwitchChance`, 0 = nunca). O seu time nunca troca: você é sempre o armador.

### Arte real

Carregue os PNGs no `BootScene` com as mesmas chaves (`p_<time>_<0-4>`, `ball`, `court`, `board_top`, `board_bottom`, `rim_back`, `net`…). Jogador: spritesheet 16×30 com 12 frames (0–5 de frente: parado, corrida 1–4, arremesso; 6–11 de costas), pé na última linha.
