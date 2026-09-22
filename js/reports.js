// 04 Reports: Astella (Excel preenchido a partir do template) e Redpoint
// (coluna do mes calculada para colar no Google Sheets).
(function () {
  const EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  const TEMPLATE = 'templates/astella-template.xlsx';
  const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let K = null, mrr = null, take = null, refIdx = null, templateBuf = null, templateName = 'template padrão (Update Ago26)';

  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      const wait = (n) => window.ExcelJS ? res() : n > 100 ? rej(new Error('ExcelJS não carregou')) : setTimeout(() => wait(n + 1), 100);
      return wait(0);
    }
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src));
    document.head.appendChild(s);
  });

  // ============================================================================
  // ASTELLA
  // ============================================================================
  // Linhas de entrada do template (linha da planilha -> serie da BASE KLIP)
  const AST_INPUTS = [
    [5, 'New MRR', 'newMRR'], [6, 'Upsell', 'upsell'], [7, 'Churn', 'churn'], [8, 'Downsell', 'downsell'],
    [19, 'Ticket Médio', 'ticket'], [24, 'Gross Revenue', 'grossRevenue'], [25, 'Net Revenue', 'recLiq'],
    [26, 'Pro Lancer', 'prolancer'], [28, 'Costs', 'custos'], [30, 'Despesas', 'despesas'], [32, 'Resultado', 'lucro'],
    [37, 'Recebimentos', 'entradas'], [38, 'Pagamentos', 'pagamentos'], [40, 'Resultado Financeiro', 'resFinCaixa'],
    [41, 'Aportes BR', 'aportes'], [46, 'RunWay (Mths)', 'runway'], [50, 'Headcount', 'hc'],
  ];
  // Formulas do template, por linha ({c} coluna do mes, {p} coluna anterior)
  const AST_FORMULAS = {
    4: '{p}9', 9: '{c}4+{c}5+{c}6+{c}8+{c}7', 12: '{c}4*12', 13: '{c}5*12', 14: '{c}6*12', 15: '{c}8*12', 16: '{c}7*12',
    17: '{c}12+{c}13+{c}14+{c}15+{c}16', 20: '({c}7+{c}8)/{c}4', 27: '({c}26/{c}25)+100%', 29: '(({c}26+{c}28)/{c}25)+100%',
    31: '{c}25+{c}26+{c}28+{c}30', 36: '{p}45', 39: '{c}37+{c}38', 44: '{c}39+{c}40+{c}41+{c}43', 45: '{c}36+{c}44', 51: '{c}17/{c}50',
  };
  const colLetter = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const cellNum = v => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && 'result' in v) return typeof v.result === 'number' ? v.result : null;
    return null;
  };

  async function templateWorkbook() {
    await loadScript(EXCELJS);
    if (!templateBuf) {
      const r = await fetch(TEMPLATE, { cache: 'no-store' });
      if (!r.ok) throw new Error('Template do Astella não encontrado (' + r.status + ')');
      templateBuf = await r.arrayBuffer();
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuf.slice(0));
    return wb;
  }

  function monthCols(ws) {
    const map = {};
    ws.getRow(2).eachCell((cell, col) => {
      const v = cell.value;
      if (v instanceof Date) map[FPA.ym(v.getUTCFullYear(), v.getUTCMonth() + 1)] = col;
    });
    return map;
  }

  function astellaStatus(ws) {
    const cols = monthCols(ws);
    let last = null;
    Object.entries(cols).forEach(([ym, col]) => { if (cellNum(ws.getCell(24, col).value) !== null && (!last || +ym > last)) last = +ym; });
    return { cols, last };
  }

  // Confere o historico do template contra a BASE KLIP
  function astellaDiffs(ws, cols, last) {
    const out = [];
    K.months.forEach((mo, i) => {
      const ym = FPA.ym(mo.y, mo.m), col = cols[ym];
      if (!col || ym > last) return;
      AST_INPUTS.forEach(([row, label, key]) => {
        if (key === 'runway' || key === 'hc' || key === 'aportes') return;
        const t = cellNum(ws.getCell(row, col).value), k = K[key][i];
        if (k === null && (t === null || t === 0)) return;
        if (Math.abs((t || 0) - (k || 0)) > 2) out.push({ mes: mo.label, label, template: t, klip: k });
      });
    });
    return out;
  }

  async function gerarAstella(btn) {
    btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Gerando...';
    try {
      const wb = await templateWorkbook();
      const ws = wb.worksheets[0];
      const { cols, last } = astellaStatus(ws);
      const ref = K.months[refIdx], refYm = FPA.ym(ref.y, ref.m), refCol = cols[refYm];
      if (!refCol) throw new Error(`O template não tem coluna para ${ref.label}. Adicione o novo ano no template.`);
      const avisos = [];
      K.months.forEach((mo, i) => {
        const ym = FPA.ym(mo.y, mo.m), col = cols[ym];
        if (!col || ym > refYm) return;
        if (!(ym === refYm || ym > last)) return;
        const c = colLetter(col), p = colLetter(col - 1);
        AST_INPUTS.forEach(([row, label, key]) => {
          const v = K[key][i];
          const cell = ws.getCell(row, col);
          if (v === null || (key === 'aportes' && v === 0)) {
            cell.value = null;
            if (['hc', 'runway'].includes(key)) avisos.push(`${label} sem dado em ${mo.label}`);
          } else cell.value = Math.round(v);
        });
        Object.entries(AST_FORMULAS).forEach(([row, f]) => {
          ws.getCell(+row, col).value = { formula: f.replace(/\{c\}/g, c).replace(/\{p\}/g, p) };
        });
      });
      // YTD que apontam para o ultimo mes
      const aa = Object.values(cols).length ? Math.max(...Object.values(cols)) + 1 : null;
      if (aa) {
        const rc = colLetter(refCol);
        ws.getCell(19, aa).value = { formula: rc + '19' };
        ws.getCell(50, aa).value = { formula: rc + '50' };
      }
      wb.calcProperties = Object.assign(wb.calcProperties || {}, { fullCalcOnLoad: true });
      const out = await wb.xlsx.writeBuffer();
      const name = `Flora - Report Bossabox - Finance - Update ${MES_ABREV[ref.m - 1]}${String(ref.y).slice(2)}.xlsx`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = name; a.click(); URL.revokeObjectURL(a.href);
      FPA.toast(avisos.length ? `Excel gerado. Atenção: ${avisos.join('; ')}.` : 'Excel gerado: ' + name, avisos.length ? 6000 : 3000);
    } catch (e) {
      FPA.toast('Erro: ' + e.message, 6000);
      console.error(e);
    } finally { btn.disabled = false; btn.textContent = txt; }
  }

  async function renderAstella(host) {
    host.innerHTML = FPA.loading('Lendo o template do Astella');
    let st, diffs;
    try {
      const wb = await templateWorkbook();
      const ws = wb.worksheets[0];
      st = astellaStatus(ws);
      diffs = astellaDiffs(ws, st.cols, st.last);
    } catch (e) { host.innerHTML = FPA.errorBox(e, 'o template do Astella'); return; }
    const lastLbl = st.last ? FPA.monthLabel(Math.floor(st.last / 100), st.last % 100) : 'n/d';
    const ref = K.months[refIdx];
    const i = refIdx;
    const prevs = [i - 2, i - 1, i].filter(x => x >= 0);
    const line = (label, key, fmt) => `<tr><td>${label}</td>${prevs.map(k => `<td>${fmt(K[key][k])}</td>`).join('')}</tr>`;
    const b = v => v === null ? '<span class="muted">vazio</span>' : `<span class="${v < 0 ? 'neg' : ''}">${FPA.brl(v)}</span>`;
    const n = v => v === null ? '<span class="muted">vazio</span>' : FPA.int(v);
    const hcMissing = K.hc[i] === null;
    host.innerHTML = `
      <div class="report-card">
        <div class="section-head"><div><p class="eyebrow">Investidor</p><h2>Astella</h2></div>
          <span class="badge ${st.last >= FPA.ym(ref.y, ref.m) ? 'badge--ok' : 'badge--accent'}">${st.last >= FPA.ym(ref.y, ref.m) ? 'Template já tem ' + ref.label : 'Pronto para gerar ' + ref.label}</span></div>
        <dl class="kv">
          <dt>Formato</dt><dd>Excel (Flora report), aba única</dd>
          <dt>Base usada</dt><dd>${FPA.esc(templateName)}, preenchido até ${lastLbl}</dd>
          <dt>Fonte dos números</dt><dd>BASE KLIP, a mesma do Dash Finance</dd>
          <dt>O que é preenchido</dt><dd>Linhas de entrada de ${st.last && st.last < FPA.ym(ref.y, ref.m) ? 'todos os meses entre ' + lastLbl + ' e ' + ref.label : ref.label}. Fórmulas do template ficam como estão.</dd>
        </dl>
        <div class="controls">
          <button class="btn btn--primary" id="ast-go">Gerar Excel de ${ref.label}</button>
          <a class="btn" href="${TEMPLATE}" download="astella-template.xlsx">Baixar template</a>
          <label class="btn btn--ghost" style="cursor:pointer">Usar outra versão como base<input type="file" id="ast-file" accept=".xlsx" hidden></label>
        </div>
        ${hcMissing ? `<div class="callout callout--warn"><p class="callout-label">Falta dado</p><p>Headcount de ${ref.label} está vazio na BASE KLIP. A linha sai em branco e o ARR/HC fica sem valor até alguém preencher a planilha.</p></div>` : ''}
        <details>
          <summary class="label" style="cursor:pointer">Prévia dos valores</summary>
          <div class="table-wrap" style="margin-top:.7rem"><table class="t"><thead><tr><th>Linha</th>${prevs.map(k => `<th>${K.months[k].label}</th>`).join('')}</tr></thead><tbody>
            <tr class="group"><td colspan="${prevs.length + 1}">MRR</td></tr>
            ${line('MRR inicial', 'mrrIni', b)}${line('New MRR', 'newMRR', b)}${line('Upsell', 'upsell', b)}${line('Churn', 'churn', b)}${line('Downsell', 'downsell', b)}${line('MRR final', 'mrrFin', b)}${line('Ticket médio', 'ticket', b)}
            <tr class="group"><td colspan="${prevs.length + 1}">P&amp;L</td></tr>
            ${line('Gross Revenue', 'grossRevenue', b)}${line('Net Revenue', 'recLiq', b)}${line('Pro Lancer', 'prolancer', b)}${line('Costs', 'custos', b)}${line('Despesas', 'despesas', b)}${line('Resultado', 'lucro', b)}
            <tr class="group"><td colspan="${prevs.length + 1}">Cash flow</td></tr>
            ${line('Recebimentos', 'entradas', b)}${line('Pagamentos', 'pagamentos', b)}${line('Resultado financeiro', 'resFinCaixa', b)}${line('Saldo final', 'saldoFin', b)}${line('Runway', 'runway', n)}
            <tr class="group"><td colspan="${prevs.length + 1}">Headcount</td></tr>
            ${line('Headcount', 'hc', n)}
          </tbody></table></div>
        </details>
        ${diffs.length ? `<div class="callout callout--warn"><p class="callout-label">Histórico do template diferente da BASE KLIP (${diffs.length})</p>
          <p class="small">O Excel gerado mantém o histórico do template. Só o mês escolhido (e meses vazios) vêm da base. Confira estes pontos:</p>
          <div class="table-wrap" style="margin-top:.6rem"><table class="t"><thead><tr><th>Mês</th><th>Linha</th><th>Template</th><th>BASE KLIP</th></tr></thead><tbody>
          ${diffs.slice(0, 12).map(d => `<tr><td>${d.mes}</td><td>${d.label}</td><td>${FPA.brl(d.template)}</td><td>${FPA.brl(d.klip)}</td></tr>`).join('')}
          </tbody></table></div>${diffs.length > 12 ? `<p class="small muted" style="margin-top:.4rem">Mais ${diffs.length - 12} diferenças.</p>` : ''}</div>` : '<p class="small muted">Histórico do template confere com a BASE KLIP.</p>'}
      </div>`;
    host.querySelector('#ast-go').onclick = e => gerarAstella(e.currentTarget);
    host.querySelector('#ast-file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      templateBuf = await f.arrayBuffer(); templateName = f.name;
      renderAstella(host);
    };
  }

  // ============================================================================
  // REDPOINT
  // ============================================================================
  const RP_KEY = 'fpa.redpoint.manual';
  const loadManual = () => { try { return JSON.parse(localStorage.getItem(RP_KEY) || '{}'); } catch (e) { return {}; } };
  const saveManual = m => { try { localStorage.setItem(RP_KEY, JSON.stringify(m)); } catch (e) {} };

  // Numero no formato da planilha (en-US): "1,635.45", "(18%)", "-1,171"
  const usNum = s => {
    if (s === null || s === undefined) return null;
    s = String(s).trim();
    if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
    const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
    const pct = s.includes('%');
    let v = parseFloat(s.replace(/[(),%\s-]/g, ''));
    if (isNaN(v)) return null;
    if (neg) v = -v;
    return pct ? v / 100 : v;
  };

  function rpCompute(i) {
    const mo = K.months[i];
    const ps = mrr ? FPA.projectStats(mrr, mo.y, mo.m) : null;
    const t = FPA.today();
    const isCurrent = mo.y === t.y && mo.m === t.m;
    const internos = new Set(FPA.PROJETOS_INTERNOS);
    const prolAtivos = (take && isCurrent) ? new Set(take.filter(x => !internos.has(x.projeto.toUpperCase())).map(x => x.prolancer.toUpperCase())).size : null;
    const g = (a, b) => (a === null || b === null || b === undefined || !b) ? null : a / b - 1;
    return {
      net: { v: K.grossRevenue[i] === null ? null : K.grossRevenue[i] / 1000, f: 'k2', src: 'auto', note: 'Gross Revenue da BASE KLIP' },
      mom: { v: g(K.grossRevenue[i], K.grossRevenue[i - 1]), f: 'p', src: 'auto' },
      yoy: { v: i >= 12 ? g(K.grossRevenue[i], K.grossRevenue[i - 12]) : null, f: 'p', src: 'auto' },
      gp: { v: K.mgR[i] === null ? null : K.mgR[i] / 1000, f: 'k0', src: 'auto', note: 'Margem bruta R$' },
      gm: { v: K.mgPct[i], f: 'p', src: 'auto' },
      ebitda: { v: K.ebitda[i] === null ? null : K.ebitda[i] / 1000, f: 'k0', src: 'auto' },
      ebitdaPct: { v: K.ebitdaPct[i], f: 'p', src: 'auto' },
      novosCli: { v: K.novosCli[i] ?? 0, f: 'i', src: 'auto' },
      novosProj: { v: ps ? ps.novos : null, f: 'i', src: 'auto', note: '1ª competência na base de MRR' },
      clientes: { v: K.cliFin[i], f: 'i', src: 'auto' },
      projetos: { v: ps ? ps.ativos : null, f: 'i', src: 'conferir', note: 'projetos distintos com receita na base de MRR' },
      prolAtivos: { v: prolAtivos, f: 'i', src: prolAtivos === null ? 'manual' : 'conferir', note: 'prolancers distintos na planilha de take rate' },
    };
  }
  // Linha da planilha -> chave calculada (as demais sao manuais)
  const RP_MAP = [
    [/^Net Revenue/i, 'net'], [/Growth \(MoM\)/i, 'mom'], [/Growth \(YoY\)/i, 'yoy'], [/^Gross Profit/i, 'gp'], [/^% Gross Margin/i, 'gm'],
    [/^Ebitda \(R\$/i, 'ebitda'], [/^Ebitda \(%\)/i, 'ebitdaPct'], [/Novos Clientes/i, 'novosCli'], [/Novos Projetos/i, 'novosProj'],
    [/# Clientes/i, 'clientes'], [/# Projetos/i, 'projetos'], [/Prolancers ativos/i, 'prolAtivos'],
  ];
  const fmtRp = (v, f) => {
    if (v === null || v === undefined) return '';
    if (f === 'p') return (v * 100).toFixed(0) + '%';
    if (f === 'k2') return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (f === 'k0') return Math.round(v).toLocaleString('pt-BR');
    return Math.round(v).toLocaleString('pt-BR');
  };
  const pasteRp = (v, f) => {
    if (v === null || v === undefined || v === '') return '';
    if (f === 'p') return (v * 100).toFixed(1) + '%';
    if (f === 'k2') return v.toFixed(2);
    return String(Math.round(v));
  };

  async function renderRedpoint(host) {
    host.innerHTML = FPA.loading('Lendo a planilha da Redpoint');
    let rows;
    try { rows = FPA.parseCSV(await FPA.csv(FPA.SOURCES.redpoint)); } catch (e) { host.innerHTML = FPA.errorBox(e, 'a planilha da Redpoint'); return; }
    const header = rows[1] || [];
    const colOf = (y, m) => header.findIndex(h => h.trim() === `${EN[m - 1]}-${String(y).slice(2)}`);
    const lines = [];
    rows.forEach((r, ri) => { const lbl = (r[1] || '').trim(); if (ri >= 2) lines.push({ ri, lbl }); });
    const firstIdx = lines.findIndex(l => /^Net Revenue/i.test(l.lbl));
    let lastIdx = lines.length - 1; while (lastIdx > firstIdx && !lines[lastIdx].lbl) lastIdx--;
    const block = lines.slice(firstIdx, lastIdx + 1);
    const netRow = rows[block[0].ri];
    let lastFilled = null;
    header.forEach((h, c) => { const mt = h.trim().match(/^([A-Z][a-z]{2})-(\d{2})$/); if (mt && usNum(netRow[c]) !== null) lastFilled = h.trim(); });

    const ref = K.months[refIdx], prevI = refIdx - 1, prev = K.months[prevI];
    const cRef = colOf(ref.y, ref.m), cPrev = colOf(prev.y, prev.m);
    const calcRef = rpCompute(refIdx), calcPrev = rpCompute(prevI);
    const manual = loadManual(); const mk = `${ref.y}-${ref.m}`; manual[mk] = manual[mk] || {};

    let ok = 0, tot = 0;
    const body = block.map(l => {
      if (!l.lbl) return '';
      const hit = RP_MAP.find(([re]) => re.test(l.lbl));
      const sheetPrev = cPrev >= 0 ? rows[l.ri][cPrev] : '';
      const sheetRef = cRef >= 0 ? rows[l.ri][cRef] : '';
      if (hit) {
        const cr = calcRef[hit[1]], cp = calcPrev[hit[1]];
        let match = '';
        if (cp.v !== null && usNum(sheetPrev) !== null) {
          const a = usNum(sheetPrev), bb = cp.f === 'p' ? Math.round(cp.v * 100) / 100 : cp.v;
          const same = cp.f === 'p' ? Math.abs(a - bb) < 0.011 : Math.abs(a - bb) <= (cp.f === 'k2' ? 0.02 : 1);
          tot++; if (same) ok++;
          match = same ? '<span class="badge badge--ok">bate</span>' : '<span class="badge badge--warn">difere</span>';
        }
        const useManual = cr.v === null;
        const val = useManual ? `<input class="manual" data-row="${l.ri}" value="${FPA.esc(manual[mk][l.ri] || '')}" placeholder="preencher">` : `<b>${fmtRp(cr.v, cr.f)}</b>`;
        const src = cr.src === 'auto' ? '<span class="badge badge--ok">automático</span>' : cr.src === 'conferir' && !useManual ? '<span class="badge">automático, conferir</span>' : '<span class="badge badge--muted">manual</span>';
        return `<tr><td>${FPA.esc(l.lbl)}${cr.note ? `<span class="cell-note">${FPA.esc(cr.note)}</span>` : ''}</td><td>${FPA.esc(sheetPrev) || '<span class="muted">vazio</span>'}</td><td>${fmtRp(cp.v, cp.f) || '<span class="muted">n/d</span>'} ${match}</td><td>${val}</td><td>${src}</td></tr>`;
      }
      return `<tr><td>${FPA.esc(l.lbl)}</td><td>${FPA.esc(sheetPrev) || '<span class="muted">vazio</span>'}</td><td><span class="muted">n/a</span></td><td><input class="manual" data-row="${l.ri}" value="${FPA.esc(manual[mk][l.ri] || sheetRef || '')}" placeholder="preencher"></td><td><span class="badge badge--muted">manual</span></td></tr>`;
    }).join('');

    host.innerHTML = `
      <div class="report-card">
        <div class="section-head"><div><p class="eyebrow">Investidor</p><h2>Redpoint</h2></div>
          <span class="badge ${lastFilled === `${EN[ref.m - 1]}-${String(ref.y).slice(2)}` ? 'badge--ok' : 'badge--accent'}">Planilha preenchida até ${FPA.esc(lastFilled || 'n/d')}</span></div>
        <dl class="kv">
          <dt>Formato</dt><dd>Google Sheets, uma coluna por mês</dd>
          <dt>Automático</dt><dd>Receita, margem, EBITDA, clientes e projetos (BASE KLIP e base de MRR)</dd>
          <dt>Manual</dt><dd>NPS e números de prolancers da plataforma</dd>
          <dt>Método conferido</dt><dd>${ok} de ${tot} linhas automáticas batem com o que está na planilha em ${prev.label}</dd>
        </dl>
        <div class="controls">
          <button class="btn btn--primary" id="rp-copy">Copiar coluna de ${ref.label}</button>
          <a class="btn" href="${FPA.SOURCES.redpointView}" target="_blank" rel="noopener">Abrir planilha</a>
        </div>
        <p class="small muted">A coluna copiada começa na linha "${FPA.esc(block[0].lbl)}". Cole na célula dessa linha, na coluna ${EN[ref.m - 1]}-${String(ref.y).slice(2)}.</p>
        <div class="table-wrap"><table class="t" id="rp-table"><thead><tr><th>Linha</th><th>${prev.label} na planilha</th><th>${prev.label} calculado</th><th>${ref.label}</th><th>Fonte</th></tr></thead><tbody>${body}</tbody></table></div>
      </div>`;

    host.querySelector('#rp-table').addEventListener('input', e => {
      if (!e.target.matches('input.manual')) return;
      const m = loadManual(); m[mk] = m[mk] || {}; m[mk][e.target.dataset.row] = e.target.value; saveManual(m);
    });
    host.querySelector('#rp-copy').onclick = async () => {
      const m = loadManual()[mk] || {};
      const out = block.map(l => {
        if (!l.lbl) return '';
        const hit = RP_MAP.find(([re]) => re.test(l.lbl));
        if (hit && calcRef[hit[1]].v !== null) return pasteRp(calcRef[hit[1]].v, calcRef[hit[1]].f);
        return (m[l.ri] || '').trim();
      }).join('\n');
      try { await navigator.clipboard.writeText(out); FPA.toast('Coluna copiada. Cole na planilha da Redpoint.'); }
      catch (e) { FPA.toast('Não consegui acessar a área de transferência deste navegador.', 5000); }
    };
  }

  // ============================================================================
  function render(root) {
    const opts = [];
    for (let i = K.curIdx; i >= Math.max(1, K.curIdx - 11); i--) {
      const mo = K.months[i];
      opts.push(`<option value="${i}" ${i === refIdx ? 'selected' : ''}>${FPA.MESES_LONGOS[mo.m - 1]} ${mo.y}${i === K.curIdx && i !== K.closedIdx ? ' (em andamento)' : ''}</option>`);
    }
    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">04 Reports</p>
          <h1>Reports para investidores</h1>
          <p class="lede">Os dois reports saem dos mesmos números do Dash Finance. Escolha o mês de fechamento, confira a prévia e gere o arquivo.</p>
        </div>
        <div class="controls"><label class="field"><span>Mês de fechamento</span><select id="rep-month">${opts.join('')}</select></label></div>
      </header>
      ${refIdx === K.curIdx && K.curIdx !== K.closedIdx ? `<div class="callout callout--warn" style="margin-bottom:var(--x-2)"><p class="callout-label">Mês em andamento</p><p>${K.months[refIdx].label} ainda não fechou. Os números podem mudar até o fechamento.</p></div>` : ''}
      <div class="grid g2" style="align-items:start">
        <div class="panel panel-pad" id="rep-astella"></div>
        <div class="panel panel-pad" id="rep-redpoint"></div>
      </div>`;
    root.querySelector('#rep-month').onchange = e => { refIdx = +e.target.value; render(root); };
    renderAstella(root.querySelector('#rep-astella'));
    renderRedpoint(root.querySelector('#rep-redpoint'));
  }

  FPA.pages = FPA.pages || {};
  FPA.pages.reports = {
    async show(root) {
      if (root.dataset.ready) return;
      root.innerHTML = FPA.loading();
      try {
        K = await FPA.klip();
        try { mrr = await FPA.mrrBD(); } catch (e) { console.warn(e); }
        try { take = await FPA.takeRate(); } catch (e) { console.warn(e); }
        refIdx = K.closedIdx;
        render(root);
        root.dataset.ready = '1';
      } catch (e) {
        root.innerHTML = FPA.errorBox(e, 'a BASE KLIP');
      }
    },
  };
})();
