# Cestinha — acervo editorial reutilizável (sem API paga)

A atualização do Cestinha monta automaticamente as artes do carrossel a partir de um **acervo fixo de 30 escudos e 30 jogadores**. Não gera uma nova imagem para cada notícia, não precisa da API do ChatGPT, Claude ou de outro serviço pago.

## De onde vêm as artes

- **Escudo:** logo da franquia disponibilizado na fonte ESPN, transformado em peça SVG com textura de papel, serigrafia e cores do time.
- **Jogador:** imagem de referência do atleta disponibilizada na fonte ESPN, tratada em SVG com posterização, textura e recorte editorial.
- **Montagem:** HTML/CSS sobrepõe as duas peças e adiciona elementos abstratos, sem acrescentar **placares, números, datas ou manchetes dentro dos arquivos**.
- Os arquivos **ficam no próprio GitHub**, em `site/assets/identidade/escudos/SIGLA.svg` e `site/assets/identidade/jogadores/SIGLA-ID.svg`. Cada arte contém a imagem de origem embutida; não exige o CDN no carregamento dos SVGs já gerados.
- Crédito editorial na home. As imagens são **ilustrações baseadas em retratos e logotipos da ESPN**, não fotografias das partidas. Verifique direitos de uso dos retratos e das marcas da NBA antes de exploração comercial.

**Limitação artística:** este é um tratamento editorial automatizado de retratos e escudos, não uma pintura inédita de cada jogador feita por um modelo de imagens.

## Jogadores escolhidos

A configuração `config/arte-times.json` contém a preferência editorial de um jogador por time, com nome e ID da fonte. Antes de usar qualquer preferência, a rotina confirma a existência do ID **e do nome** no elenco coletado.

Se o jogador trocar de time ou sair da lista, a rotina seleciona automaticamente outro atleta do elenco (priorizando médias de pontuação e jogos disputados). O arquivo é nomeado com o **ID do jogador**, então uma arte de um jogador de outro time não é reutilizada por engano.

Na manchete, se outro atleta do mesmo time for citado e não houver uma arte correspondente no acervo, o slide mostra o **escudo**, evitando ilustrar a notícia com uma estrela irrelevante.

## Como a automação funciona

1. O GitHub Actions já coleta os dados da ESPN, como antes.
2. Executa `node scripts/gerar-acervo.js` e cria somente as peças ausentes do acervo: 30 escudos e 30 jogadores inicialmente.
3. Salva os SVGs na branch `main` com commit de bot `[skip ci]` para não criar ciclos.
4. Executa `node scripts/build.js`. O carrossel combina os arquivos localmente em templates de duelo, resumo da rodada e cartões menores.
5. Executa testes do mapeamento, associação de elenco, imagens e carrossel; publica no GitHub Pages.

**Não é necessário configurar `OPENAI_API_KEY`.** A rotina anterior de geração de colagens por notícia foi desativada no workflow. A chave pode ser removida dos GitHub Secrets caso tenha sido criada exclusivamente para isso. As WebP antigas em `site/assets/colagens` permanecem arquivadas, mas não são usadas na home.

## Personalizar o destaque de um time

Abra `config/arte-times.json` e substitua o objeto do time pelo nome e ID exatos do jogador que está em `data/times/SIGLA.json` → `elenco`. Na próxima publicação, o sistema criará a nova arte caso ainda não exista.

Se o CDN da ESPN não responder, o processo não produz uma arte incorreta: tenta de novo na próxima atualização. Escudos carregam o logo remoto da fonte como reserva; jogadores ausentes deixam espaço para uma composição só de escudos.

## Testes

Dentro da pasta `cestinha/`:

```sh
node scripts/gerar-acervo.js --dry-run
node scripts/gerar-acervo.js
node scripts/build.js
node scripts/testar-acervo.js
node scripts/test-home-carousel.js
```

O modo `--dry-run` não baixa nem cria arquivos. O uso das imagens no site é gratuito em termos de API de IA; continuam existindo os custos normais de armazenamento/hospedagem se os serviços usados deixarem de ter plano gratuito.
