# Factor FP&A

Central de operações de FP&A da Factor. Site estático (HTML, CSS e JS, sem build),
no mesmo formato do Dash Finance, pronto para a Vercel.

## Páginas

| Rota | Página | Fonte |
|---|---|---|
| `#/visao-geral` | A empresa em uma tela + leitura automática | BASE KLIP, base de MRR, take rate |
| `#/dash/<aba>` | Dash Finance (código do `bossabox-dashboard` com a marca Factor) | BASE KLIP, Claudinho, KPIs SaaS, Headcount |
| `#/margem` | Take rate por cliente, projeto e prolancer (mês atual) | MRR aba BD + Custos com Prolancer |
| `#/reports` | Astella (gera o Excel) e Redpoint (copia a coluna do mês) | BASE KLIP + `templates/astella-template.xlsx` |
| `#/forecast` | Cenários de resultado a partir do mês vigente | BASE KLIP |
| `#/orcamento` | Em construção | |

## Regras de cálculo

- Receita líquida = receita bruta (Valor Competência) x (1 - 9,05%).
- Take rate R$ = receita líquida - custo de prolancer. Take rate % = take rate R$ / receita líquida.
- Projetos internos (`BOSSABOX`) ficam fora da margem. Lista em `FPA.PROJETOS_INTERNOS` (`js/core.js`).
- Mês vigente = último mês com receita na BASE KLIP. Mês fechado = último mês antes do mês corrente.
- Forecast base igual à aba Forecast do dash: receita pela linha "Previsão receita", take rate 50%,
  custos e despesas repetem o mês vigente, rendimento de 0,7% a.m. sobre o saldo, caixa pela queima média.

## Fontes

Todas as URLs ficam em `FPA.SOURCES` (`js/core.js`). Hoje são CSVs publicados na web.

## Rodar local

```
python -m http.server 8765
```
e abrir http://127.0.0.1:8765

## Marca

`assets/tokens.css`, `assets/fonts.css` e `assets/brand/` vêm do brand skill da Factor (2026-08-06).
Cor sempre por token. Laranja pinta, não escreve: texto laranja usa `--primary-text`.

## Métricas da plataforma (BigQuery)

`.github/workflows/sync-bigquery.yml` roda todo dia às 09:10 (Brasília) as consultas em
`bossabox-data.bossabox_platform_trusted.users` e grava os totais em `data/plataforma.json`
(cadastros, PQL, developers, designers, POs/PMs). O report Redpoint lê esse arquivo.

Configuração (uma vez), em Settings > Secrets and variables > Actions:

| Secret | Valor |
|---|---|
| `GCP_SERVICE_ACCOUNT_B64` | JSON da service account, inteiro, em base64 |
| `GCP_PROJECT_ID` | projeto onde as consultas rodam (ex.: `bossabox-data`) |

A service account precisa dos papéis **BigQuery Job User** e **BigQuery Data Viewer** no
projeto `bossabox-data`. Base64 no PowerShell:
`[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\chave.json"))`
