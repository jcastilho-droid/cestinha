# Colagens editoriais automáticas — Cestinha

A home usa **cinco artes de colagem editorial** (recortes, papel rasgado, tratamento de revista esportiva e ilustrações de atletas). Quando surgem notícias novas, o robô verifica quais imagens ainda não existem e solicita uma arte diferente para cada notícia.

## Ativar (uma vez)

1. Crie uma chave da API em https://platform.openai.com/api-keys e habilite faturamento/limites na sua conta da API da OpenAI. **A assinatura do ChatGPT não inclui créditos da API.**
2. No GitHub, abra `https://github.com/jcastilho-droid/cestinha/settings/secrets/actions`. Clique em **New repository secret**.
3. Preencha **Name** com `OPENAI_API_KEY` e **Secret** com a chave. Salve. **Nunca coloque a chave no código, no commit nem neste arquivo.**
4. Para disparar uma verificação imediatamente: [Actions → Atualizar Cestinha](https://github.com/jcastilho-droid/cestinha/actions/workflows/atualizar.yml) → **Run workflow** → branch `main`.

Se o Secret estiver ausente, a geração de imagens é pulada sem interromper as atualizações normais. O site exibirá uma ilustração vetorial de reserva para notícias sem arte até o Secret ser configurado.

## Como funciona

- A cada atualização agendada e quando entram novos textos na `main`, `scripts/build.js` escolhe os destaques reais da home e grava temporariamente o manifesto em `.cache/artes-home.json`.
- `scripts/testar-geracao-colagens.js` e `scripts/gerar-colagens.js --dry-run` testam os identificadores **sem consumir créditos**.
- `scripts/gerar-colagens.js` consulta a API de imagens **somente para as artes ausentes**, usando `gpt-image-2.6-flare`, qualidade média e formato WebP.
- O arquivo `site/assets/colagens/rodada-2026-11-25.webp` é uma **referência visual de estilo**, não um molde de pessoas ou de composição. O prompt pede novas cenas para cada notícia e proíbe imagens fotográficas, textos, logos e repetição de layout.
- As imagens geradas são gravadas como `site/assets/colagens/<arteId>.webp`, com IDs separados para rodada e jogo; nunca sobrescreve as existentes.
- O GitHub Actions salva os arquivos na `main` usando `[skip ci]` para evitar loop de execuções, recompila a home e publica o GitHub Pages.
- Se houver falha, o relatório aparece nos detalhes do GitHub Actions, e o arquivo faltante fica disponível para tentativa na próxima atualização.

## Consumo e controles

- Limite atual: **até cinco novas artes por execução**, nunca cobra para artes já salvas.
- A API de imagens é **cobrada por uso**, separadamente do ChatGPT. Preços e limites são definidos na sua conta da OpenAI; monitore o consumo e configure um orçamento de API.
- Modelo: variável `CESTINHA_ART_MODEL` no workflow (padrão `gpt-image-2.6-flare`).
- Limite: variável `CESTINHA_ART_MAX_PER_RUN` no workflow, travada em no máximo 5 pelo script.
- Desligar: remova o Secret `OPENAI_API_KEY` (as artes antigas permanecem no site).
- Recriar manualmente uma arte: remova do repositório **apenas o arquivo correspondente** e execute o workflow novamente. Isso gera uma nova imagem e incorre em novo custo.

## Testes locais

Dentro de `cestinha/`:

```bash
node scripts/build.js
CESTINHA_ART_MANIFEST=.cache/artes-home.json node scripts/build.js
node scripts/testar-geracao-colagens.js
node scripts/gerar-colagens.js --dry-run
node scripts/test-home-carousel.js
```

O script não dispara API no modo `--dry-run`. Nunca envie o token pelo chat ou por arquivos públicos.

**Importante:** as imagens são ilustrações editoriais e não devem ser descritas como fotografias reais dos jogos. Conferir periodicamente a qualidade dos novos resultados continua recomendado.
