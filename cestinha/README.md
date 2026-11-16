# Cestinha A NBA pra quem dormiu

Site que acompanha a NBA para fãs brasileiros, com resumos no tom de resenha.
Custo zero: GitHub (gratuito) + o Claude do seu plano escrevendo os textos.

## Como funciona

```
ESPN ──(GitHub Actions, de hora em hora)──> data/raw/        números: placar, box score
                                               │
             tarefa agendada do Claude <───────┘  lê o que é novo e escreve
                         │
                         └──> content/rascunhos/ ──finalizar.js──> content/jogos|rodadas  (vai pro site)
                                                              └──> content/revisao        (você olha antes)
                                                                          │
                  GitHub Actions monta o site (build.js) e publica no GitHub Pages
```

- **Números sempre vêm da ESPN**, nunca da IA. O site mostra placar e box score direto dos dados.
- O `finalizar.js` confere se placares, `pts/reb/ast` e nomes citados existem nos dados.
  Qualquer dúvida manda o texto para `content/revisao/`, que **não** é publicado.
- `data/processed.json` guarda o que já foi escrito, para nunca repetir.

## Pastas e arquivos

| Caminho | O que é |
|---|---|
| `prompts/cestinha.md` | O prompt do Cestinha (persona, regras, formato). |
| `ROTINA.md` | Passo a passo que a tarefa agendada segue. |
| `scripts/fontes/espn.js` | Único arquivo que conhece a ESPN. Se a fonte quebrar, troque só ele. |
| `scripts/coletar.js` | Coleta (roda no GitHub Actions). |
| `scripts/pendentes.js` | Lista o que falta escrever. |
| `scripts/entrada.js` | Monta os dados que o Cestinha lê antes de escrever. |
| `scripts/finalizar.js` | Confere os textos e decide: site ou revisão. |
| `scripts/aprovar.js` | Aprova um texto da revisão. |
| `scripts/build.js` | Gera o site em `_site/`. |
| `site/assets/` | Visual do site (cores, ícone). |
| `config/brasileiros.json` | Brasileiros na NBA (ganham +1 de importância). Atualize a cada temporada. |
| `.github/workflows/atualizar.yml` | O robô do GitHub (coleta + publicação). |

## Rodar no seu computador (opcional)

Precisa do [Node.js](https://nodejs.org) versão 20 ou mais nova.

```bash
node scripts/coletar.js          # busca jogos de ontem e hoje
node scripts/pendentes.js        # o que falta escrever
node scripts/build.js            # gera o site em _site/
```
Abra `_site/index.html` no navegador para ver.

## Publicar (uma vez só)

1. Envie estes arquivos para o repositório `jcastilho-droid/cestinha` (público).
2. No GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. Em **Actions**, abra "Atualizar Cestinha" e clique em **Run workflow**.
4. O site fica em `https://jcastilho-droid.github.io/cestinha/`.

Domínio próprio (`cestinha.livemode.space`): quando o domínio for liberado, crie o arquivo
`site/CNAME` com o domínio dentro e configure em **Settings > Pages > Custom domain**.

## Tarefa agendada (quem escreve os textos)

Ela roda no Claude, segue o `ROTINA.md` e envia os textos com um token do GitHub
restrito a este repositório. O token fica só na tarefa, nunca no código.

- **Pausar:** no Claude, abra a lista de tarefas agendadas e desative a do Cestinha.
  O GitHub Actions continua coletando e o site continua no ar, só param os textos novos.
- **Pausar a coleta também:** no GitHub, **Actions > Atualizar Cestinha > ⋯ > Disable workflow**.
- **Token vencido:** crie um novo (mesmas permissões) e atualize a mensagem da tarefa.

## Trocar o prompt

Edite `prompts/cestinha.md` (dá para editar direto no site do GitHub, no ícone de lápis).
A próxima execução da tarefa já usa a versão nova.

## Textos em revisão

Ficam em `content/revisao/` com a lista de `alertas`. Para cada um:
- **Aprovar:** `node scripts/aprovar.js jogo-<id>.json` (ou peça ao Claude: "aprove o texto X do Cestinha").
- **Descartar:** apague o arquivo. Ele não volta, porque já está em `data/processed.json`.

## Trocar a fonte de dados

Crie `scripts/fontes/outra.js` com as mesmas funções de `espn.js`
(`buscarPlacar`, `buscarDetalhe`, `listarJogos`, `normalizarJogo`) e troque o `import`
no topo de `scripts/coletar.js`. O resto do projeto não muda.
