// Nucleo da intranet: fontes de dados, leitura de CSV, formatacao e o modelo
// da BASE KLIP (DRE e Caixa) usado por Visao geral, Forecast e Reports.
window.FPA = window.FPA || {};

FPA.SOURCES = {
  // Planilha "DRE e Caixa - BossaBox" (mesmas abas que o Dash Finance ja usa)
  klip:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0NxVfw_SJYRQax7JC14qXj-XQo1wE5Ovn9mx5S-CmNf6B-9e09wMgjrGZrKxmRDKf3wkZX-dQWn5F/pub?gid=128442830&single=true&output=csv',
  claudinho: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0NxVfw_SJYRQax7JC14qXj-XQo1wE5Ovn9mx5S-CmNf6B-9e09wMgjrGZrKxmRDKf3wkZX-dQWn5F/pub?gid=409694309&single=true&output=csv',
  saas:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0NxVfw_SJYRQax7JC14qXj-XQo1wE5Ovn9mx5S-CmNf6B-9e09wMgjrGZrKxmRDKf3wkZX-dQWn5F/pub?gid=431006973&single=true&output=csv',
  headcount: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_kqP7PFLJXzsKuAq8UCQKdiGLqp4iKyK-zPGfPDjHSod3_65XBLEM1gCekyAwOTB0J8e_VevaIg3M/pub?gid=1001524307&single=true&output=csv',
  // Planilha de MRR, aba BD: receita por cliente/projeto e competencia
  mrrBD:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_t0U-JRbmG0KS797yTWnNc_IJGTeE7ctM81nnl6bWYQJ6mFicuqWhYg1mf2v0eHMNXBDf4vQIlLpm/pub?gid=2120586905&single=true&output=csv',
  // Planilha de take rate, aba Custos com Prolancer (foto do mes atual)
  takeRate:  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwYmzvB-ZNqpOLts3kkjAj09dGMAitP_17oUxHr_RwtTq66NlJRovdeg8mgsTikqjsfdRzI7sYbK1R/pub?gid=1862891390&single=true&output=csv',
  // Report Redpoint (Google Sheets)
  redpoint:  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSCltwSos9jjzrgsFZ-sHEtPswWmvwLRrb-BN4Ewh0kZppPLQEJ7Uf-7T96SQcVZHIRXBRr8ssW57u/pub?gid=1959416167&single=true&output=csv',
  redpointView: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSCltwSos9jjzrgsFZ-sHEtPswWmvwLRrb-BN4Ewh0kZppPLQEJ7Uf-7T96SQcVZHIRXBRr8ssW57u/pubhtml?gid=1959416167&single=true',
};

// Deducao da receita bruta para liquida (impostos sobre faturamento)
FPA.DEDUCAO = 0.0905;
// Projetos internos que nao entram na margem
FPA.PROJETOS_INTERNOS = ['BOSSABOX'];

// --- CSV ---------------------------------------------------------------------
const _csvCache = {};
FPA.csv = function (url) {
  if (!_csvCache[url]) {
    const u = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    _csvCache[url] = fetch(u, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar CSV');
      return r.text();
    }).then(t => {
      if (!t || t.length < 50) throw new Error('CSV vazio ou invalido');
      return t;
    }).catch(e => { delete _csvCache[url]; throw e; });
  }
  return _csvCache[url];
};

FPA.parseCSV = function (text) {
  const rows = []; let cur = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { cur.push(field); field = ''; }
    else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
};

// Numero em formato brasileiro: "1.234,56", "(22.933)", "-", "12%"
FPA.num = function (s) {
  if (s === null || s === undefined) return null;
  s = String(s).trim().replace(/\s/g, '').replace(/R\$/g, '');
  if (!s || s === '-' || s === '—' || s === '*' || s.startsWith('#')) return null;
  const neg = s.startsWith('(') && s.endsWith(')');
  const pct = s.endsWith('%');
  s = s.replace(/[()%]/g, '').replace(/\./g, '').replace(',', '.');
  let v = parseFloat(s);
  if (isNaN(v)) return null;
  if (neg) v = -v;
  return pct ? v / 100 : v;
};

// --- Formatacao --------------------------------------------------------------
FPA.brl = function (n, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return 'n/d';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
};
FPA.brlShort = function (n) {
  if (n === null || n === undefined || isNaN(n)) return 'n/d';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
  if (a >= 1e3) return s + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k';
  return s + 'R$ ' + a.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};
FPA.pct = function (n, dec = 1) {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return 'n/d';
  return (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
};
FPA.int = function (n) {
  if (n === null || n === undefined || isNaN(n)) return 'n/d';
  return Math.round(n).toLocaleString('pt-BR');
};
FPA.signPct = function (n, dec = 1) {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return 'n/d';
  return (n > 0 ? '+' : '') + FPA.pct(n, dec);
};
FPA.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Meses -------------------------------------------------------------------
FPA.MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
FPA.MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
FPA.monthLabel = (y, m) => FPA.MESES[m - 1] + '/' + String(y).slice(2);
FPA.today = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
FPA.ym = (y, m) => y * 100 + m;

// --- Modelo KLIP -------------------------------------------------------------
// Cada serie vira um array alinhado com K.months ([{y,m,label,col}]).
let _klip = null;
FPA.klip = function () {
  if (_klip) return _klip;
  _klip = FPA.csv(FPA.SOURCES.klip).then(text => {
    const rows = FPA.parseCSV(text);
    const header = rows[1] || [];
    const months = [];
    for (let c = 2; c < header.length; c++) {
      const mt = (header[c] || '').trim().toLowerCase().match(/^([a-zç]{3})[a-zç]*\.?\/(\d{4})$/);
      if (!mt) break;
      const m = FPA.MESES.indexOf(mt[1]) + 1;
      if (m < 1) break;
      const y = parseInt(mt[2], 10);
      months.push({ y, m, col: c, label: FPA.monthLabel(y, m) });
    }
    const labelOf = r => (r[1] || '').replace(/\s+/g, ' ').trim();
    const find = re => rows.find(r => re.test(labelOf(r)));
    const s = re => { const r = find(re); return months.map(mo => r ? FPA.num(r[mo.col]) : null); };
    const K = {
      rows, months,
      series: s,
      grossRevenue: s(/^Gross Revenue$/i), previsao: s(/^Previs.o receita$/i),
      mrrIni: s(/^MRR inicial$/i), newMRR: s(/^New MRR$/i), upsell: s(/^Upsell$/i),
      downsell: s(/^Downsell$/i), churn: s(/^Churn$/i), mrrFin: s(/^MRR final$/i), arrFin: s(/^ARR final$/i),
      cliIni: s(/^Clientes inicial$/i), novosCli: s(/^Novos clientes$/i), churnCli: s(/^Churn clientes$/i), cliFin: s(/^Clientes final$/i),
      recBruta: s(/^Receita Bruta$/i), recLiq: s(/^Receita l.quida$/i), prolancer: s(/^Prolancer$/i),
      trR: s(/^Take rate R\$$/i), trPct: s(/^Take rate %$/i), custos: s(/^Custos$/i),
      mgR: s(/^Margem bruta R\$$/i), mgPct: s(/^Margem bruta %$/i), despesas: s(/^Despesas$/i),
      ebitda: s(/^EBITDA R\$$/i), ebitdaPct: s(/^EBITDA %$/i), da: s(/^Deprecia/i), ebit: s(/^\(=\) EBIT$/i),
      resFin: s(/^Resultado Financeiro$/), resNop: s(/^Resultado n.o operacional$/i), ir: s(/^IR & CSLL$/i),
      lucro: s(/^\(=\) Lucro L.quido$/i), lucroPct: s(/^Lucro l.quido %$/i),
      saldoIni: s(/^Saldo inicial$/i), entradas: s(/^Entradas$/i), pagamentos: s(/^Pagamentos$/i),
      geracaoOp: s(/^Gera..o\/Queima Operacional$/i), resFinCaixa: s(/^Resultado financeiro$/), burn: s(/^Burn$/i),
      aportes: s(/^Aportes$/i), saldoForaBr: s(/^Saldo Fora Br$/i), saldoFin: s(/^Saldo final$/i), runway: s(/^Runway$/i),
      ticket: s(/^Ticket m.dio$/i), hc: s(/^Headcount final$/i), arrHc: s(/^ARR\/Headcount$/i),
      recBudg: s(/^Receita Budg$/i), ebitdaBudg: s(/^EBITDA Budg$/i), resBudg: s(/^Resultado Budg$/i),
      saldoBudg: s(/^Saldo Budg$/i), burnBudg: s(/^Burn Budg$/i),
    };
    // Mes vigente = ultimo mes com receita. Fechado = ultimo mes anterior ao mes corrente do calendario.
    K.curIdx = 0;
    K.grossRevenue.forEach((v, i) => { if (v !== null) K.curIdx = i; });
    const t = FPA.today(), tk = FPA.ym(t.y, t.m);
    K.closedIdx = K.curIdx;
    for (let i = K.curIdx; i >= 0; i--) {
      if (FPA.ym(months[i].y, months[i].m) < tk && K.grossRevenue[i] !== null) { K.closedIdx = i; break; }
    }
    K.idxOf = (y, m) => months.findIndex(mo => mo.y === y && mo.m === m);
    return K;
  }).catch(e => { _klip = null; throw e; });
  return _klip;
};

// --- Base de MRR (aba BD) ----------------------------------------------------
let _mrr = null;
FPA.mrrBD = function () {
  if (_mrr) return _mrr;
  _mrr = FPA.csv(FPA.SOURCES.mrrBD).then(text => {
    const rows = FPA.parseCSV(text);
    const h = rows[0].map(x => x.trim());
    const ix = name => h.indexOf(name);
    const iCli = ix('Cliente (Nome Fantasia)'), iRaz = ix('Cliente (Razão Social)'), iProj = ix('Projeto'),
      iType = ix('Contract Type'), iComp = ix('Mês Competência'), iVal = ix('Valor Competência'),
      iFat = ix('Valor Faturamento'), iStatus = ix('Status');
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const x = rows[r];
      const mt = (x[iComp] || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!mt || !x[iProj]) continue;
      out.push({
        cliente: (x[iCli] || x[iRaz] || '').trim(), razao: (x[iRaz] || '').trim(),
        projeto: x[iProj].replace(/\s+/g, ' ').trim(), tipo: (x[iType] || '').trim(),
        y: +mt[3], m: +mt[2], bruta: FPA.num(x[iVal]) || 0, faturamento: FPA.num(x[iFat]) || 0,
        status: (x[iStatus] || '').trim(),
      });
    }
    return out;
  }).catch(e => { _mrr = null; throw e; });
  return _mrr;
};

// Projetos ativos e novos projetos por mes (usado no report Redpoint e na Visao geral)
FPA.projectStats = function (mrr, y, m) {
  const key = p => p.toUpperCase();
  const first = {};
  mrr.forEach(r => {
    if (!r.bruta) return;
    const k = key(r.projeto), v = FPA.ym(r.y, r.m);
    if (!(k in first) || v < first[k]) first[k] = v;
  });
  const ativos = new Set(mrr.filter(r => r.y === y && r.m === m && r.bruta).map(r => key(r.projeto)));
  const novos = Object.values(first).filter(v => v === FPA.ym(y, m)).length;
  return { ativos: ativos.size, novos };
};

// --- Custos com prolancer (take rate) ----------------------------------------
let _take = null;
FPA.takeRate = function () {
  if (_take) return _take;
  _take = FPA.csv(FPA.SOURCES.takeRate).then(text => {
    const rows = FPA.parseCSV(text);
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const [proj, nome, val] = rows[r];
      if (!proj || /^total/i.test(proj.trim())) continue;
      out.push({ projeto: proj.replace(/\s+/g, ' ').trim(), prolancer: (nome || '').trim(), valor: FPA.num(val) || 0 });
    }
    return out;
  }).catch(e => { _take = null; throw e; });
  return _take;
};

// --- UI helpers --------------------------------------------------------------
FPA.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

FPA.spark = function (vals, opts = {}) {
  const w = opts.w || 120, h = opts.h || 32, pad = 2;
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] !== null && p[1] !== undefined);
  if (pts.length < 2) return '';
  const ys = pts.map(p => p[1]);
  const min = Math.min(...ys, opts.zero ? 0 : Infinity), max = Math.max(...ys, opts.zero ? 0 : -Infinity);
  const sx = i => pad + (i / (vals.length - 1)) * (w - pad * 2);
  const sy = v => max === min ? h / 2 : pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const d = pts.map((p, k) => (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  const zero = (opts.zero && min < 0 && max > 0) ? `<line x1="0" x2="${w}" y1="${sy(0)}" y2="${sy(0)}" class="spark-zero"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${zero}<path d="${d}" class="spark-line"/><circle cx="${sx(last[0])}" cy="${sy(last[1])}" r="2.5" class="spark-dot"/></svg>`;
};

FPA.loading = (msg = 'Carregando dados das planilhas') => `<div class="state-loading"><span class="spinner" aria-hidden="true"></span>${msg}</div>`;
FPA.errorBox = (e, fonte) => `<div class="callout callout--warn"><p class="callout-label">Erro ao carregar ${FPA.esc(fonte || 'dados')}</p><p>${FPA.esc(e && e.message || e)}. Confira se a planilha continua publicada na web.</p></div>`;

FPA.dashError = function (e) {
  const host = document.getElementById('dash-status');
  if (host) host.innerHTML = FPA.errorBox(e, 'a BASE KLIP');
};

// Paleta de graficos (ordem do brand book)
FPA.CHART = { orange: '#FF7100', malva: '#3C1B26', rosa: '#E3CDCD', bege: '#FFE1BD', cinza: '#AEAEAE', grid: '#ECECE1', text: '#636363' };
FPA.alpha = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};
