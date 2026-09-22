// 05 Forecast: parte do resultado do mes vigente e da mesma estrutura da aba
// Forecast do Dash Finance, e deixa simular cenarios com alavancas.
(function () {
  const C = FPA.CHART;
  const charts = {};
  const STORE = 'fpa.forecast.cenarios';
  let K = null, base = null, ui = null;

  const DEFAULTS = () => ({
    churn: 0, churnIdx: null, novo: 0, novoIdx: null, receitaPct: 0, startIdx: null,
    prolPct: 0, proporcional: true, custosPct: 0, custosExtra: 0, despPct: 0, despExtra: 0,
    trProj: 50, rend: 0.7,
  });
  let S = null;

  // --- Base: mesma logica da aba Forecast do dash --------------------------------
  function buildBase() {
    const cur = K.curIdx, yr = K.months[cur].y;
    const y0 = K.months.findIndex(m => m.y === yr);
    let yEnd = y0; K.months.forEach((m, i) => { if (m.y === yr) yEnd = i; });
    const B = { cur, y0, yEnd, yr, rb: [], rl: [], prol: [], custos: [], desp: [], ebitda: [], lucro: [], saldo: [], burn: [], other: [] };
    const burns = [];
    for (let i = y0; i <= cur; i++) if (K.burn[i] !== null) burns.push(K.burn[i]);
    const avgBurn = burns.length ? burns.reduce((a, b) => a + b, 0) / burns.length : 0;
    let saldoPrev = null;
    for (let i = y0; i <= yEnd; i++) {
      if (i <= cur) {
        B.rb[i] = K.recBruta[i] ?? K.grossRevenue[i]; B.rl[i] = K.recLiq[i]; B.prol[i] = K.prolancer[i];
        B.custos[i] = K.custos[i]; B.desp[i] = K.despesas[i]; B.ebitda[i] = K.ebitda[i]; B.lucro[i] = K.lucro[i];
        B.saldo[i] = K.saldoFin[i]; B.burn[i] = K.burn[i];
        B.other[i] = (B.lucro[i] ?? 0) - (B.ebitda[i] ?? 0);
        saldoPrev = B.saldo[i];
      } else {
        const rb = K.previsao[i] ?? B.rb[i - 1];
        const rl = rb * (1 - FPA.DEDUCAO);
        const tr = rl * (S.trProj / 100);
        B.rb[i] = rb; B.rl[i] = rl; B.prol[i] = tr - rl;
        B.custos[i] = K.custos[cur]; B.desp[i] = K.despesas[cur];
        B.ebitda[i] = tr + B.custos[i] + B.desp[i];
        const rend = (saldoPrev ?? 0) * (S.rend / 100);
        B.other[i] = rend;
        B.lucro[i] = B.ebitda[i] + rend;
        B.burn[i] = avgBurn;
        B.saldo[i] = (saldoPrev ?? 0) + avgBurn;
        saldoPrev = B.saldo[i];
      }
    }
    B.avgBurn = avgBurn;
    return B;
  }

  // --- Cenario ---------------------------------------------------------------
  function scenario() {
    const B = base, cur = B.cur;
    const R = { rb: [], rl: [], prol: [], custos: [], desp: [], ebitda: [], lucro: [], saldo: [] };
    const start = S.startIdx ?? cur;
    let cum = 0;
    for (let i = B.y0; i <= B.yEnd; i++) {
      if (i < cur) {
        ['rb', 'rl', 'prol', 'custos', 'desp', 'ebitda', 'lucro', 'saldo'].forEach(f => R[f][i] = B[f][i]);
        continue;
      }
      const on = i >= start;
      let dRB = on ? B.rb[i] * (S.receitaPct / 100) : 0;
      if (S.churn && S.churnIdx !== null && i >= S.churnIdx) dRB -= S.churn;
      if (S.novo && S.novoIdx !== null && i >= S.novoIdx) dRB += S.novo;
      const dRL = dRB * (1 - FPA.DEDUCAO);
      const ratio = B.rl[i] ? B.prol[i] / B.rl[i] : -0.5;
      R.rb[i] = B.rb[i] + dRB;
      R.rl[i] = B.rl[i] + dRL;
      R.prol[i] = (B.prol[i] + (S.proporcional ? dRL * ratio : 0)) * (on ? 1 + S.prolPct / 100 : 1);
      R.custos[i] = on ? B.custos[i] * (1 + S.custosPct / 100) - S.custosExtra : B.custos[i];
      R.desp[i] = on ? B.desp[i] * (1 + S.despPct / 100) - S.despExtra : B.desp[i];
      R.ebitda[i] = R.rl[i] + R.prol[i] + R.custos[i] + R.desp[i];
      let other = B.other[i];
      if (i > cur) {
        const prevSaldo = (i - 1 >= B.y0) ? R.saldo[i - 1] : B.saldo[i - 1];
        other = (prevSaldo ?? 0) * (S.rend / 100);
      }
      R.lucro[i] = R.ebitda[i] + other;
      cum += R.lucro[i] - B.lucro[i];
      R.saldo[i] = (B.saldo[i] ?? 0) + cum;
    }
    return R;
  }

  const sumR = (arr, i0, i1) => { let s = 0; for (let i = i0; i <= i1; i++) s += arr[i] || 0; return s; };

  // --- UI ---------------------------------------------------------------------
  function monthOpts(sel, from) {
    let h = '';
    for (let i = from; i <= base.yEnd; i++) h += `<option value="${i}" ${i === sel ? 'selected' : ''}>${K.months[i].label}${i === base.cur ? ' (vigente)' : ''}</option>`;
    return h;
  }
  const brlIn = v => v ? Math.round(v).toLocaleString('pt-BR') : '';
  const parseIn = s => { const v = FPA.num(s); return v === null ? 0 : Math.abs(v); };

  function leversHtml() {
    const cur = base.cur;
    const slider = (id, label, min, max, step, val) => `
      <div class="lever"><div class="lever-top"><label for="${id}">${label}</label><output id="${id}-out">${val > 0 ? '+' : ''}${val}%</output></div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
    return `
      <div class="panel levers">
        <div class="lever-group">
          <p class="label">Cenários rápidos</p>
          <div class="presets">
            <button class="btn" data-preset="churn300">Churn de R$ 300k</button>
            <button class="btn" data-preset="cresc10">Receita +10%</button>
            <button class="btn" data-preset="desp10">Despesas -10%</button>
            <button class="btn" data-preset="prol5">Prolancer +5%</button>
            <button class="btn btn--ghost" data-preset="reset">Zerar</button>
          </div>
        </div>
        <div class="lever-group">
          <h3>Receita</h3>
          <div class="lever"><div class="lever-top"><label for="lv-churn">Churn (MRR perdido por mês)</label></div>
            <div class="lever-inline"><input type="text" inputmode="numeric" id="lv-churn" placeholder="R$ 0" value="${brlIn(S.churn)}"><select id="lv-churn-m" aria-label="Mês do churn">${monthOpts(S.churnIdx ?? Math.min(cur + 1, base.yEnd), cur)}</select></div></div>
          <div class="lever"><div class="lever-top"><label for="lv-novo">Nova receita (MRR por mês)</label></div>
            <div class="lever-inline"><input type="text" inputmode="numeric" id="lv-novo" placeholder="R$ 0" value="${brlIn(S.novo)}"><select id="lv-novo-m" aria-label="Mês da nova receita">${monthOpts(S.novoIdx ?? Math.min(cur + 1, base.yEnd), cur)}</select></div></div>
          ${slider('lv-rec', 'Ajuste geral da receita', -50, 50, 1, S.receitaPct)}
          <label class="check"><input type="checkbox" id="lv-prop" ${S.proporcional ? 'checked' : ''}>Variação de receita leva o custo de prolancer junto, na proporção do take rate atual</label>
        </div>
        <div class="lever-group">
          <h3>Custos e despesas</h3>
          ${slider('lv-prol', 'Custo com prolancer', -30, 30, 1, S.prolPct)}
          ${slider('lv-custos', 'Custos', -50, 50, 1, S.custosPct)}
          <div class="lever"><div class="lever-top"><label for="lv-custos-x">Custo adicional (R$ por mês)</label></div><input type="text" inputmode="numeric" id="lv-custos-x" placeholder="R$ 0" value="${brlIn(S.custosExtra)}"></div>
          ${slider('lv-desp', 'Despesas', -50, 50, 1, S.despPct)}
          <div class="lever"><div class="lever-top"><label for="lv-desp-x">Despesa adicional (R$ por mês)</label></div><input type="text" inputmode="numeric" id="lv-desp-x" placeholder="R$ 0" value="${brlIn(S.despExtra)}"></div>
          <label class="field"><span>Ajustes em % valem a partir de</span><select id="lv-start">${monthOpts(S.startIdx ?? cur, cur)}</select></label>
        </div>
        <div class="lever-group">
          <details>
            <summary class="label" style="cursor:pointer">Premissas da base</summary>
            <div style="display:flex;flex-direction:column;gap:.6rem;margin-top:.7rem">
              <p class="small muted">Até ${K.months[base.cur].label}: realizado da BASE KLIP. Depois: receita pela linha "Previsão receita", custos e despesas repetem o mês vigente, caixa anda pela queima média do ano (${FPA.brlShort(base.avgBurn)}) e o cenário soma a diferença de resultado ao saldo.</p>
              <label class="field"><span>Take rate projetado (%)</span><input type="number" id="lv-tr" min="0" max="100" step="1" value="${S.trProj}"></label>
              <label class="field"><span>Rendimento do caixa (% a.m.)</span><input type="number" id="lv-rend" min="0" max="3" step="0.1" value="${S.rend}"></label>
            </div>
          </details>
        </div>
        <div class="lever-group">
          <p class="label">Cenários salvos neste navegador</p>
          <div class="lever-inline"><input type="text" id="lv-name" placeholder="Nome do cenário"><button class="btn" id="lv-save">Salvar</button></div>
          <div class="presets" id="lv-saved"></div>
        </div>
      </div>`;
  }

  function cmpCard(label, b, s, fmt, opts = {}) {
    const d = s - b;
    const good = opts.invert ? d < 0 : d > 0;
    const dTxt = Math.abs(d) < 0.5 && fmt !== 'm' ? '<span class="delta">sem mudança</span>'
      : `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmt === 'm' ? d.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses' : FPA.brlShort(d)}</span>`;
    const f = v => fmt === 'm' ? (v === null ? 'n/d' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses') : FPA.brlShort(v);
    return `<div class="panel stat cmp"><span class="stat-label">${label}</span>
      <span class="stat-value ${s < 0 && fmt !== 'm' ? 'neg' : ''}">${f(s)}</span>
      <span class="stat-sub">${dTxt}<span class="base">base ${f(b)}</span></span></div>`;
  }

  function runway(saldo, R) {
    // queima media dos meses projetados do cenario
    const B = base; const vals = [];
    for (let i = B.cur + 1; i <= B.yEnd; i++) vals.push(R.saldo[i] - R.saldo[i - 1]);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : B.avgBurn;
    return avg < 0 ? saldo / -avg : null;
  }

  function renderResults() {
    const B = base, R = scenario(), cur = B.cur, y0 = B.y0, yE = B.yEnd;
    const bRun = (() => { const v = []; for (let i = cur + 1; i <= yE; i++) v.push(B.saldo[i] - B.saldo[i - 1]); const a = v.length ? v.reduce((x, y) => x + y, 0) / v.length : B.avgBurn; return a < 0 ? B.saldo[yE] / -a : null; })();
    ui.cards.innerHTML = `
      ${cmpCard(`Resultado ${K.months[cur].label}`, B.lucro[cur], R.lucro[cur])}
      ${cmpCard(`Resultado ${B.yr}`, sumR(B.lucro, y0, yE), sumR(R.lucro, y0, yE))}
      ${cmpCard(`EBITDA ${B.yr}`, sumR(B.ebitda, y0, yE), sumR(R.ebitda, y0, yE))}
      ${cmpCard(`Receita bruta ${B.yr}`, sumR(B.rb, y0, yE), sumR(R.rb, y0, yE))}
      ${cmpCard(`Caixa em ${K.months[yE].label}`, B.saldo[yE], R.saldo[yE])}
      ${cmpCard('Runway', bRun, runway(R.saldo[yE], R), 'm')}`;

    const labels = []; for (let i = y0; i <= yE; i++) labels.push(K.months[i].label + (i === cur ? '*' : ''));
    const sl = (arr) => arr.slice(y0, yE + 1);
    FPA.mkChart(charts, 'fc-c1', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Base', data: sl(B.lucro), backgroundColor: C.cinza, borderRadius: 2 },
        { label: 'Cenário', data: sl(R.lucro), backgroundColor: C.orange, borderRadius: 2 },
      ] },
      options: FPA.chartOpts(FPA.brlShort),
    });
    FPA.mkChart(charts, 'fc-c2', {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Base', data: sl(B.saldo), borderColor: C.cinza, backgroundColor: C.cinza, borderDash: [5, 4], borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Cenário', data: sl(R.saldo), borderColor: C.orange, backgroundColor: C.orange, borderWidth: 2.5, pointRadius: 2.5, tension: 0.3 },
      ] },
      options: FPA.chartOpts(FPA.brlShort),
    });

    // Tabela DRE do cenario
    const cols = []; for (let i = cur; i <= yE; i++) cols.push(i);
    const pct = (n, d) => d ? n / d : null;
    const rows = [
      ['Receita bruta', i => R.rb[i], 'total'], ['Receita líquida', i => R.rl[i]], ['(-) Prolancer', i => R.prol[i]],
      ['Take rate R$', i => R.rl[i] + R.prol[i], 'total'], ['Take rate %', i => pct(R.rl[i] + R.prol[i], R.rl[i]), 'sub', 'p'],
      ['(-) Custos', i => R.custos[i]], ['Margem bruta R$', i => R.rl[i] + R.prol[i] + R.custos[i], 'total'],
      ['Margem bruta %', i => pct(R.rl[i] + R.prol[i] + R.custos[i], R.rl[i]), 'sub', 'p'],
      ['(-) Despesas', i => R.desp[i]], ['EBITDA', i => R.ebitda[i], 'total'], ['EBITDA %', i => pct(R.ebitda[i], R.rl[i]), 'sub', 'p'],
      ['Resultado líquido', i => R.lucro[i], 'total'], ['Resultado %', i => pct(R.lucro[i], R.rl[i]), 'sub', 'p'],
      ['Saldo de caixa', i => R.saldo[i], 'total', 'level'],
    ];
    const bSum = (fn) => { let s = 0; for (let i = y0; i <= yE; i++) s += fn(i) || 0; return s; };
    const fmtV = (v, t) => t === 'p' ? FPA.pct(v) : `<span class="${v < 0 ? 'neg' : ''}">${FPA.brlShort(v)}</span>`;
    const baseFn = {
      'Receita bruta': i => B.rb[i], 'Receita líquida': i => B.rl[i], '(-) Prolancer': i => B.prol[i], 'Take rate R$': i => B.rl[i] + B.prol[i],
      '(-) Custos': i => B.custos[i], 'Margem bruta R$': i => B.rl[i] + B.prol[i] + B.custos[i], '(-) Despesas': i => B.desp[i],
      'EBITDA': i => B.ebitda[i], 'Resultado líquido': i => B.lucro[i],
    };
    let body = '';
    rows.forEach(([lbl, fn, cls, t]) => {
      let tds = cols.map(i => `<td>${fmtV(fn(i), t)}</td>`).join('');
      if (t === 'p') {
        const num = { 'Take rate %': i => R.rl[i] + R.prol[i], 'Margem bruta %': i => R.rl[i] + R.prol[i] + R.custos[i], 'EBITDA %': i => R.ebitda[i], 'Resultado %': i => R.lucro[i] }[lbl];
        tds += `<td>${FPA.pct(bSum(num) / bSum(i => R.rl[i]))}</td><td></td>`;
      } else if (t === 'level') {
        tds += `<td>${fmtV(R.saldo[yE])}</td><td>${fmtV(R.saldo[yE] - B.saldo[yE])}</td>`;
      } else {
        const s = bSum(fn), b = baseFn[lbl] ? bSum(baseFn[lbl]) : null;
        tds += `<td>${fmtV(s)}</td><td>${b === null ? '' : fmtV(s - b)}</td>`;
      }
      body += `<tr class="${cls || ''}"><td>${lbl}</td>${tds}</tr>`;
    });
    ui.table.innerHTML = `<table class="t"><thead><tr><th>Cenário</th>${cols.map(i => `<th>${K.months[i].label}${i === cur ? ' vigente' : ''}</th>`).join('')}<th>Ano ${B.yr}</th><th>vs base</th></tr></thead><tbody>${body}</tbody></table>`;

    // Resumo em texto
    const dAno = sumR(R.lucro, y0, yE) - sumR(B.lucro, y0, yE);
    const parts = [];
    if (S.churn) parts.push(`churn de ${FPA.brlShort(S.churn)} por mês a partir de ${K.months[S.churnIdx].label}`);
    if (S.novo) parts.push(`nova receita de ${FPA.brlShort(S.novo)} por mês a partir de ${K.months[S.novoIdx].label}`);
    if (S.receitaPct) parts.push(`receita ${S.receitaPct > 0 ? '+' : ''}${S.receitaPct}%`);
    if (S.prolPct) parts.push(`prolancer ${S.prolPct > 0 ? '+' : ''}${S.prolPct}%`);
    if (S.custosPct) parts.push(`custos ${S.custosPct > 0 ? '+' : ''}${S.custosPct}%`);
    if (S.custosExtra) parts.push(`custo adicional de ${FPA.brlShort(S.custosExtra)} por mês`);
    if (S.despPct) parts.push(`despesas ${S.despPct > 0 ? '+' : ''}${S.despPct}%`);
    if (S.despExtra) parts.push(`despesa adicional de ${FPA.brlShort(S.despExtra)} por mês`);
    ui.summary.innerHTML = parts.length
      ? `Com ${parts.join(', ')}, o resultado de ${B.yr} ${dAno >= 0 ? 'melhora' : 'piora'} <b>${FPA.brlShort(Math.abs(dAno))}</b> e o caixa termina o ano em <b>${FPA.brlShort(R.saldo[yE])}</b>.`
      : 'Nenhuma alavanca aplicada. Os números abaixo são a base, igual à aba Forecast do Dash Finance.';
  }

  function readLevers() {
    const $ = id => ui.root.querySelector('#' + id);
    S.churn = parseIn($('lv-churn').value); S.churnIdx = +$('lv-churn-m').value;
    S.novo = parseIn($('lv-novo').value); S.novoIdx = +$('lv-novo-m').value;
    S.receitaPct = +$('lv-rec').value; S.proporcional = $('lv-prop').checked;
    S.prolPct = +$('lv-prol').value; S.custosPct = +$('lv-custos').value; S.despPct = +$('lv-desp').value;
    S.custosExtra = parseIn($('lv-custos-x').value); S.despExtra = parseIn($('lv-desp-x').value);
    S.startIdx = +$('lv-start').value;
    const tr = +$('lv-tr').value, rend = +$('lv-rend').value;
    const rebase = tr !== S.trProj || rend !== S.rend;
    S.trProj = tr; S.rend = rend;
    ['lv-rec', 'lv-prol', 'lv-custos', 'lv-desp'].forEach(id => { const v = +$(id).value; $(id + '-out').textContent = (v > 0 ? '+' : '') + v + '%'; });
    if (rebase) base = buildBase();
    renderResults();
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }
  function renderSaved() {
    const saved = loadSaved();
    const host = ui.root.querySelector('#lv-saved');
    const names = Object.keys(saved);
    host.innerHTML = names.length ? names.map(n => `<span class="badge"><button class="btn btn--ghost" style="padding:0" data-load="${FPA.esc(n)}">${FPA.esc(n)}</button><button class="btn btn--ghost" style="padding:0 0 0 4px" data-del="${FPA.esc(n)}" aria-label="Apagar ${FPA.esc(n)}">x</button></span>`).join('') : '<span class="small muted">Nenhum ainda.</span>';
  }

  function mount(root) {
    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">05 Forecast</p>
          <h1>Cenários de resultado</h1>
          <p class="lede">Parte do resultado de ${FPA.MESES_LONGOS[K.months[base.cur].m - 1]} de ${base.yr} (mês vigente) e projeta até dezembro. Mexa nas alavancas e veja o efeito no resultado e no caixa.</p>
        </div>
      </header>
      <div class="fc-layout">
        ${leversHtml()}
        <div style="display:flex;flex-direction:column;gap:var(--x-2);min-width:0">
          <div class="callout"><p class="callout-label">Leitura do cenário</p><p id="fc-summary"></p></div>
          <div class="grid g3" id="fc-cards"></div>
          <div class="grid g2">
            <div class="panel"><div class="section-head"><h3>Resultado mensal</h3><span class="small muted">* mês vigente</span></div><div class="chart-box"><canvas id="fc-c1"></canvas></div></div>
            <div class="panel"><div class="section-head"><h3>Saldo de caixa</h3></div><div class="chart-box"><canvas id="fc-c2"></canvas></div></div>
          </div>
          <div class="section-head" style="margin-top:var(--x-2)"><h2>DRE do cenário</h2><span class="small muted">Mês vigente em diante</span></div>
          <div class="table-wrap" id="fc-table"></div>
        </div>
      </div>`;
    ui = { root, cards: root.querySelector('#fc-cards'), table: root.querySelector('#fc-table'), summary: root.querySelector('#fc-summary') };
    const lv = root.querySelector('.levers');
    lv.addEventListener('input', e => { if (e.target.id !== 'lv-name') readLevers(); });
    lv.addEventListener('change', e => { if (e.target.id !== 'lv-name') readLevers(); });
    lv.addEventListener('click', e => {
      const p = e.target.closest('[data-preset]');
      if (p) {
        const keep = { trProj: S.trProj, rend: S.rend };
        S = Object.assign(DEFAULTS(), keep);
        if (p.dataset.preset === 'churn300') { S.churn = 300000; S.churnIdx = Math.min(base.cur + 1, base.yEnd); }
        if (p.dataset.preset === 'cresc10') S.receitaPct = 10;
        if (p.dataset.preset === 'desp10') S.despPct = -10;
        if (p.dataset.preset === 'prol5') S.prolPct = 5;
        mount(root); return;
      }
      const ld = e.target.closest('[data-load]');
      if (ld) { const s = loadSaved()[ld.dataset.load]; if (s) { S = Object.assign(DEFAULTS(), s); base = buildBase(); mount(root); } return; }
      const dl = e.target.closest('[data-del]');
      if (dl) { const all = loadSaved(); delete all[dl.dataset.del]; try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (err) {} renderSaved(); return; }
      if (e.target.id === 'lv-save') {
        const name = root.querySelector('#lv-name').value.trim();
        if (!name) { root.querySelector('#lv-name').focus(); return; }
        const all = loadSaved(); all[name] = S;
        try { localStorage.setItem(STORE, JSON.stringify(all)); FPA.toast('Cenário salvo'); } catch (err) { FPA.toast('Não foi possível salvar neste navegador'); }
        renderSaved();
      }
    });
    renderSaved();
    readLevers();
  }

  FPA.pages = FPA.pages || {};
  FPA.pages.forecast = {
    async show(root) {
      if (root.dataset.ready) return;
      root.innerHTML = FPA.loading();
      try {
        K = await FPA.klip();
        S = DEFAULTS();
        base = buildBase();
        mount(root);
        root.dataset.ready = '1';
      } catch (e) {
        root.innerHTML = FPA.errorBox(e, 'a BASE KLIP');
      }
    },
  };
})();
