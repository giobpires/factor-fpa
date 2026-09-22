// Roda as consultas de usuarios da plataforma no BigQuery e grava os totais em
// data/plataforma.json (um registro por dia). So contagens agregadas.
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TABLE = '`bossabox-data.bossabox_platform_trusted.users`';
const BASE = `FROM ${TABLE} WHERE deleted IS NOT TRUE`;
const QUERIES = {
  cadastros:  `SELECT COUNT(*) AS n ${BASE}`,
  pql:        `SELECT COUNT(*) AS n ${BASE} AND prolancerqualifiedlead = TRUE`,
  developers: `SELECT COUNT(*) AS n ${BASE} AND user_roles IN ('BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'MOBILE_DEVELOPER')`,
  designers:  `SELECT COUNT(*) AS n ${BASE} AND user_roles = 'PRODUCT_DESIGNER'`,
  produto:    `SELECT COUNT(*) AS n ${BASE} AND user_roles IN ('PRODUCT_OWNER', 'PRODUCT_MANAGER')`,
};
const OUT = 'data/plataforma.json';

const credentials = JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || credentials.project_id, credentials });

const row = { date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) };
for (const [key, sql] of Object.entries(QUERIES)) {
  const [rows] = await bq.query({ query: sql, location: process.env.BQ_LOCATION || undefined });
  row[key] = Number(rows[0].n);
  console.log(key, row[key]);
}

const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { snapshots: [] };
data.snapshots = data.snapshots.filter(s => s.date !== row.date).concat(row).sort((a, b) => a.date.localeCompare(b.date));
data.updatedAt = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
