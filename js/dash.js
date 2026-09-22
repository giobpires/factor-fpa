// Dash Finance: codigo do dashboard original (github.com/giobpires/bossabox-dashboard),
// portado para a intranet. Logica de dados e graficos preservada; cores e fonte
// trocadas para a identidade Factor. Exposto como window.initLegacyDash.
const CSV_URL = FPA.SOURCES.klip;
const HC_CSV_URL = FPA.SOURCES.headcount;
const CLAUDINHO_CSV_URL = FPA.SOURCES.claudinho;
const SAAS_CSV_URL = FPA.SOURCES.saas;
let HC_PESSOAL = [];
function parseHCCSV(text) {
  // Formato: linha 0=título, 1=premissas, 2=cabeçalho (com newlines dentro de aspas), dados a partir da linha 3
  // Parser CSV completo que respeita campos entre aspas com quebras de linha internas
  var full = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  var rows = [], curRow = [], curField = '', inQ = false;
  for (var i = 0; i <= full.length; i++) {
    var c = i < full.length ? full[i] : '\n';
    if (inQ) {
      if (c === '"' && full[i+1] === '"') { curField += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { curField += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { curRow.push(curField); curField = ''; }
      else if (c === '\n') { curRow.push(curField); rows.push(curRow); curRow = []; curField = ''; }
      else { curField += c; }
    }
  }
  function brNum(s) {
    if (!s) return 0;
    var v = parseFloat(s.replace(/R\$\s*/g,'').replace(/\./g,'').replace(',','.').trim());
    return isNaN(v) ? 0 : v;
  }
  function brPct(s) {
    if (!s) return 0;
    var v = parseFloat(s.replace('%','').replace(',','.').trim());
    return isNaN(v) ? 0 : v;
  }
  // rows[0]=título, rows[1]=premissas, rows[2]=cabeçalho — pular os 3 primeiros
  for (var i = 3; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0] || !r[0].trim()) continue;
    var name = r[0].trim();
    if (name.toUpperCase().indexOf('TOTAL') === 0) continue;
    HC_PESSOAL.push([
      (r[4]||'').trim(),  // custo_despesa
      (r[3]||'').trim(),  // interno_prolancer
      (r[2]||'').trim(),  // tipo
      (r[1]||'').trim(),  // cargo_funcao
      name,               // nome
      brNum(r[5]),        // salario
      brNum(r[6]),        // inss_pat
      brNum(r[7]),        // rat
      brNum(r[8]),        // terc
      brNum(r[9]),        // fgts
      brNum(r[10]),       // prov13
      brNum(r[11]),       // provfer
      brNum(r[12]),       // inss13
      brNum(r[13]),       // inssfer
      brNum(r[14]),       // fgts13
      brNum(r[15]),       // fgtsfer
      brNum(r[16]),       // total_enc
      brNum(r[17]),       // va
      brNum(r[18]),       // saude
      brNum(r[19]),       // sind
      brNum(r[20]),       // total
      brPct(r[21])        // pct
    ]);
  }
}
function fetchHCData() {
  var url = HC_CSV_URL + '&t=' + Date.now();
  return fetch(url).then(function(resp) { return resp.text(); }).then(function(text) {
    HC_PESSOAL = [];
    parseHCCSV(text);
    renderHCPessoal();
  }).catch(function(e) {
    console.warn('HC CSV fetch falhou:', e);
    renderHCPessoal();
  });
}
function renderHCPessoal() {
  var cd = document.getElementById('hc-f-cd').value;
  var ip = document.getElementById('hc-f-ip').value;
  var tipo = document.getElementById('hc-f-tipo').value;
  var filtered = HC_PESSOAL.filter(function(r) {
    return (!cd || r[0] === cd) && (!ip || r[1] === ip) && (!tipo || r[2] === tipo);
  });
  var tbody = document.getElementById('hc-pessoal-tbody');
  if (!tbody) return;
  var totalCusto = 0;
  var cols = [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
  var sums = cols.map(function() { return 0; });
  var rows = filtered.map(function(r) {
    totalCusto += r[20];
    cols.forEach(function(c,i) { sums[i] += r[c]; });
    var cd=r[0],ip=r[1],ti=r[2],fn=r[3],nm=r[4];
    var v=r;
    function fmt(x) { return x ? fmtBRL(x) : '<span style="color:var(--ink-mute)">—</span>'; }
    return '<tr>' +
      '<td style="min-width:180px;text-align:left">' + nm + '</td>' +
      '<td style="min-width:130px;text-align:left">' + fn + '</td>' +
      '<td style="text-align:center">' + ti + '</td>' +
      '<td style="text-align:center">' + ip + '</td>' +
      '<td style="text-align:center">' + cd + '</td>' +
      '<td>' + fmt(v[5]) + '</td>' +
      '<td>' + fmt(v[6]) + '</td>' +
      '<td>' + fmt(v[7]) + '</td>' +
      '<td>' + fmt(v[8]) + '</td>' +
      '<td>' + fmt(v[9]) + '</td>' +
      '<td>' + fmt(v[10]) + '</td>' +
      '<td>' + fmt(v[11]) + '</td>' +
      '<td>' + fmt(v[12]) + '</td>' +
      '<td>' + fmt(v[13]) + '</td>' +
      '<td>' + fmt(v[14]) + '</td>' +
      '<td>' + fmt(v[15]) + '</td>' +
      '<td>' + fmt(v[16]) + '</td>' +
      '<td>' + fmt(v[17]) + '</td>' +
      '<td>' + fmt(v[18]) + '</td>' +
      '<td>' + fmt(v[19]) + '</td>' +
      '<td style="font-weight:600;color:var(--blue-dark)">' + fmtBRL(v[20]) + '</td>' +
      '<td>' + fmtPct(v[21],2) + '</td>' +
      '</tr>';
  });
  var totalRow = '<tr class="total">' +
    '<td>TOTAL (' + filtered.length + ' colaboradores)</td>' +
    '<td></td><td></td><td></td><td></td>' +
    cols.slice(0,14).map(function(c,i) {
      return '<td>' + fmtBRL(sums[i]) + '</td>';
    }).join('') +
    '<td style="font-weight:700;color:var(--blue-dark)">' + fmtBRL(sums[15]) + '</td>' +
    '<td>' + fmtPct(filtered.reduce(function(a,r){return a+r[21];},0),2) + '</td>' +
    '</tr>';
  tbody.innerHTML = rows.join('') + totalRow;
  var countEl = document.getElementById('hc-count');
  var totalEl = document.getElementById('hc-total-label');
  if (countEl) countEl.textContent = filtered.length + ' colaboradores';
  if (totalEl) totalEl.textContent = '· Total: ' + fmtBRL(totalCusto);
}

async function fetchCSV(baseUrl) { return FPA.csv(baseUrl); }
Chart.defaults.font.family = "'TASA Orbiter', system-ui, sans-serif";
Chart.defaults.font.size = 10;
Chart.defaults.color = '#636363';
function parseCSV(text) {
  const rows = []; let cur = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (ch === '\r') {}
      else { field += ch; }
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}
function parseBR(s) {
  if (!s) return null;
  s = s.toString().trim().replace(/\s/g, '').replace(/R\$/g,'');
  if (!s || s === '-' || s === '#DIV/0!' || s === '#N/A' || s === '*' || s === '—') return null;
  const neg = s.startsWith('(') && s.endsWith(')');
  s = s.replace(/[()]/g, '');
  s = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  return neg ? -v : v;
}
function fmtBRL(n, opts = {}) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (opts.short) {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e6) return sign + 'R$ ' + (abs/1e6).toLocaleString('pt-BR', {minimumFractionDigits:3,maximumFractionDigits:3}) + 'M';
    if (abs >= 1e3) return sign + 'R$ ' + (abs/1e3).toLocaleString('pt-BR', {minimumFractionDigits:0,maximumFractionDigits:0}) + 'k';
    return sign + 'R$ ' + abs.toLocaleString('pt-BR', {minimumFractionDigits:0,maximumFractionDigits:0});
  }
  return n.toLocaleString('pt-BR', {style:'currency',currency:'BRL',maximumFractionDigits:0});
}
function fmtNum(n, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function fmtPct(n, dec = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {minimumFractionDigits:dec,maximumFractionDigits:dec}) + '%';
}
function fmtShort(n) { return fmtBRL(n, {short:true}); }
function normalizeLabel(s) {
  s = (s||'').trim().toLowerCase();
  const m = s.match(/^(\w+)\.?\s*\/\s*(\d{4})$/);
  if (m) return m[1].slice(0,3) + '/' + m[2].slice(2);
  return s;
}
function findRow(rows, pattern) {
  const re = new RegExp(pattern, 'i');
  return rows.find(r => r[1] && re.test(r[1].trim())) || [];
}
function monthlyVals(row) {
  const out = [];
  for (let c = 2; c <= 25; c++) out.push(parseBR(row[c]));
  return out;
}
function annualVals(row) {
  const cols = [38,39,40,41,42,43];
  return cols.map(c => parseBR(row[c]));
}
const QDEFS = [
  {label:'Q1/25', mi:[0,1,2]},{label:'Q2/25', mi:[3,4,5]},{label:'Q3/25', mi:[6,7,8]},{label:'Q4/25', mi:[9,10,11]},
  {label:'Q1/26', mi:[12,13,14]},{label:'Q2/26', mi:[15,16,17]},{label:'Q3/26', mi:[18,19,20]},{label:'Q4/26', mi:[21,22,23]},
];
function aggQuarter(arr, mode='sum') {
  return QDEFS.map(q => {
    const vals = q.mi.map(i => arr[i]).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    if (mode === 'sum') return vals.reduce((a,b)=>a+b,0);
    if (mode === 'avg') return vals.reduce((a,b)=>a+b,0)/vals.length;
    if (mode === 'last') return vals[vals.length-1];
    return null;
  });
}
function aggYearPair(arr, mode='sum') {
  const y25 = arr.slice(0,12), y26 = arr.slice(12,24);
  const v25vals = y25.filter(v=>v!==null), v26vals = y26.filter(v=>v!==null);
  const agg = (vals, m) => {
    if (!vals.length) return null;
    if (m==='sum') return vals.reduce((a,b)=>a+b,0);
    if (m==='avg') return vals.reduce((a,b)=>a+b,0)/vals.length;
    if (m==='last') return vals[vals.length-1];
  };
  return [agg(v25vals,mode), agg(v26vals,mode)];
}
function win(arr, lastIdx) {
  const start = Math.max(0, lastIdx - 11);
  return arr.slice(start, lastIdx + 1);
}
const charts = {};
const TOOLTIP_BASE = {
  backgroundColor: '#FFFFFF', borderColor: '#E4E4DA', borderWidth: 1,
  titleColor: '#000000', bodyColor: '#2E2E2E', padding: 8,
};
const GRID_OPTS = { color: '#ECECE1', drawBorder: false };
async function initLegacyDash() {
  let rows, rows2, rows3;
  try {
    const csvText = await fetchCSV(CSV_URL);
    rows = parseCSV(csvText);
  } catch(e) {
    FPA.dashError(e);
    return;
  }
  try {
    const csvText2 = await fetchCSV(CLAUDINHO_CSV_URL);
    rows2 = parseCSV(csvText2);
  } catch(e) {
    console.warn('Base Claudinho CSV fetch falhou:', e);
    rows2 = [];
  }
  try {
    const csvText3 = await fetchCSV(SAAS_CSV_URL);
    rows3 = parseCSV(csvText3);
  } catch(e) {
    console.warn('KPIs SaaS CSV fetch falhou:', e);
    rows3 = [];
  }
  function monthlyVals2(row) {
    const out = Array(12).fill(null);
    for (let c = 2; c <= 13; c++) out.push(parseBR(row[c]));
    return out;
  }
  function get2(pattern) { return monthlyVals2(findRow(rows2, pattern)); }
  // Colunas fixas da base Claudinho após os 12 meses: Q1,Q2,Q3,Q4 (15-18), YTD (20), H1 (22), H2 (23), FULL YEAR (25)
  function get2Aux(pattern) {
    const row = findRow(rows2, pattern);
    return { q: [15,16,17,18].map(i => parseBR(row[i])), ytd: parseBR(row[20]) };
  }
  function monthlyVals3(row) {
    const out = [];
    // col 5 = jan/25 ... col 25 = set/26 (mês corrente); antes o loop parava em ago/26 (col 24)
    // e descartava set/26 mesmo quando já preenchido na planilha.
    for (let c = 5; c <= 25; c++) out.push(parseBR(row[c]));
    while (out.length < 24) out.push(null);
    return out;
  }
  function findRow3(pattern) {
    const re = new RegExp(pattern, 'i');
    return rows3.find(r => r[4] && re.test(r[4].trim())) || [];
  }
  function get3(pattern) { return monthlyVals3(findRow3(pattern)); }
  const headerRow = rows[1] || [];
  const ALL_MONTHS = [];
  for (let c = 2; c <= 25; c++) ALL_MONTHS.push(normalizeLabel(headerRow[c] || ''));
  const grRow = findRow(rows, /^Gross Revenue$/);
  const grVals = monthlyVals(grRow);
  let LAST_IDX = 0;
  for (let i = 0; i < grVals.length; i++) { if (grVals[i] !== null) LAST_IDX = i; }
  const curYear = parseInt('20' + ALL_MONTHS[LAST_IDX].split('/')[1]);
  const prevYear = curYear - 1;
  document.querySelectorAll('#budget-year-label, #budget-year-title').forEach(el => el.textContent = curYear);
  const snapshotLabel = ALL_MONTHS[LAST_IDX];
  document.getElementById('snapshot-date').textContent = snapshotLabel.replace('/', '/');
  const WIN_MONTHS = ALL_MONTHS.slice(Math.max(0,LAST_IDX-11), LAST_IDX+1);
  const YEAR_CUR_LABELS = ['jan/26','fev/26','mar/26','abr/26','mai/26','jun/26','jul/26','ago/26','set/26','out/26','nov/26','dez/26'];
  function get(pattern) { return monthlyVals(findRow(rows, pattern)); }
  function getAnn(pattern) { return annualVals(findRow(rows, pattern)); }
  const D = {
    grossRevenue:get(/^Gross Revenue$/), mrrIni:get(/MRR inicial/i), newMRR:get(/New MRR/i),
    upsell:get(/^Upsell$/i), downsell:get(/^Downsell$/i), churnMRR:get(/^Churn$/i), mrrFin:get(/MRR final/i),
    arrFin:get(/ARR final/i), cliIni:get(/Clientes inicial/i), novos:get(/Novos clientes/i),
    churnCli:get(/Churn clientes/i), cliFin:get(/Clientes final/i),
    egmR:get(/EGM \$/i), egmPct:get(/EGM %/i), e2eR:get(/E2E \$/i), e2ePct:get(/E2E %/i),
    servicesR:get(/Services \$/i), servicesPct:get(/Services %/i),
    ltm:get(/^LTM$/i), ticket:get(/Ticket m/i), rendimentos:get(/Rendimentos/i),
    recBruta:get(/Receita\s+Bruta$/i), recLiq:get(/Receita l[íi]quida$/i), prolancer:get(/^Prolancer$/i),
    trR:get(/Take rate R\$/i), trPct:get(/Take rate %/i), custos:get(/^Custos$/i),
    mgBrutaR:get(/Margem bruta R\$/i), mgBrutaPct:get(/Margem bruta %/i), despesas:get(/^Despesas$/i),
    ebitdaR:get(/EBITDA R\$/i), ebitdaPct:get(/EBITDA %/i), deprec:get(/Deprecia/i),
    ebit:get(/EBIT$|\(=\) EBIT/i), resFin:get(/Resultado Financeiro/i),
    resNop:get(/Resultado n[ãa]o operacional/i), lair:get(/LAIR/i), ircsll:get(/IR & CSLL/i),
    lucroR:get(/\(=\) Lucro L[íi]quido/i), lucroPct:get(/Lucro l[íi]quido %/i),
    saldoIni:get(/Saldo inicial/i), entradas:get(/^Entradas$/i), pagamentos:get(/^Pagamentos$/i),
    geracaoOp:get(/Gera.*Queima/i), burnTotal:get(/^Burn$/i), aportes:get(/^Aportes$/i),
    saldoFin:get(/Saldo final/i), runway:get(/^Runway$/i), hcFinal:get(/Headcount final/i),
    prazoRec:findRow(rows, /Prazo m.*recebimentos/i), prazoPag:findRow(rows, /Prazo m.*pagamentos/i),
    prazoNet:findRow(rows, /^Net$/i),
    recReal:get(/Receita Real/i), recBudg:get(/Receita Budg/i),
    recLiqReal:get(/Receita L[íi]q\. Real/i), recLiqBudg:get(/Receita L[íi]q\. Budg/i),
    trReal:get(/TR Real/i), trBudg:get(/TR Budg$/i), trPctReal:get(/TR % Real/i), trPctBudg:get(/TR % Budg/i),
    mgReal:get(/Margem Real/i), mgBudg:get(/Margem Budg/i),
    mgPctReal:get(/Margem % Real/i), mgPctBudg:get(/Margem % Budg/i),
    ebitdaReal:get(/EBITDA Real/i), ebitdaBudg:get(/EBITDA Budg/i),
    ebitdaPctReal:get(/EBITDA % Real/i), ebitdaPctBudg:get(/EBITDA % Budg/i),
    resReal:get(/Resultado Real/i), resBudg:get(/Resultado Budg/i),
    resPctReal:get(/Resultado % Real/i), resPctBudg:get(/Resultado % Budg/i),
    burnReal:get(/Burn Real/i), burnBudg:get(/Burn Budg/i),
    hcDireto:get(/Headcount direto/i), hcIndireto:get(/Headcount indireto/i),
    arrHcDireto:get(/ARR\/ Headcount direto/i), gmHcDireto:get(/Gross Margin \/Headcount/i), arrHc:get(/ARR\/Headcount$/i),
    previsaoReceita:get(/Previs.o receita/i), saldoBudg:get(/Saldo Budg/i), custosBudg:get2(/^Custos Budg$/i),
    mrrIniBudg:get2(/MRR inicial Budg/i), mrrFinBudg:get2(/MRR final Budg/i), arrFinBudg:get2(/ARR final Budg/i),
    upsellBudg:get2(/^Upsell Budg$/i), downsellBudg:get2(/^Downsell Budg$/i), churnBudg:get2(/^Churn Budg$/i),
    ndrReal:get2(/NDR Real/i), ndrBudg:get2(/NDR Budg/i),
    smBudg:get2(/Sales & Mkt Budg/i), gaBudg:get2(/G&A Budg/i), rdBudg:get2(/R&D Budg/i),
    hcBudg:get2(/^Headcount Budg$/i),
    despesasMktSales:get3(/Despesas MKT e Sales/i), cac:get3(/^CAC$/i), cacPct:get3(/^%$/),
    lt:get3(/^LT \(meses\)$/i), ltv:get3(/^LTV$/i), ltvCac:get3(/^LTV\/CAC$/i),
    cacPorCliente:get3(/^CAC por cliente$/i), cacPayback:get3(/^CAC payback/i),
    saasMagicNumber:get3(/SaaS n.mero m.gico/i), crescReceitaPct:get3(/Crescimento receita/i),
    ruleOf40:get3(/^Rule of 40$/i), financialChurn:get3(/^Financial Churn$/i),
  };
  function zip(a, b, fn) { return a.map((v,i) => (v===null||v===undefined||b[i]===null||b[i]===undefined) ? null : fn(v,b[i])); }
  D.despesasBudg = zip(zip(D.smBudg, D.gaBudg, (a,b)=>a+b), D.rdBudg, (a,b)=>a+b);
  D.arrHcBudg = zip(D.arrFinBudg, D.hcBudg, (a,b)=> b ? a/b : null);
  D.netMrrReal = zip(D.mrrFin, D.mrrIni, (a,b)=>a-b);
  D.netMrrBudg = zip(D.mrrFinBudg, D.mrrIniBudg, (a,b)=>a-b);
  // Upsell/Downsell/Churn cells are often blank ("-") when there was simply no movement that
  // month — treat those as 0, not as missing data (only a null MRR inicial means "no data").
  function num0(v) { return (v===null||v===undefined) ? 0 : v; }
  function ndrNum(mrrIniArr, upArr, downArr, churnArr) {
    return mrrIniArr.map((mi,i) => mi===null ? null : mi + num0(upArr[i]) + num0(downArr[i]) + num0(churnArr[i]));
  }
  D.ndrNumReal = ndrNum(D.mrrIni, D.upsell, D.downsell, D.churnMRR);
  D.ndrNumBudg = ndrNum(D.mrrIniBudg, D.upsellBudg, D.downsellBudg, D.churnBudg);
  D.saldoIniBudg = Array(24).fill(null);
  for (let i=12;i<=23;i++) D.saldoIniBudg[i] = (i===12) ? D.saldoFin[11] : D.saldoBudg[i-1];
  // Range helpers reused by the KPIs and Forecast tabs (arrays are 24-elem, index 12=jan/26..23=dez/26)
  function sumRange(arr, i0, i1) {
    let has=false, s=0;
    for (let i=i0;i<=i1;i++){ if(arr[i]!==null&&arr[i]!==undefined){s+=arr[i];has=true;} }
    return has ? s : null;
  }
  function lastNonNull(arr, i0, i1) {
    for (let i=i1;i>=i0;i--){ if(arr[i]!==null&&arr[i]!==undefined) return arr[i]; }
    return null;
  }
  function firstNonNull(arr, i0, i1) {
    for (let i=i0;i<=i1;i++){ if(arr[i]!==null&&arr[i]!==undefined) return arr[i]; }
    return null;
  }
  function ratioRange(numArr, denArr, i0, i1) {
    const n = sumRange(numArr, i0, i1), d = sumRange(denArr, i0, i1);
    if (n===null || d===null || d===0) return null;
    return (n/d)*100;
  }
  function growthRange(arr, i0, i1) {
    if (i0<1 || arr[i1]===null || arr[i0-1]===null || !arr[i0-1]) return null;
    return (arr[i1]/arr[i0-1]-1)*100;
  }
  function fmtCell(v, fmt) {
    if (v===null||v===undefined||isNaN(v)) return '—';
    if (fmt==='brl') return fmtShort(v);
    if (fmt==='pct') return fmtPct(v,1);
    if (fmt==='num1') return fmtNum(v,1);
    return fmtNum(v,0);
  }
  function tdCell(v, fmt, extraCls) {
    const cls = (v!==null && v!==undefined && v<0) ? ' neg' : '';
    return `<td class="${extraCls||''}${cls}">${fmtCell(v,fmt)}</td>`;
  }
  const hcCCRows = [], pessoalRows = [];
  let hcSecIdx = -1, pesSecIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const b = (rows[i][1]||'').trim();
    if (b === 'Headcount p/ CC') hcSecIdx = i;
    if (b === 'Pessoal p/ CC') pesSecIdx = i;
  }
  const CC_AREAS = ['Delivery','Engineering','Finance','Labs','Legal','Marketing','Operations','Sales','Talent','Product','Services'];
  if (hcSecIdx >= 0) {
    for (let j = 1; j <= 15 && hcSecIdx+j < rows.length; j++) {
      const b = (rows[hcSecIdx+j][1]||'').trim();
      if (CC_AREAS.includes(b)) hcCCRows.push(monthlyVals(rows[hcSecIdx+j]));
    }
  }
  if (pesSecIdx >= 0) {
    for (let j = 1; j <= 15 && pesSecIdx+j < rows.length; j++) {
      const b = (rows[pesSecIdx+j][1]||'').trim();
      if (CC_AREAS.includes(b)) pessoalRows.push(monthlyVals(rows[pesSecIdx+j]));
    }
  }
  const grAnn = getAnn(/^Gross Revenue$/);
  const ANN_YEARS = ['2021','2022','2023','2024','2025','2026 YTD'];
  const ytd2026 = D.grossRevenue.slice(12,LAST_IDX+1).filter(v=>v!==null).reduce((a,b)=>a+b,0);
  grAnn[5] = ytd2026;
  const W = idx => (arr) => arr.slice(Math.max(0,idx-11), idx+1);
  const wArr = W(LAST_IDX);
  function aqN(arr, mode) {
    const q = aggQuarter(arr, mode);
    const wq = [];
    QDEFS.forEach((qd,i)=>{ if(q[i]!==null) wq.push({label:qd.label,val:q[i]}); });
    return wq.slice(-4);
  }
  function lastNonNullFromRow(row) {
    if (!row) return null;
    for (let i = row.length - 1; i >= 2; i--) {
      const v = parseBR(row[i]);
      if (v !== null && v !== 0) return v;
    }
    for (let i = row.length - 1; i >= 2; i--) {
      const v = parseBR(row[i]);
      if (v !== null) return v;
    }
    return null;
  }
  const prazoRecVal = lastNonNullFromRow(D.prazoRec);
  const prazoPagVal = lastNonNullFromRow(D.prazoPag);
  const prazoNetVal = lastNonNullFromRow(D.prazoNet);
  document.getElementById('kpi-recv').textContent = prazoRecVal !== null ? fmtNum(prazoRecVal,0) : '—';
  const kpiPay = document.getElementById('kpi-pay');
  kpiPay.textContent = prazoPagVal !== null ? fmtNum(prazoPagVal,0) : '—';
  const kpiNet = document.getElementById('kpi-net');
  kpiNet.textContent = prazoNetVal !== null ? fmtNum(prazoNetVal,0) : '—';
  if (prazoNetVal !== null && prazoNetVal < 0) kpiNet.classList.add('neg');
  const C = {
    // Paleta Factor: laranja e o acento, malva/rosa/bege/cinza sao apoio
    blue:'#3C1B26', blueL:'#7A5260', blueD:'#000000',
    green:'#FFB36B', red:'#3C1B26', yellow:'#FF7100',
    gray:'#AEAEAE', chart:'#8C8C84', grayL:'#D9D9CF',
    greenL:'#FF7100', pink:'#E3CDCD',
    cc: ['#FF7100','#3C1B26','#E3CDCD','#FFE1BD','#AEAEAE','#CA3F00','#7A5260','#FFB36B','#636363','#C9B0B0','#000000']
  };
  function alpha(hex, a) {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function simpleBarOpts(yFmt, legend=false) {
    return {
      responsive:true, maintainAspectRatio:false, animation:{duration:300},
      plugins:{
        legend:{display:legend,position:'bottom',labels:{boxWidth:8,font:{size:9},padding:6}},
        tooltip:{...TOOLTIP_BASE,callbacks:{label:ctx=>' '+( yFmt?yFmt(ctx.parsed.y):fmtShort(ctx.parsed.y))}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:9},maxRotation:45,minRotation:30}},
        y:{grid:{color:'#ECECE1'},ticks:{font:{size:9},callback: yFmt||(v=>fmtShort(v))}}
      }
    };
  }
  function simpleLineOpts(yFmt, legend=false) {
    const o = simpleBarOpts(yFmt, legend);
    o.elements = { line:{tension:0.35,borderWidth:2}, point:{radius:3,hoverRadius:5} };
    return o;
  }
  function mixedOpts() {
    const o = simpleBarOpts(null, true);
    o.scales.y2 = { position:'right', grid:{display:false}, ticks:{font:{size:9},callback:v=>fmtPct(v,1)} };
    o.plugins.tooltip.callbacks.label = function(ctx) {
      const isPctAxis = ctx.dataset && ctx.dataset.yAxisID === 'y2';
      const valFmt = isPctAxis ? fmtPct(ctx.parsed.y, 1) : fmtShort(ctx.parsed.y);
      const label = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
      return ' ' + label + valFmt;
    };
    return o;
  }
  function mk(id, type, labels, datasets, opts) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    charts[id] = new Chart(canvas.getContext('2d'), {type, data:{labels,datasets}, options:opts});
  }
  // TAB 1 — REVENUE
  { const o=simpleBarOpts(); mk('c-gr-m','bar',WIN_MONTHS,[{label:'Receita Bruta',data:wArr(D.grossRevenue),backgroundColor:alpha(C.yellow,0.7),borderColor:C.yellow,borderWidth:0,borderRadius:0}],o); }
  { const qd=aqN(D.grossRevenue,'sum'); mk('c-gr-q','bar',qd.map(x=>x.label),[{label:'Receita Bruta',data:qd.map(x=>x.val),backgroundColor:alpha(C.yellow,0.7),borderColor:C.yellow,borderWidth:0,borderRadius:0}],simpleBarOpts()); }
  { mk('c-gr-y','bar',ANN_YEARS,[{label:'Receita Bruta',data:grAnn,backgroundColor:grAnn.map((_,i)=>i===grAnn.length-1?alpha(C.yellow,0.4):alpha(C.yellow,0.7)),borderColor:C.yellow,borderWidth:0,borderRadius:0}],simpleBarOpts()); }
  {
    const o=simpleLineOpts(null,true);
    mk('c-mrr-m','line',WIN_MONTHS,[
      {label:'MRR Inicial',data:wArr(D.mrrIni),borderColor:C.gray,borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'MRR Final',data:wArr(D.mrrFin),borderColor:C.yellow,fill:false,tension:0.35,pointRadius:3,borderWidth:2.5}
    ],o);
    const qIni=aqN(D.mrrIni,'avg'),qFin=aqN(D.mrrFin,'last');
    mk('c-mrr-q','line',qFin.map(x=>x.label),[
      {label:'MRR Inicial',data:qIni.map(x=>x.val),borderColor:C.gray,borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'MRR Final',data:qFin.map(x=>x.val),borderColor:C.yellow,fill:false,tension:0.35,pointRadius:3,borderWidth:2.5}
    ],o);
    mk('c-mrr-y','bar',[prevYear+'',curYear+' YTD'],[{label:'MRR Final',data:[D.mrrFin[11],D.mrrFin[LAST_IDX]],backgroundColor:[alpha(C.yellow,0.7),alpha(C.yellow,0.4)],borderColor:C.yellow,borderWidth:0,borderRadius:0}],simpleBarOpts());
  }
  {
    function mevDs(wfn) {
      return [
        {label:'New MRR',data:wfn(D.newMRR),backgroundColor:alpha(C.greenL,0.85),borderColor:C.greenL,borderWidth:0,borderRadius:0},
        {label:'Upsell',data:wfn(D.upsell),backgroundColor:alpha(C.green,0.85),borderColor:C.green,borderWidth:0,borderRadius:0},
        {label:'Downsell',data:wfn(D.downsell),backgroundColor:alpha(C.pink,0.85),borderColor:C.pink,borderWidth:0,borderRadius:0},
        {label:'Churn',data:wfn(D.churnMRR),backgroundColor:alpha(C.red,0.85),borderColor:C.red,borderWidth:0,borderRadius:0},
      ];
    }
    const stackOpts=(o)=>{o.scales.x.stacked=true;o.scales.y.stacked=true;return o;};
    mk('c-mev-m','bar',WIN_MONTHS,mevDs(wArr),stackOpts(simpleBarOpts(null,true)));
    const qd=aqN(D.newMRR,'sum');
    mk('c-mev-q','bar',qd.map(x=>x.label),[
      {label:'New MRR',data:aqN(D.newMRR,'sum').map(x=>x.val),backgroundColor:alpha(C.greenL,0.85),borderColor:C.greenL,borderWidth:0},
      {label:'Upsell',data:aqN(D.upsell,'sum').map(x=>x.val),backgroundColor:alpha(C.green,0.85),borderColor:C.green,borderWidth:0},
      {label:'Downsell',data:aqN(D.downsell,'sum').map(x=>x.val),backgroundColor:alpha(C.pink,0.85),borderColor:C.pink,borderWidth:0},
      {label:'Churn',data:aqN(D.churnMRR,'sum').map(x=>x.val),backgroundColor:alpha(C.red,0.85),borderColor:C.red,borderWidth:0},
    ],stackOpts(simpleBarOpts(null,true)));
    mk('c-mev-y','bar',[prevYear+' (4 comp.)',curYear+' YTD'],[
      {label:'New MRR',data:[D.newMRR.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.newMRR.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.greenL,0.8),borderColor:C.greenL,borderWidth:0},
      {label:'Upsell',data:[D.upsell.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.upsell.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.green,0.8),borderColor:C.green,borderWidth:0},
      {label:'Churn',data:[D.churnMRR.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.churnMRR.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.red,0.8),borderColor:C.red,borderWidth:0},
    ],stackOpts(simpleBarOpts(null,true)));
  }
  {
    const o=simpleLineOpts(v=>Math.round(v)+'',true);
    o.scales.y.ticks.callback=v=>Math.round(v)+'';
    mk('c-cli-m','line',WIN_MONTHS,[
      {label:'Inicial',data:wArr(D.cliIni),borderColor:C.blue,fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Final',data:wArr(D.cliFin),borderColor:C.red,fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Novos',data:wArr(D.novos),borderColor:C.green,fill:false,tension:0.35,pointRadius:4,borderWidth:1.5,borderDash:[3,3]},
      {label:'Churn',data:wArr(D.churnCli),borderColor:C.yellow,fill:false,tension:0.35,pointRadius:4,borderWidth:1.5,borderDash:[3,3]},
    ],o);
    const qF=aqN(D.cliFin,'last');
    mk('c-cli-q','line',qF.map(x=>x.label),[
      {label:'Inicial',data:aqN(D.cliIni,'avg').map(x=>x.val),borderColor:C.blue,fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Final',data:qF.map(x=>x.val),borderColor:C.red,fill:false,tension:0.35,pointRadius:3,borderWidth:2},
    ],simpleLineOpts(v=>Math.round(v)+'',true));
    mk('c-cli-y','bar',[prevYear+'',curYear+' YTD'],[{label:'Clientes Final',data:[D.cliFin[11],D.cliFin[LAST_IDX]],backgroundColor:[alpha(C.blue,0.7),alpha(C.blue,0.4)],borderColor:C.blue,borderWidth:0,borderRadius:0}],simpleBarOpts(v=>Math.round(v)+''));
  }
  {
    const o=simpleBarOpts(v=>fmtPct(v,0),true);
    o.scales.y.ticks.callback=v=>fmtPct(v,0);
    o.plugins.tooltip.callbacks.label=ctx=>' '+fmtPct(ctx.parsed.y,1);
    mk('c-rep-m','bar',WIN_MONTHS,[
      {label:'EGM %',data:wArr(D.egmPct),backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0,borderRadius:0},
      {label:'E2E %',data:wArr(D.e2ePct),backgroundColor:alpha(C.yellow,0.7),borderColor:C.yellow,borderWidth:0,borderRadius:0},
      {label:'Services %',data:wArr(D.servicesPct),backgroundColor:alpha(C.green,0.7),borderColor:C.green,borderWidth:0,borderRadius:0},
    ],o);
    const qE=aqN(D.egmPct,'avg');
    mk('c-rep-q','bar',qE.map(x=>x.label),[
      {label:'EGM %',data:qE.map(x=>x.val),backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0,borderRadius:0},
      {label:'E2E %',data:aqN(D.e2ePct,'avg').map(x=>x.val),backgroundColor:alpha(C.yellow,0.7),borderColor:C.yellow,borderWidth:0,borderRadius:0},
      {label:'Services %',data:aqN(D.servicesPct,'avg').map(x=>x.val),backgroundColor:alpha(C.green,0.7),borderColor:C.green,borderWidth:0,borderRadius:0},
    ],o);
  }
  {
    mk('c-ltm','bar',WIN_MONTHS,[{label:'LTM',data:wArr(D.ltm),backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0,borderRadius:0}],simpleBarOpts(v=>fmtNum(v,1)+' m'));
    mk('c-ticket','line',WIN_MONTHS,[{label:'Ticket Médio',data:wArr(D.ticket),borderColor:C.blue,backgroundColor:alpha(C.blue,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2}],simpleLineOpts());
  }
  // TAB 2 — CASHFLOW
  {
    const o=simpleLineOpts(null,true);
    mk('c-cash-m','line',WIN_MONTHS,[
      {label:'Saldo Inicial',data:wArr(D.saldoIni),borderColor:C.blueL,borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Saldo Final',data:wArr(D.saldoFin),borderColor:C.blue,backgroundColor:alpha(C.blue,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5},
    ],o);
    const qF=aqN(D.saldoFin,'last'),qI=aqN(D.saldoIni,'last');
    mk('c-cash-q','line',qF.map(x=>x.label),[
      {label:'Saldo Inicial',data:qI.map(x=>x.val),borderColor:C.blueL,borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Saldo Final',data:qF.map(x=>x.val),borderColor:C.blue,backgroundColor:alpha(C.blue,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5},
    ],o);
    mk('c-cash-y','bar',[prevYear+'',curYear+' YTD'],[{label:'Saldo Final',data:[D.saldoFin[11],D.saldoFin[LAST_IDX]],backgroundColor:[alpha(C.blue,0.7),alpha(C.blue,0.4)],borderColor:C.blue,borderWidth:0,borderRadius:0}],simpleBarOpts());
  }
  {
    const o=simpleLineOpts(null,true);
    mk('c-burn-m','line',WIN_MONTHS,[
      {label:'Geração Operacional',data:wArr(D.geracaoOp),borderColor:alpha(C.red,0.6),borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Burn Total',data:wArr(D.burnTotal),borderColor:C.red,backgroundColor:alpha(C.red,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5},
    ],o);
    const qB=aqN(D.burnTotal,'sum'),qG=aqN(D.geracaoOp,'sum');
    mk('c-burn-q','line',qB.map(x=>x.label),[
      {label:'Geração Op.',data:qG.map(x=>x.val),borderColor:alpha(C.red,0.6),borderDash:[5,5],fill:false,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Burn Total',data:qB.map(x=>x.val),borderColor:C.red,backgroundColor:alpha(C.red,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5},
    ],o);
    mk('c-burn-y','bar',[prevYear+'',curYear+' YTD'],[{label:'Burn Total',data:[D.burnTotal.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.burnTotal.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:[alpha(C.red,0.7),alpha(C.red,0.4)],borderColor:C.red,borderWidth:0,borderRadius:0}],simpleBarOpts());
  }
  {
    const o=simpleLineOpts(null,true);
    mk('c-recpag-m','line',WIN_MONTHS,[
      {label:'Entradas',data:wArr(D.entradas),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Pagamentos',data:wArr(D.pagamentos),borderColor:C.red,backgroundColor:alpha(C.red,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
    ],o);
    const qE=aqN(D.entradas,'sum'),qP=aqN(D.pagamentos,'sum');
    mk('c-recpag-q','line',qE.map(x=>x.label),[
      {label:'Entradas',data:qE.map(x=>x.val),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Pagamentos',data:qP.map(x=>x.val),borderColor:C.red,backgroundColor:alpha(C.red,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
    ],o);
    mk('c-recpag-y','bar',[prevYear+'',curYear+' YTD'],[
      {label:'Entradas',data:[D.entradas.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.entradas.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0},
      {label:'Pagamentos',data:[D.pagamentos.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.pagamentos.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.red,0.7),borderColor:C.red,borderWidth:0},
    ],simpleBarOpts(null,true));
  }
  {
    mk('c-rend','bar',WIN_MONTHS,[{label:'Rendimentos',data:wArr(D.rendimentos),backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0,borderRadius:0}],simpleBarOpts());
    mk('c-runway','line',WIN_MONTHS,[{label:'Runway',data:wArr(D.runway),borderColor:C.blueD,backgroundColor:alpha(C.blueD,0.1),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5}],simpleLineOpts(v=>fmtNum(v,0)+' m'));
  }
  // TAB 3 — REAL VS BUDGET
  {
    const bLabels=YEAR_CUR_LABELS;
    const REAL_C=C.blue,BUDG_C=C.gray;
    function bRealMon(arr){return arr.slice(12,24);}
    function bBudgMon(arr){return arr.slice(12,24);}
    function budGrouped(id,realArr,budgArr,fmt){
      const o=simpleBarOpts(fmt||null,true);
      o.plugins.tooltip.callbacks.label=ctx=>' '+(fmt?fmt(ctx.parsed.y):fmtShort(ctx.parsed.y));
      mk(id,'bar',bLabels,[
        {label:'Real',data:bRealMon(realArr),backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0,borderRadius:0},
        {label:'Budget',data:bBudgMon(budgArr),backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0,borderRadius:0},
      ],o);
    }
    function budYTDBar(id,realArr,budgArr){
      const rYTD=realArr.slice(12,LAST_IDX+1).filter(v=>v!==null).reduce((a,b)=>a+b,0);
      const bYTD=budgArr.slice(12,LAST_IDX+1).filter(v=>v!==null).reduce((a,b)=>a+b,0);
      const o=simpleBarOpts(null,true);
      mk(id,'bar',['YTD Real','YTD Budget'],[
        {label:'Real',data:[rYTD,null],backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0},
        {label:'Budget',data:[null,bYTD],backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0},
      ],o);
    }
    function budAnoBar(id,realArr,budgArr){
      const rYTD=realArr.slice(12,LAST_IDX+1).filter(v=>v!==null).reduce((a,b)=>a+b,0);
      const bYear=budgArr.slice(12,24).filter(v=>v!==null).reduce((a,b)=>a+b,0);
      const o=simpleBarOpts(null,true);
      mk(id,'bar',['Real YTD','Budget Ano'],[
        {label:'Real YTD',data:[rYTD,null],backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0},
        {label:'Budget Ano',data:[null,bYear],backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0},
      ],o);
    }
    function budPctGrouped(id,realArr,budgArr){
      const o=simpleBarOpts(v=>fmtPct(v,1),true);
      o.plugins.tooltip.callbacks.label=ctx=>' '+fmtPct(ctx.parsed.y,1);
      mk(id,'bar',bLabels,[
        {label:'Real %',data:bRealMon(realArr),backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0},
        {label:'Budget %',data:bBudgMon(budgArr),backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0},
      ],o);
    }
    function budYTDBarPct(id,realArr,budgArr){
      const rVals=realArr.slice(12,LAST_IDX+1).filter(v=>v!==null);
      const bVals=budgArr.slice(12,LAST_IDX+1).filter(v=>v!==null);
      const rYTD=rVals.length?rVals.reduce((a,b)=>a+b,0)/rVals.length:null;
      const bYTD=bVals.length?bVals.reduce((a,b)=>a+b,0)/bVals.length:null;
      const o=simpleBarOpts(v=>fmtPct(v,0),true);
      o.plugins.tooltip.callbacks.label=ctx=>' '+fmtPct(ctx.parsed.y,1);
      mk(id,'bar',['YTD Real','YTD Budget'],[
        {label:'Real',data:[rYTD,null],backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0},
        {label:'Budget',data:[null,bYTD],backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0},
      ],o);
    }
    function budAnoBarPct(id,realArr,budgArr){
      const rVals=realArr.slice(12,LAST_IDX+1).filter(v=>v!==null);
      const bVals=budgArr.slice(12,24).filter(v=>v!==null);
      const rYTD=rVals.length?rVals.reduce((a,b)=>a+b,0)/rVals.length:null;
      const bYear=bVals.length?bVals.reduce((a,b)=>a+b,0)/bVals.length:null;
      const o=simpleBarOpts(v=>fmtPct(v,0),true);
      o.plugins.tooltip.callbacks.label=ctx=>' '+fmtPct(ctx.parsed.y,1);
      mk(id,'bar',['Real YTD','Budget Ano'],[
        {label:'Real YTD',data:[rYTD,null],backgroundColor:alpha(REAL_C,0.75),borderColor:REAL_C,borderWidth:0},
        {label:'Budget Ano',data:[null,bYear],backgroundColor:alpha(BUDG_C,0.5),borderColor:BUDG_C,borderWidth:0},
      ],o);
    }
    budGrouped('c-bud-rec-m',D.recReal,D.recBudg); budYTDBar('c-bud-rec-ytd',D.recReal,D.recBudg); budAnoBar('c-bud-rec-y',D.recReal,D.recBudg);
    budGrouped('c-bud-tr-m',D.trReal,D.trBudg); budYTDBar('c-bud-tr-ytd',D.trReal,D.trBudg); budAnoBar('c-bud-tr-y',D.trReal,D.trBudg);
    budPctGrouped('c-bud-trp-m',D.trPctReal,D.trPctBudg); budYTDBarPct('c-bud-trp-ytd',D.trPctReal,D.trPctBudg); budAnoBarPct('c-bud-trp-y',D.trPctReal,D.trPctBudg);
    budGrouped('c-bud-gm-m',D.mgReal,D.mgBudg); budYTDBar('c-bud-gm-ytd',D.mgReal,D.mgBudg); budAnoBar('c-bud-gm-y',D.mgReal,D.mgBudg);
    budPctGrouped('c-bud-gmp-m',D.mgPctReal,D.mgPctBudg); budYTDBarPct('c-bud-gmp-ytd',D.mgPctReal,D.mgPctBudg); budAnoBarPct('c-bud-gmp-y',D.mgPctReal,D.mgPctBudg);
    budGrouped('c-bud-ebitda-m',D.ebitdaReal,D.ebitdaBudg); budYTDBar('c-bud-ebitda-ytd',D.ebitdaReal,D.ebitdaBudg); budAnoBar('c-bud-ebitda-y',D.ebitdaReal,D.ebitdaBudg);
    budPctGrouped('c-bud-ebitdap-m',D.ebitdaPctReal,D.ebitdaPctBudg); budYTDBarPct('c-bud-ebitdap-ytd',D.ebitdaPctReal,D.ebitdaPctBudg); budAnoBarPct('c-bud-ebitdap-y',D.ebitdaPctReal,D.ebitdaPctBudg);
    budGrouped('c-bud-res-m',D.resReal,D.resBudg); budYTDBar('c-bud-res-ytd',D.resReal,D.resBudg); budAnoBar('c-bud-res-y',D.resReal,D.resBudg);
    budPctGrouped('c-bud-resp-m',D.resPctReal,D.resPctBudg); budYTDBarPct('c-bud-resp-ytd',D.resPctReal,D.resPctBudg); budAnoBarPct('c-bud-resp-y',D.resPctReal,D.resPctBudg);
    budGrouped('c-bud-burn-m',D.burnReal,D.burnBudg); budYTDBar('c-bud-burn-ytd',D.burnReal,D.burnBudg); budAnoBar('c-bud-burn-y',D.burnReal,D.burnBudg);
  }
  // TAB 4 — HEADCOUNT
  {
    mk('c-hc-total','line',WIN_MONTHS,[{label:'Headcount Total',data:wArr(D.hcFinal),borderColor:C.blue,backgroundColor:alpha(C.blue,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5}],simpleLineOpts(v=>Math.round(v)+''));
    mk('c-arr-hc','line',WIN_MONTHS,[{label:'ARR/HC',data:wArr(D.arrHc),borderColor:C.blueD,backgroundColor:alpha(C.blueD,0.08),fill:true,tension:0.35,pointRadius:3,borderWidth:2.5}],simpleLineOpts());
  }
  {
    if (pessoalRows.length >= 11) {
      const o=simpleLineOpts(null,true); o.plugins.legend.labels={boxWidth:8,font:{size:8},padding:4};
      mk('c-rem-m','line',WIN_MONTHS,CC_AREAS.map((a,i)=>({label:a,data:wArr(pessoalRows[i]),borderColor:C.cc[i],fill:false,tension:0.35,pointRadius:2,borderWidth:1.5})),o);
      const qRem=CC_AREAS.map((a,i)=>aqN(pessoalRows[i],'sum')); const qLab=qRem[0].map(x=>x.label);
      mk('c-rem-q','line',qLab,CC_AREAS.map((a,i)=>({label:a,data:qRem[i].map(x=>x.val),borderColor:C.cc[i],fill:false,tension:0.35,pointRadius:2,borderWidth:1.5})),o);
      mk('c-rem-y','bar',[prevYear+'',curYear+' YTD'],CC_AREAS.map((a,i)=>({label:a,data:[pessoalRows[i].slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),pessoalRows[i].slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.cc[i],0.75),borderColor:C.cc[i],borderWidth:0,borderRadius:0})),simpleBarOpts(null,true));
    }
  }
  {
    if (hcCCRows.length >= 11) {
      const o=simpleLineOpts(v=>Math.round(v)+'',true); o.plugins.legend.labels={boxWidth:8,font:{size:8},padding:4};
      mk('c-hcc-m','line',WIN_MONTHS,CC_AREAS.map((a,i)=>({label:a,data:wArr(hcCCRows[i]),borderColor:C.cc[i],fill:false,tension:0.35,pointRadius:2,borderWidth:1.5})),o);
      const qHc=CC_AREAS.map((a,i)=>aqN(hcCCRows[i],'avg')); const qLab=qHc[0].map(x=>x.label);
      mk('c-hcc-q','line',qLab,CC_AREAS.map((a,i)=>({label:a,data:qHc[i].map(x=>x.val),borderColor:C.cc[i],fill:false,tension:0.35,pointRadius:2,borderWidth:1.5})),o);
      mk('c-hcc-y','bar',[prevYear+' (dez))',curYear+' ('+snapshotLabel+')'],CC_AREAS.map((a,i)=>({label:a,data:[hcCCRows[i][11],hcCCRows[i][LAST_IDX]],backgroundColor:alpha(C.cc[i],0.75),borderColor:C.cc[i],borderWidth:0})),simpleBarOpts(v=>Math.round(v)+'',true));
    }
  }
  {
    const o=simpleLineOpts(v=>Math.round(v)+'',true);
    mk('c-hcdi-m','line',WIN_MONTHS,[
      {label:'Direto',data:wArr(D.hcDireto),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Indireto',data:wArr(D.hcIndireto),borderColor:C.greenL,backgroundColor:alpha(C.greenL,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
    ],o);
    const qD=aqN(D.hcDireto,'avg'),qI=aqN(D.hcIndireto,'avg');
    mk('c-hcdi-q','line',qD.map(x=>x.label),[
      {label:'Direto',data:qD.map(x=>x.val),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
      {label:'Indireto',data:qI.map(x=>x.val),borderColor:C.greenL,backgroundColor:alpha(C.greenL,0.07),fill:true,tension:0.35,pointRadius:3,borderWidth:2},
    ],o);
    mk('c-hcdi-y','bar',[prevYear+' (dez)',curYear+' ('+snapshotLabel+')'],[
      {label:'Direto',data:[D.hcDireto[11],D.hcDireto[LAST_IDX]],backgroundColor:alpha(C.blue,0.75),borderColor:C.blue,borderWidth:0},
      {label:'Indireto',data:[D.hcIndireto[11],D.hcIndireto[LAST_IDX]],backgroundColor:alpha(C.greenL,0.75),borderColor:C.greenL,borderWidth:0},
    ],simpleBarOpts(v=>Math.round(v)+'',true));
  }
  {
    mk('c-arrhcd-m','bar',WIN_MONTHS,[{label:'ARR/HC Direto',data:wArr(D.arrHcDireto),backgroundColor:alpha(C.chart,0.7),borderColor:C.chart,borderWidth:0,borderRadius:0}],simpleBarOpts());
    const qA=aqN(D.arrHcDireto,'avg');
    mk('c-arrhcd-q','line',qA.map(x=>x.label),[{label:'ARR/HC Direto',data:qA.map(x=>x.val),borderColor:C.chart,fill:false,tension:0.35,pointRadius:3,borderWidth:2}],simpleLineOpts());
    mk('c-arrhcd-y','bar',[prevYear+'(dez)',curYear+'('+snapshotLabel+')'],[{label:'ARR/HC Direto',data:[D.arrHcDireto[11],D.arrHcDireto[LAST_IDX]],backgroundColor:[alpha(C.chart,0.7),alpha(C.chart,0.4)],borderColor:C.chart,borderWidth:0,borderRadius:0}],simpleBarOpts());
  }
  {
    mk('c-gmhcd-m','bar',WIN_MONTHS,[{label:'GM/HC Direto',data:wArr(D.gmHcDireto),backgroundColor:alpha(C.yellow,0.7),borderColor:C.yellow,borderWidth:0,borderRadius:0}],simpleBarOpts());
    const qG=aqN(D.gmHcDireto,'avg');
    mk('c-gmhcd-q','line',qG.map(x=>x.label),[{label:'GM/HC Direto',data:qG.map(x=>x.val),borderColor:C.yellow,fill:false,tension:0.35,pointRadius:3,borderWidth:2}],simpleLineOpts());
    mk('c-gmhcd-y','bar',[prevYear+' (dez)',curYear+' ('+snapshotLabel+')'],[{label:'GM/HC Direto',data:[D.gmHcDireto[11],D.gmHcDireto[LAST_IDX]],backgroundColor:[alpha(C.yellow,0.7),alpha(C.yellow,0.4)],borderColor:C.yellow,borderWidth:0,borderRadius:0}],simpleBarOpts());
  }
  {
    const closed2026Labels=YEAR_CUR_LABELS.slice(0,LAST_IDX-11);
    const rl=D.recLiq.slice(12,LAST_IDX+1);
    if (pessoalRows.length >= 11 && closed2026Labels.length > 0) {
      const propData=CC_AREAS.map((a,i)=>{
        const rem=pessoalRows[i].slice(12,LAST_IDX+1);
        return rem.map((v,j)=>(v!==null&&rl[j]&&rl[j]!==0)?(v/Math.abs(rl[j]))*100:null);
      });
      const o=simpleBarOpts(v=>fmtPct(v,0),true);
      o.scales.x.stacked=true; o.scales.y.stacked=true;
      o.plugins.tooltip.callbacks.label=ctx=>' '+ctx.dataset.label+': '+fmtPct(ctx.parsed.y,1);
      mk('c-prop','bar',closed2026Labels,CC_AREAS.map((a,i)=>({label:a,data:propData[i],backgroundColor:alpha(C.cc[i],0.8),borderColor:C.cc[i],borderWidth:0})),o);
    }
  }

  // Custo por Colaborador table — dados carregados via CSV dinâmico
  fetchHCData();
  ['hc-f-cd','hc-f-ip','hc-f-tipo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', renderHCPessoal);
  });
  // TAB 5 — DRE GERENCIAL
  {
    const tHead=document.getElementById('dre-thead');
    const tBody=document.getElementById('dre-tbody');
    const wStart=Math.max(0,LAST_IDX-11);
    const wSlice=(arr)=>arr.slice(wStart,LAST_IDX+1);

    // YTD: janeiro do ano corrente (índice 12) até o último mês fechado
    const ytdStart = 12;
    const ytdEnd = LAST_IDX;
    const curYearShort = String(curYear).slice(2);
    const lastMonName = WIN_MONTHS[WIN_MONTHS.length - 1].split('/')[0];
    const ytdColLabel = 'YTD jan–' + lastMonName + '/' + curYearShort;

    // Soma os valores não-nulos no intervalo YTD
    function ytdSum(arr) {
      const vals = arr.slice(ytdStart, ytdEnd + 1).filter(v => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }
    // Calcula % YTD como numerador acumulado / denominador acumulado × 100
    function ytdPct(numArr, denArr) {
      const num = ytdSum(numArr);
      const den = ytdSum(denArr);
      if (num === null || den === null || den === 0) return null;
      return (num / den) * 100;
    }

    let th='<tr><th>Indicador</th>'+WIN_MONTHS.map(m=>`<th>${m}</th>`).join('')+`<th class="ytd-col">${ytdColLabel}</th>`+'</tr>';
    tHead.innerHTML=th;

    const dreRows=[
      {label:'Receita Bruta',    arr:D.recBruta,  cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.recBruta)},
      {label:'Receita Líquida',  arr:D.recLiq,    cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.recLiq)},
      {label:'  Prolancer',      arr:D.prolancer, cls:'neg-row', fmt:'brl', ytd:()=>ytdSum(D.prolancer)},
      {label:'Take Rate R$',     arr:D.trR,       cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.trR)},
      {label:'  Take Rate %',    arr:D.trPct,     cls:'sub',     fmt:'pct', ytd:()=>ytdPct(D.trR, D.recLiq)},
      {label:'Custos',           arr:D.custos,    cls:'neg-row', fmt:'brl', ytd:()=>ytdSum(D.custos)},
      {label:'Margem Bruta R$',  arr:D.mgBrutaR,  cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.mgBrutaR)},
      {label:'  Margem Bruta %', arr:D.mgBrutaPct,cls:'sub',     fmt:'pct', ytd:()=>ytdPct(D.mgBrutaR, D.recLiq)},
      {label:'Despesas',         arr:D.despesas,  cls:'neg-row', fmt:'brl', ytd:()=>ytdSum(D.despesas)},
      {label:'EBITDA R$',        arr:D.ebitdaR,   cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.ebitdaR)},
      {label:'  EBITDA %',       arr:D.ebitdaPct, cls:'sub',     fmt:'pct', ytd:()=>ytdPct(D.ebitdaR, D.recLiq)},
      {label:'Depr. & Amort.',   arr:D.deprec,    cls:'',        fmt:'brl', ytd:()=>ytdSum(D.deprec)},
      {label:'(=) EBIT',         arr:D.ebit,      cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.ebit)},
      {label:'Resultado Financeiro', arr:D.resFin, cls:'',       fmt:'brl', ytd:()=>ytdSum(D.resFin)},
      {label:'Resultado Não Op.',arr:D.resNop,    cls:'',        fmt:'brl', ytd:()=>ytdSum(D.resNop)},
      {label:'(=) LAIR',         arr:D.lair,      cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.lair)},
      {label:'IR & CSLL',        arr:D.ircsll,    cls:'',        fmt:'brl', ytd:()=>ytdSum(D.ircsll)},
      {label:'(=) Lucro Líquido',arr:D.lucroR,    cls:'total',   fmt:'brl', ytd:()=>ytdSum(D.lucroR)},
      {label:'  Lucro Líquido %',arr:D.lucroPct,  cls:'sub',     fmt:'pct', ytd:()=>ytdPct(D.lucroR, D.recLiq)},
    ];
    let tbody='';
    for (const r of dreRows) {
      const vals=wSlice(r.arr);
      let tds=vals.map(v=>{
        if(v===null||v===undefined)return'<td>—</td>';
        const fv=r.fmt==='pct'?fmtPct(v,1):fmtShort(v);
        const cls=v<0?' class="neg"':'';
        return`<td${cls}>${fv}</td>`;
      });
      while(tds.length<12)tds.push('<td>—</td>');

      // Coluna YTD
      const ytdVal = r.ytd ? r.ytd() : null;
      let ytdTd;
      if (ytdVal === null || ytdVal === undefined) {
        ytdTd = '<td class="ytd-col">—</td>';
      } else {
        const fv = r.fmt === 'pct' ? fmtPct(ytdVal, 1) : fmtShort(ytdVal);
        const negCls = ytdVal < 0 ? ' neg' : '';
        ytdTd = `<td class="ytd-col${negCls}">${fv}</td>`;
      }

      tbody+=`<tr class="${r.cls}"><td>${r.label}</td>${tds.join('')}${ytdTd}</tr>`;
    }
    tBody.innerHTML=tbody;
    function dreTriple(mId,qId,yId,barArr,lineArr,barLabel,lineLabel,barColor){
      {
        const o=mixedOpts();
        if(charts[mId])charts[mId].destroy();
        const ctx=document.getElementById(mId)?.getContext('2d');
        if(ctx)charts[mId]=new Chart(ctx,{type:'bar',data:{labels:WIN_MONTHS,datasets:[
          {label:barLabel,data:wArr(barArr),type:'bar',backgroundColor:alpha(barColor,0.65),borderColor:barColor,borderWidth:0,order:1},
          {label:lineLabel+' %',data:wArr(lineArr),type:'line',yAxisID:'y2',borderColor:C.red,fill:false,tension:0.35,pointRadius:3,borderWidth:2,order:0},
        ]},options:o});
      }
      {
        const o=mixedOpts(); const qB=aqN(barArr,'sum'),qL=aqN(lineArr,'avg');
        if(charts[qId])charts[qId].destroy();
        const ctx=document.getElementById(qId)?.getContext('2d');
        if(ctx)charts[qId]=new Chart(ctx,{type:'bar',data:{labels:qB.map(x=>x.label),datasets:[
          {label:barLabel,data:qB.map(x=>x.val),type:'bar',backgroundColor:alpha(barColor,0.65),borderColor:barColor,borderWidth:0,order:1},
          {label:lineLabel+' %',data:qL.map(x=>x.val),type:'line',yAxisID:'y2',borderColor:C.red,fill:false,tension:0.35,pointRadius:3,borderWidth:2,order:0},
        ]},options:o});
      }
      {
        const o=mixedOpts();
        const bY25=barArr.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0);
        const bY26=barArr.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0);
        const lY25=lineArr.slice(0,12).filter(v=>v!==null); const lV25=lY25.length?lY25.reduce((a,b)=>a+b,0)/lY25.length:null;
        const lY26=lineArr.slice(12,LAST_IDX+1).filter(v=>v!==null); const lV26=lY26.length?lY26.reduce((a,b)=>a+b,0)/lY26.length:null;
        if(charts[yId])charts[yId].destroy();
        const ctx=document.getElementById(yId)?.getContext('2d');
        if(ctx)charts[yId]=new Chart(ctx,{type:'bar',data:{labels:[prevYear+'',curYear+' YTD'],datasets:[
          {label:barLabel,data:[bY25,bY26],type:'bar',backgroundColor:[alpha(barColor,0.7),alpha(barColor,0.4)],borderColor:barColor,borderWidth:0,order:1},
          {label:lineLabel+' %',data:[lV25,lV26],type:'line',yAxisID:'y2',borderColor:C.red,fill:false,tension:0.35,pointRadius:3,borderWidth:2,order:0},
        ]},options:o});
      }
    }
    dreTriple('c-dre-tr-m','c-dre-tr-q','c-dre-tr-y',D.trR,D.trPct,'Take Rate R$','Take Rate',C.blue);
    dreTriple('c-dre-gm-m','c-dre-gm-q','c-dre-gm-y',D.mgBrutaR,D.mgBrutaPct,'Margem Bruta R$','Margem Bruta',C.chart);
    dreTriple('c-dre-ebitda-m','c-dre-ebitda-q','c-dre-ebitda-y',D.ebitdaR,D.ebitdaPct,'EBITDA R$','EBITDA',C.grayL);
    dreTriple('c-dre-ll-m','c-dre-ll-q','c-dre-ll-y',D.lucroR,D.lucroPct,'Lucro Líquido R$','Resultado',C.chart);
    {
      const o=simpleLineOpts(null,true);
      mk('c-dre-rcd-m','line',WIN_MONTHS,[
        {label:'Receita Líq.',data:wArr(D.recLiq),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
        {label:'Custos',data:wArr(D.custos),borderColor:C.pink,backgroundColor:alpha(C.pink,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
        {label:'Despesas',data:wArr(D.despesas),borderColor:C.red,backgroundColor:alpha(C.red,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
      ],o);
      const qR=aqN(D.recLiq,'sum'),qC=aqN(D.custos,'sum'),qDsp=aqN(D.despesas,'sum');
      mk('c-dre-rcd-q','line',qR.map(x=>x.label),[
        {label:'Receita Líq.',data:qR.map(x=>x.val),borderColor:C.blue,backgroundColor:alpha(C.blue,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
        {label:'Custos',data:qC.map(x=>x.val),borderColor:C.pink,backgroundColor:alpha(C.pink,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
        {label:'Despesas',data:qDsp.map(x=>x.val),borderColor:C.red,backgroundColor:alpha(C.red,0.07),fill:true,tension:0.35,pointRadius:2,borderWidth:2},
      ],o);
      mk('c-dre-rcd-y','bar',[prevYear+'',curYear+' YTD'],[
        {label:'Receita Líq.',data:[D.recLiq.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.recLiq.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.blue,0.7),borderColor:C.blue,borderWidth:0},
        {label:'Custos',data:[D.custos.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.custos.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.pink,0.7),borderColor:C.pink,borderWidth:0},
        {label:'Despesas',data:[D.despesas.slice(0,12).filter(v=>v).reduce((a,b)=>a+b,0),D.despesas.slice(12,LAST_IDX+1).filter(v=>v).reduce((a,b)=>a+b,0)],backgroundColor:alpha(C.red,0.7),borderColor:C.red,borderWidth:0},
      ],simpleBarOpts(null,true));
    }
  }
  // TAB 6 — KPIS (Real vs Orçado)
  {
    const kHead=document.getElementById('kpi-thead');
    const kBody=document.getElementById('kpi-tbody');
    const QIDX=[[12,14],[15,17],[18,20],[21,23]];
    const QLABELS=['Q1/26','Q2/26','Q3/26','Q4/26'];

    function buildMonths(kind, o) {
      const out=[];
      for (let m=0;m<12;m++){ const i=12+m; out.push(cellVal(kind,o,i,i)); }
      return out;
    }
    function buildQuarters(kind, o) {
      if (o && o.qtr) return o.qtr;
      return QIDX.map(([i0,i1])=>cellVal(kind,o,i0,i1));
    }
    function cellVal(kind, o, i0, i1) {
      if (kind==='sum') return sumRange(o.arr,i0,i1);
      if (kind==='end') return lastNonNull(o.arr,i0,i1);
      if (kind==='start') return firstNonNull(o.arr,i0,i1);
      if (kind==='ratio') return ratioRange(o.num,o.den,i0,i1);
      if (kind==='growth') return growthRange(o.arr,i0,i1);
      return null;
    }
    function yearVal(kind, o, isReal) {
      // Q1-Q4 e YTD do NDR vêm prontos da base Claudinho (o.qtr/o.year); se a publicação
      // ainda não trouxe o YTD, cai de volta pro recálculo a partir dos componentes de MRR.
      if (o && o.year !== undefined && o.year !== null) return o.year;
      const i1 = isReal ? LAST_IDX : 23;
      return cellVal(kind,o,12,i1);
    }
    const ndrRealAux = get2Aux(/^NDR Real$/i);
    const KPI_SECTIONS=[
      {title:'MRR Evolution', rows:[
        {label:'MRR inicial', kind:'start', fmt:'brl', real:{arr:D.mrrIni}, budg:{arr:D.mrrIniBudg}},
        {label:'Net MRR', kind:'sum', fmt:'brl', real:{arr:D.netMrrReal}, budg:{arr:D.netMrrBudg}},
        {label:'MRR final', kind:'end', fmt:'brl', real:{arr:D.mrrFin}, budg:{arr:D.mrrFinBudg}},
        {label:'ARR final', kind:'end', fmt:'brl', real:{arr:D.arrFin}, budg:{arr:D.arrFinBudg}},
        {label:'MRR Growth', kind:'growth', fmt:'pct', real:{arr:D.mrrFin}, budg:{arr:D.mrrFinBudg}},
        {label:'NDR', kind:'ratio', fmt:'pct', real:{num:D.ndrNumReal,den:D.mrrIni,qtr:ndrRealAux.q,year:ndrRealAux.ytd}, budg:{num:D.ndrNumBudg,den:D.mrrIniBudg}},
        {label:'Ticket médio', kind:'end', fmt:'brl', real:{arr:D.ticket}, budg:null},
      ]},
      {title:'Clients Evolution', rows:[
        {label:'Clientes inicial', kind:'start', fmt:'num', real:{arr:D.cliIni}, budg:null},
        {label:'Novos clientes', kind:'sum', fmt:'num', real:{arr:D.novos}, budg:null},
        {label:'Churn clientes', kind:'sum', fmt:'num', real:{arr:D.churnCli}, budg:null},
        {label:'Clientes', kind:'end', fmt:'num', real:{arr:D.cliFin}, budg:null},
      ]},
      {title:'P&L', rows:[
        {label:'Receita Bruta', kind:'sum', fmt:'brl', real:{arr:D.recReal}, budg:{arr:D.recBudg}},
        {label:'Take Rate R$', kind:'sum', fmt:'brl', real:{arr:D.trReal}, budg:{arr:D.trBudg}},
        {label:'Take Rate %', kind:'ratio', fmt:'pct', real:{num:D.trReal,den:D.recLiqReal}, budg:{num:D.trBudg,den:D.recLiqBudg}},
        {label:'Custos', kind:'sum', fmt:'brl', real:{arr:D.custos}, budg:{arr:D.custosBudg}},
        {label:'Margem Bruta R$', kind:'sum', fmt:'brl', real:{arr:D.mgReal}, budg:{arr:D.mgBudg}},
        {label:'Margem Bruta %', kind:'ratio', fmt:'pct', real:{num:D.mgReal,den:D.recLiqReal}, budg:{num:D.mgBudg,den:D.recLiqBudg}},
        {label:'Despesas', kind:'sum', fmt:'brl', real:{arr:D.despesas}, budg:{arr:D.despesasBudg}},
        {label:'EBITDA R$', kind:'sum', fmt:'brl', real:{arr:D.ebitdaReal}, budg:{arr:D.ebitdaBudg}},
        {label:'EBITDA %', kind:'ratio', fmt:'pct', real:{num:D.ebitdaReal,den:D.recLiqReal}, budg:{num:D.ebitdaBudg,den:D.recLiqBudg}},
        {label:'(=) Lucro Líquido', kind:'sum', fmt:'brl', real:{arr:D.resReal}, budg:{arr:D.resBudg}},
        {label:'Lucro Líquido %', kind:'ratio', fmt:'pct', real:{num:D.resReal,den:D.recLiqReal}, budg:{num:D.resBudg,den:D.recLiqBudg}},
      ]},
      {title:'Cash Flow', rows:[
        {label:'Saldo inicial', kind:'start', fmt:'brl', real:{arr:D.saldoIni}, budg:{arr:D.saldoIniBudg}},
        {label:'Geração/Queima Caixa', kind:'sum', fmt:'brl', real:{arr:D.burnTotal}, budg:{arr:D.burnBudg}},
        {label:'Saldo final', kind:'end', fmt:'brl', real:{arr:D.saldoFin}, budg:{arr:D.saldoBudg}},
      ]},
      {title:'Headcount', rows:[
        {label:'Headcount Final', kind:'end', fmt:'num', real:{arr:D.hcFinal}, budg:{arr:D.hcBudg}},
        {label:'ARR / Headcount', kind:'end', fmt:'brl', real:{arr:D.arrHc}, budg:{arr:D.arrHcBudg}},
      ]},
      {title:"KPI's SaaS", rows:[
        {label:'Ticket médio', kind:'end', fmt:'brl', real:{arr:D.ticket}, budg:null},
        {label:'Novo cliente', kind:'sum', fmt:'num', real:{arr:D.novos}, budg:null},
        {label:'Churn cliente', kind:'sum', fmt:'num', real:{arr:D.churnCli}, budg:null},
        {label:'Financial Churn %', kind:'end', fmt:'pct', real:{arr:D.financialChurn}, budg:null},
        {label:'Despesas MKT e Sales', kind:'sum', fmt:'brl', real:{arr:D.despesasMktSales}, budg:null},
        {label:'CAC', kind:'end', fmt:'brl', real:{arr:D.cac}, budg:null},
        {label:'CAC %', kind:'end', fmt:'pct', real:{arr:D.cacPct}, budg:null},
        {label:'LT (meses)', kind:'end', fmt:'num', real:{arr:D.lt}, budg:null},
        {label:'LTV', kind:'end', fmt:'brl', real:{arr:D.ltv}, budg:null},
        {label:'LTV/CAC', kind:'end', fmt:'num1', real:{arr:D.ltvCac}, budg:null},
        {label:'CAC por cliente', kind:'end', fmt:'brl', real:{arr:D.cacPorCliente}, budg:null},
        {label:'CAC payback (Meses)', kind:'end', fmt:'num1', real:{arr:D.cacPayback}, budg:null},
        {label:'SaaS número mágico', kind:'end', fmt:'num1', real:{arr:D.saasMagicNumber}, budg:null},
        {label:'Crescimento receita %', kind:'end', fmt:'pct', real:{arr:D.crescReceitaPct}, budg:null},
        {label:'Rule of 40', kind:'end', fmt:'pct', real:{arr:D.ruleOf40}, budg:null},
        {label:'Runway', kind:'end', fmt:'num', real:{arr:D.runway}, budg:null},
      ]},
    ];
    let th='<tr><th>Indicador</th>';
    YEAR_CUR_LABELS.forEach((m,i)=>{ th+=`<th${i%3===0?' class="qtr-col"':''}>${m}</th>`; });
    QLABELS.forEach(q=>{ th+=`<th class="qtr-col">${q}</th>`; });
    th+='<th class="ano-col">Ano 2026</th></tr>';
    kHead.innerHTML=th;

    let tbody='';
    KPI_SECTIONS.forEach(sec=>{
      tbody+=`<tr class="section"><td colspan="18">${sec.title}</td></tr>`;
      sec.rows.forEach(row=>{
        const rMonths=buildMonths(row.kind,row.real), rQuarters=buildQuarters(row.kind,row.real), rYear=yearVal(row.kind,row.real,true);
        let rCells=rMonths.map(v=>tdCell(v,row.fmt)).join('');
        rCells+=rQuarters.map(v=>tdCell(v,row.fmt,'qtr-col ')).join('');
        rCells+=tdCell(rYear,row.fmt,'ano-col ');
        tbody+=`<tr class="real-first"><td>${row.label}</td>${rCells}</tr>`;
      });
    });
    kBody.innerHTML=tbody;
  }
  // TAB 7 — FORECAST (DRE + Cashflow, set-dez/26 projetado)
  {
    const custosFixed=D.custos[LAST_IDX], despesasFixed=D.despesas[LAST_IDX];
    const burnRealVals=D.burnTotal.slice(12,LAST_IDX+1).filter(v=>v!==null);
    const avgBurn=burnRealVals.length ? burnRealVals.reduce((a,b)=>a+b,0)/burnRealVals.length : 0;

    const fRB=D.recBruta.slice(), fRL=D.recLiq.slice(), fTR=D.trR.slice(), fTRPct=D.trPct.slice();
    const fCustos=D.custos.slice(), fMargem=D.mgBrutaR.slice(), fMargemPct=D.mgBrutaPct.slice();
    const fDespesas=D.despesas.slice(), fEBITDA=D.ebitdaR.slice(), fEBITDAPct=D.ebitdaPct.slice();
    const fLucro=D.lucroR.slice(), fLucroPct=D.lucroPct.slice();
    const fSaldoIni=D.saldoIni.slice(), fBurn=D.burnTotal.slice(), fSaldoFin=D.saldoFin.slice();

    let saldoPrev=D.saldoFin[LAST_IDX];
    for (let i=LAST_IDX+1;i<=23;i++){
      const rb=D.previsaoReceita[i];
      const rl=(rb!==null) ? rb*(1-0.0905) : null;
      const tr=(rl!==null) ? rl*0.5 : null;
      const margem=(tr!==null) ? tr+custosFixed : null;
      const ebitda=(margem!==null) ? margem+despesasFixed : null;
      const rendimento=(saldoPrev!==null) ? saldoPrev*0.007 : null;
      const lucro=(ebitda!==null&&rendimento!==null) ? ebitda+rendimento : null;
      const saldoIni=saldoPrev, burn=avgBurn;
      const saldoFinM=(saldoIni!==null) ? saldoIni+burn : null;

      fRB[i]=rb; fRL[i]=rl; fTR[i]=tr; fTRPct[i]=(tr!==null&&rl)?(tr/rl)*100:null;
      fCustos[i]=custosFixed; fMargem[i]=margem; fMargemPct[i]=(margem!==null&&rl)?(margem/rl)*100:null;
      fDespesas[i]=despesasFixed; fEBITDA[i]=ebitda; fEBITDAPct[i]=(ebitda!==null&&rl)?(ebitda/rl)*100:null;
      fLucro[i]=lucro; fLucroPct[i]=(lucro!==null&&rl)?(lucro/rl)*100:null;
      fSaldoIni[i]=saldoIni; fBurn[i]=burn; fSaldoFin[i]=saldoFinM;
      saldoPrev=saldoFinM;
    }

    function fcHead(elId){
      let th='<tr><th>Indicador</th>';
      YEAR_CUR_LABELS.forEach((m,i)=>{ th+=`<th class="${i<=(LAST_IDX-12)?'fc-real':'fc-fore'}">${m}</th>`; });
      th+='<th class="fc-tot">Total<br><small>Realizado</small></th><th class="fc-tot">Total<br><small>Real.+Prev.</small></th></tr>';
      document.getElementById(elId).innerHTML=th;
    }
    function fcRow(arr,label,fmt,cls){
      let cells='';
      for (let i=12;i<=23;i++){
        const v = arr[i];
        const c = (i<=(LAST_IDX)?'fc-real':'fc-fore') + ((v!==null&&v<0)?' neg':'');
        cells+=`<td class="${c}">${fmtCell(v,fmt)}</td>`;
      }
      cells+=tdCell(sumRange(arr,12,LAST_IDX),fmt,'fc-tot ');
      cells+=tdCell(sumRange(arr,12,23),fmt,'fc-tot ');
      return `<tr class="${cls||''}"><td>${label}</td>${cells}</tr>`;
    }
    function fcRatioRow(numArr,denArr,label,cls){
      let cells='';
      for (let i=12;i<=23;i++){
        const v = (denArr[i]) ? (numArr[i]/denArr[i])*100 : null;
        const c = (i<=(LAST_IDX)?'fc-real':'fc-fore') + ((v!==null&&v<0)?' neg':'');
        cells+=`<td class="${c}">${fmtCell(v,'pct')}</td>`;
      }
      const totReal = ratioRange(numArr,denArr,12,LAST_IDX);
      const totAll = ratioRange(numArr,denArr,12,23);
      cells+=tdCell(totReal,'pct','fc-tot ');
      cells+=tdCell(totAll,'pct','fc-tot ');
      return `<tr class="${cls||''}"><td>${label}</td>${cells}</tr>`;
    }
    function fcLevelRow(arr,label,mode){
      // mode 'start' -> total shows period-start value; 'end' -> total shows period-end value
      let cells='';
      for (let i=12;i<=23;i++){
        const v = arr[i];
        const c = (i<=(LAST_IDX)?'fc-real':'fc-fore') + ((v!==null&&v<0)?' neg':'');
        cells+=`<td class="${c}">${fmtCell(v,'brl')}</td>`;
      }
      const totReal = mode==='start' ? arr[12] : lastNonNull(arr,12,LAST_IDX);
      const totAll = mode==='start' ? arr[12] : lastNonNull(arr,12,23);
      cells+=tdCell(totReal,'brl','fc-tot ');
      cells+=tdCell(totAll,'brl','fc-tot ');
      return `<tr><td>${label}</td>${cells}</tr>`;
    }

    fcHead('forecast-dre-thead');
    let dtbody='';
    dtbody+=fcRow(fRB,'Receita Bruta','brl','total');
    dtbody+=fcRow(fRL,'Receita Líquida','brl','total');
    dtbody+=fcRow(fTR,'Take Rate R$','brl');
    dtbody+=fcRatioRow(fTR,fRL,'Take Rate %','sub');
    dtbody+=fcRow(fCustos,'Custos','brl');
    dtbody+=fcRow(fMargem,'Margem Bruta R$','brl','total');
    dtbody+=fcRatioRow(fMargem,fRL,'Margem Bruta %','sub');
    dtbody+=fcRow(fDespesas,'Despesas','brl');
    dtbody+=fcRow(fEBITDA,'EBITDA R$','brl','total');
    dtbody+=fcRatioRow(fEBITDA,fRL,'EBITDA %','sub');
    dtbody+=fcRow(fLucro,'(=) Lucro Líquido','brl','total');
    dtbody+=fcRatioRow(fLucro,fRL,'Lucro Líquido %','sub');
    document.getElementById('forecast-dre-tbody').innerHTML=dtbody;

    fcHead('forecast-cash-thead');
    let ctbody='';
    ctbody+=fcLevelRow(fSaldoIni,'Saldo Inicial','start');
    ctbody+=fcRow(fBurn,'Geração/Queima Caixa','brl');
    ctbody+=fcLevelRow(fSaldoFin,'Saldo Final','end');
    document.getElementById('forecast-cash-tbody').innerHTML=ctbody;
  }
}
window.initLegacyDash = initLegacyDash;
