# ROTINA do Cestinha (a tarefa agendada segue isto a cada execução)

Você é a tarefa agendada do Cestinha. Ninguém está olhando: não faça perguntas,
siga os passos na ordem e, se algo der errado, pare no passo indicado e registre o motivo
no relatório final.

A coleta de dados NÃO é sua: o GitHub Actions busca os jogos na ESPN de hora em hora
e salva em `data/raw/`. Você só **escreve** os textos.

## 1. Preparar
O repositório `jcastilho-droid/cestinha` já vem clonado pela tarefa (não precisa de token).
Entre na pasta dele, traga a versão mais nova da branch `main` e entre na subpasta `cestinha/`,
onde fica o projeto. **Todos os comandos abaixo rodam dentro de `cestinha/`.**
```bash
git checkout main && git pull --rebase origin main
cd cestinha
```
Trabalhe e envie SEMPRE na branch `main` (nunca crie branch `claude/...`):
o site só é publicado a partir da `main`. Se o pull falhar, pare e relate "falha ao atualizar o repositório".

## 2. Ver o que é novo
```bash
node scripts/pendentes.js
```
- Se `nada_novo` for `true`: pare aqui e relate "nada novo". (Isso economiza o limite do plano.)
- `jogos`: cada jogo finalizado que ainda não tem resumo.
- `rodadas`: rodadas com todos os jogos finalizados e ainda sem resumo da rodada.

## 3. Ler o prompt (uma vez por execução)
Leia `prompts/cestinha.md` inteiro. Ele define persona, regras de ouro e formato.
Regras extras desta rotina:
- Responda em **JSON puro e válido** (sem os comentários `//` do modelo, sem crases).
- `status`: use `CONFIRMADO` em `resumo_jogo` e `resumo_rodada` (resultado oficial).
- `jogadores`: só nomes que aparecem na entrada, escritos como na entrada.
- Estatística sempre no formato `32 pts, 11 reb, 8 ast` (a checagem automática confere esses números).
- Placar sempre como `112 a 108`.
- Os campos `*_em_ingles` estão em inglês só como referência: traduza a ideia, não copie.
- Se a entrada tiver contradição ou dado faltando que atrapalhe o texto, escreva mesmo assim
  e explique em `alertas` (o texto vai para revisão em vez de ir ao site).

## 4. Escrever os resumos de jogo
Para cada item de `jogos`:
```bash
node scripts/entrada.js jogo <id>
```
Escreva o texto no modo `resumo_jogo` usando SOMENTE essa entrada e salve em
`content/rascunhos/jogo-<id>.json` (com a ferramenta de escrever arquivos).

## 5. Escrever o resumo da rodada
Só depois de terminar os jogos. Se `jogos_ficaram_para_depois` for maior que 0, pule este passo.
Para cada item de `rodadas`:
```bash
node scripts/entrada.js rodada <AAAA-MM-DD>
```
Escreva no modo `resumo_rodada` e salve em `content/rascunhos/rodada-<AAAA-MM-DD>.json`.
Ordem: os 3 jogos mais importantes primeiro (use `importancia_do_resumo` e o contexto).

## 6. Conferir e organizar
```bash
node scripts/finalizar.js
```
Esse script confere cada rascunho (formato, tamanho, placares, números `pts/reb/ast`
e nomes contra os dados). Sem alertas, o texto vai para `content/jogos/` ou `content/rodadas/`;
com alertas, vai para `content/revisao/` e **não** é publicado. Ele também atualiza
`data/processed.json`. Não corrija nem mova arquivos de `content/revisao/` por conta própria.

Depois, garanta que o site monta sem erro:
```bash
node scripts/build.js
```
Se o build falhar, pare sem enviar e relate o erro.

## 7. Publicar
```bash
git add content data/processed.json
git commit -m "cestinha: textos de $(date -u +%Y-%m-%dT%H:%MZ)"
for i in 1 2 3; do git pull --rebase origin main && git push origin HEAD:main && break; sleep 10; done
```
O envio dispara o GitHub Actions, que monta e publica o site sozinho em 1 a 2 minutos.

## 8. Relatório final
Responda em poucas linhas, em português:
- quantos textos foram publicados e quais foram para revisão (com os alertas);
- se algo falhou e em qual passo.
Se houver item em revisão, comece o relatório com "ATENÇÃO: há texto em revisão".
