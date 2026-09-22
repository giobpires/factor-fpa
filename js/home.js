// 01 Visao geral: a empresa em uma tela, com leitura automatica dos numeros.
(function () {
  const C = FPA.CHART;
  const charts = {};

  FPA.chartOpts = function (yFmt, extra = {}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', align: 'start', labels: { boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 11 }, color: C.text } },
        tooltip: {
          backgroundColor: '#FFFFFF', borderColor: '#CFCFC5', borderWidth: 1, titleColor: '#000', bodyColor: '#2E2E2E', padding: 10,
          titleFont: { family: "'Geist Mono', monospace", size: 11 }, bodyFont: { size: 12 },
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.dataset.fmt || yFmt)(ctx.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Geist Mono', monospace", size: 10 }, color: C.text } },
        y: { grid: { color: C.grid }, border: { display: false }, ticks: { font: { size: 10 }, color: C.text, callback: v => yFmt(v) } },
      },
    }, extra);
  };
  FPA.mkChart = function (store, id, cfg) {
    if (store[id]) store[id].destroy();
    const cv = document.getElementById(id);
    if (!cv) return;
    store[id] = new Chart(cv.getContext('2d'), cfg);
  };

  const pp = (a, b) => (a === null || b === null) ? null : (a - b) * 100;
  const ppTxt = v => v === null ? '' : ` (${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p.)`;
  const chg = (a, b) => (a === null || b === null || !b) ? null : a / b - 1;
  const deltaHtml = (v, invert) => {
    if (v === null || !isFinite(v)) return '';
    const good = invert ? v < 0 : v > 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${FPA.signPct(v)}</span>`;
  };
  const sum = (arr, i0, i1) => { let s = 0, has = false; for (let i = i0; i <= i1; i++) if (arr[i] !== null && arr[i] !== undefined) { s += arr[i]; has = true; } return has ? s : null; };

  // Leitura automatica: regras deterministicas sobre os numeros do mes.
  function leitura(K, i, extra) {
    const out = [];
    const mo = K.months[i].label, prev = i > 0 ? K.months[i - 1].label : null;
    const rb = K.grossRevenue[i], rbP = i > 0 ? K.grossRevenue[i - 1] : null, v = chg(rb, rbP);
    if (rb !== null) {
      let t = `Receita bruta de <b>${FPA.brlShort(rb)}</b> em ${mo}`;
      if (v !== null) t += `, ${v >= 0 ? 'alta' : 'queda'} de ${FPA.pct(Math.abs(v))} sobre ${prev}`;
      const y0 = K.months.findIndex(m => m.y === K.months[i].y);
      const ytd = sum(K.grossRevenue, y0, i), ytdB = sum(K.recBudg, y0, i);
      if (ytd !== null && ytdB) t += `. No ano, ${FPA.brlShort(ytd)} acumulados, ${FPA.pct(ytd / ytdB, 0)} do budget do período`;
      out.push({ text: t + '.', alert: v !== null && v < -0.05 });
    }
    const ini = K.mrrIni[i], fin = K.mrrFin[i];
    if (ini !== null && fin !== null) {
      const net = fin - ini;
      const parts = [];
      const nz = x => x !== null && Math.abs(x) >= 1;
      const neg = [], pos = [];
      if (nz(K.downsell[i])) neg.push(`downsell de ${FPA.brlShort(-K.downsell[i])}`);
      if (nz(K.churn[i])) neg.push(`churn de ${FPA.brlShort(-K.churn[i])}`);
      if (nz(K.newMRR[i])) pos.push(`${FPA.brlShort(K.newMRR[i])} de new MRR`);
      if (nz(K.upsell[i])) pos.push(`${FPA.brlShort(K.upsell[i])} de upsell`);
      let t = `O MRR ${net >= 0 ? 'subiu' : 'caiu'} <b>${FPA.brlShort(Math.abs(net))}</b> no mês e fechou em ${FPA.brlShort(fin)} (ARR ${FPA.brlShort(fin * 12)})`;
      if (net < 0 && neg.length) t += `: ${neg.join(' e ')}${pos.length ? `, com ${pos.join(' e ')} entrando no sentido contrário` : ''}`;
      else if (net >= 0 && pos.length) t += `: ${pos.join(' e ')}${neg.length ? `, contra ${neg.join(' e ')}` : ''}`;
      const perda = -((K.downsell[i] || 0) + (K.churn[i] || 0));
      parts.push(t + '.');
      out.push({ text: parts.join(' '), alert: ini && perda / ini > 0.05 });
    }
    const tr = K.trPct[i], mg = K.mgPct[i];
    if (tr !== null) {
      out.push({ text: `Take rate em <b>${FPA.pct(tr)}</b>${ppTxt(pp(tr, i > 0 ? K.trPct[i - 1] : null))} e margem bruta em <b>${FPA.pct(mg)}</b>${ppTxt(pp(mg, i > 0 ? K.mgPct[i - 1] : null))}.`, alert: false });
    }
    const eb = K.ebitda[i], ll = K.lucro[i], llB = K.resBudg[i];
    if (eb !== null && ll !== null) {
      let t = `EBITDA de <b>${FPA.brlShort(eb)}</b> (${FPA.pct(K.ebitdaPct[i])} da receita líquida) e resultado líquido de <b>${FPA.brlShort(ll)}</b>`;
      let alert = ll < 0;
      if (llB !== null) {
        const gap = ll - llB;
        t += `, ${FPA.brlShort(Math.abs(gap))} ${gap >= 0 ? 'acima' : 'abaixo'} do budget do mês (${FPA.brlShort(llB)})`;
        alert = gap < 0;
      }
      out.push({ text: t + '.', alert });
    }
    const sf = K.saldoFin[i], burn = K.burn[i], rw = K.runway[i];
    if (sf !== null) {
      let t = `Saldo de caixa de <b>${FPA.brlShort(sf)}</b>`;
      if (burn !== null) t += burn < 0 ? ` após queima de ${FPA.brlShort(-burn)} no mês` : ` com geração de ${FPA.brlShort(burn)} no mês`;
      if (rw !== null) t += `. Runway de <b>${FPA.int(rw)} meses</b>`;
      out.push({ text: t + '.', alert: rw !== null && rw < 12 });
    }
    const cf = K.cliFin[i];
    if (cf !== null) {
      let t = `<b>${FPA.int(cf)} clientes ativos</b>`;
      const bits = [];
      if (K.novosCli[i]) bits.push(`${FPA.int(K.novosCli[i])} ${K.novosCli[i] === 1 ? 'novo' : 'novos'}`);
      if (K.churnCli[i]) bits.push(`${FPA.int(K.churnCli[i])} ${K.churnCli[i] === 1 ? 'saída' : 'saídas'}`);
      if (bits.length) t += ` (${bits.join(', ')})`;
      if (extra.proj) t += ` em ${extra.proj.ativos} projetos`;
      if (K.ticket[i] !== null) t += `. Ticket médio de ${FPA.brlShort(K.ticket[i])}`;
      out.push({ text: t + '.', alert: false });
    }
    return out;
  }

  function statRow(label, value, sub) {
    return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value sm">${value}</span>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
  }

  function render(root, K, i, extra) {
    const mo = K.months[i];
    const win = arr => arr.slice(Math.max(0, i - 11), i + 1);
    const isCur = i === K.curIdx && i !== K.closedIdx;
    const prevV = (arr) => i > 0 ? arr[i - 1] : null;

    const sel = K.months.map((m, k) => ({ m, k })).filter(o => K.grossRevenue[o.k] !== null).reverse()
      .map(o => `<option value="${o.k}" ${o.k === i ? 'selected' : ''}>${FPA.MESES_LONGOS[o.m.m - 1]} ${o.m.y}${o.k === K.curIdx && o.k !== K.closedIdx ? ' (em andamento)' : ''}</option>`).join('');

    const read = leitura(K, i, extra);
    const budRec = K.recBudg[i];

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">01 Visão geral</p>
          <h1>A empresa em uma tela</h1>
          <p class="lede">Receita, resultado, caixa e base instalada de ${FPA.MESES_LONGOS[mo.m - 1]} de ${mo.y}. Os números vêm da BASE KLIP e atualizam a cada acesso.</p>
        </div>
        <div class="controls">
          ${isCur ? '<span class="badge badge--accent">Mês em andamento</span>' : '<span class="badge badge--ok">Mês fechado</span>'}
          <label class="field"><span>Mês</span><select id="home-month">${sel}</select></label>
        </div>
      </header>

      <section class="section">
        <div class="callout">
          <p class="callout-label">Leitura automática</p>
          <ul class="reading">${read.map(r => `<li class="${r.alert ? 'alert' : ''}">${r.text}</li>`).join('')}</ul>
        </div>
      </section>

      <section class="section grid g4">
        <div class="block">
          <div class="block-head"><h3>Receita</h3><a href="#/dash/revenue">Abrir Revenue</a></div>
          <div class="stat-row">
            <div class="stat"><span class="stat-label">Receita bruta</span><span class="stat-value lg">${FPA.brlShort(K.grossRevenue[i])}</span>
              <span class="stat-sub">${deltaHtml(chg(K.grossRevenue[i], prevV(K.grossRevenue)))} vs mês anterior</span></div>
            ${FPA.spark(win(K.grossRevenue))}
          </div>
          <div class="grid g2">
            ${statRow('MRR final', FPA.brlShort(K.mrrFin[i]), 'ARR ' + FPA.brlShort(K.arrFin[i] ?? (K.mrrFin[i] * 12)))}
            ${statRow('Take rate', FPA.pct(K.trPct[i]), FPA.brlShort(K.trR[i]))}
          </div>
          ${budRec ? `<p class="small muted">Budget do mês: ${FPA.brlShort(budRec)}. Atingido: <b>${FPA.pct(K.grossRevenue[i] / budRec, 0)}</b>.</p>` : ''}
        </div>

        <div class="block">
          <div class="block-head"><h3>Resultado</h3><a href="#/dash/dre">Abrir DRE</a></div>
          <div class="stat-row">
            <div class="stat"><span class="stat-label">Resultado líquido</span><span class="stat-value lg ${K.lucro[i] < 0 ? 'neg' : ''}">${FPA.brlShort(K.lucro[i])}</span>
              <span class="stat-sub">${FPA.pct(K.lucroPct[i])} da receita líquida</span></div>
            ${FPA.spark(win(K.lucro), { zero: true })}
          </div>
          <div class="grid g2">
            ${statRow('EBITDA', `<span class="${K.ebitda[i] < 0 ? 'neg' : ''}">${FPA.brlShort(K.ebitda[i])}</span>`, FPA.pct(K.ebitdaPct[i]))}
            ${statRow('Margem bruta', FPA.pct(K.mgPct[i]), FPA.brlShort(K.mgR[i]))}
          </div>
          ${K.resBudg[i] !== null ? `<p class="small muted">Budget do resultado: ${FPA.brlShort(K.resBudg[i])}. Diferença: <b class="${K.lucro[i] - K.resBudg[i] < 0 ? 'neg' : ''}">${FPA.brlShort(K.lucro[i] - K.resBudg[i])}</b>.</p>` : ''}
        </div>

        <div class="block">
          <div class="block-head"><h3>Caixa</h3><a href="#/dash/cashflow">Abrir Cashflow</a></div>
          <div class="stat-row">
            <div class="stat"><span class="stat-label">Saldo final</span><span class="stat-value lg">${FPA.brlShort(K.saldoFin[i])}</span>
              <span class="stat-sub">${deltaHtml(chg(K.saldoFin[i], prevV(K.saldoFin)))} vs mês anterior</span></div>
            ${FPA.spark(win(K.saldoFin))}
          </div>
          <div class="grid g2">
            ${statRow(K.burn[i] !== null && K.burn[i] >= 0 ? 'Geração do mês' : 'Queima do mês', `<span class="${K.burn[i] < 0 ? 'neg' : ''}">${FPA.brlShort(K.burn[i])}</span>`, 'operacional ' + FPA.brlShort(K.geracaoOp[i]))}
            ${statRow('Runway', K.runway[i] !== null ? FPA.int(K.runway[i]) + ' meses' : 'n/d', 'saldo sobre queima média')}
          </div>
        </div>

        <div class="block">
          <div class="block-head"><h3>Base instalada</h3><a href="#/margem">Abrir margem</a></div>
          <div class="stat-row">
            <div class="stat"><span class="stat-label">Clientes ativos</span><span class="stat-value lg">${FPA.int(K.cliFin[i])}</span>
              <span class="stat-sub">+${FPA.int(K.novosCli[i] || 0)} ${K.novosCli[i] === 1 ? 'novo' : 'novos'}, -${FPA.int(K.churnCli[i] || 0)} ${K.churnCli[i] === 1 ? 'saída' : 'saídas'}</span></div>
            ${FPA.spark(win(K.cliFin))}
          </div>
          <div class="grid g2">
            ${statRow('Projetos ativos', extra.proj ? FPA.int(extra.proj.ativos) : 'n/d', extra.proj ? `${extra.proj.novos} ${extra.proj.novos === 1 ? 'novo' : 'novos'} no mês` : 'base de MRR')}
            ${statRow('Ticket médio', FPA.brlShort(K.ticket[i]), 'por cliente')}
          </div>
          <div class="grid g2">
            ${statRow('Headcount', K.hc[i] !== null ? FPA.int(K.hc[i]) : 'n/d', K.hc[i] === null ? 'sem dado no mês' : 'time interno')}
            ${extra.prolancers !== null ? statRow('Prolancers alocados', FPA.int(extra.prolancers), 'foto atual') : ''}
          </div>
        </div>
      </section>

      <section class="section grid g2">
        <div class="panel">
          <div class="section-head"><h3>Receita e resultado, 12 meses</h3></div>
          <div class="chart-box"><canvas id="home-c1"></canvas></div>
        </div>
        <div class="panel">
          <div class="section-head"><h3>Caixa e queima, 12 meses</h3></div>
          <div class="chart-box"><canvas id="home-c2"></canvas></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Leitura e análise completa</h2><span class="small muted">Abas do Dash Finance</span></div>
        <div class="tiles">
          <a class="tile" href="#/dash/revenue"><b>Revenue</b><span>MRR, decomposição, clientes, ticket</span></a>
          <a class="tile" href="#/dash/cashflow"><b>Cashflow</b><span>Saldo, burn, prazos, runway</span></a>
          <a class="tile" href="#/dash/budget"><b>Real vs Budget</b><span>Receita, take rate, EBITDA, resultado</span></a>
          <a class="tile" href="#/dash/headcount"><b>Headcount</b><span>Time, custo por área, eficiência</span></a>
          <a class="tile" href="#/dash/dre"><b>DRE Gerencial</b><span>Mês, trimestre e ano</span></a>
          <a class="tile" href="#/dash/kpis"><b>KPIs</b><span>NDR, CAC, LTV, Rule of 40</span></a>
          <a class="tile" href="#/dash/forecast"><b>Forecast base</b><span>Projeção até dezembro</span></a>
        </div>
      </section>`;

    root.querySelector('#home-month').addEventListener('change', e => render(root, K, +e.target.value, Object.assign({}, extra, { proj: extra.projFor(+e.target.value) })));

    const labels = win(K.months).map(m => m.label);
    FPA.mkChart(charts, 'home-c1', {
      type: 'bar',
      data: {
        labels, datasets: [
          { type: 'bar', label: 'Receita bruta', data: win(K.grossRevenue), backgroundColor: C.orange, borderRadius: 2, order: 2 },
          { type: 'line', label: 'Resultado líquido', data: win(K.lucro), borderColor: C.malva, backgroundColor: C.malva, borderWidth: 2, pointRadius: 2.5, tension: 0.3, order: 1 },
        ],
      },
      options: FPA.chartOpts(FPA.brlShort),
    });
    FPA.mkChart(charts, 'home-c2', {
      type: 'bar',
      data: {
        labels, datasets: [
          { type: 'line', label: 'Saldo final', data: win(K.saldoFin), borderColor: C.orange, backgroundColor: C.orange, borderWidth: 2, pointRadius: 2.5, tension: 0.3, yAxisID: 'y', order: 1 },
          { type: 'bar', label: 'Burn do mês', data: win(K.burn), backgroundColor: C.malva, borderRadius: 2, yAxisID: 'y2', order: 2 },
        ],
      },
      options: (() => {
        const o = FPA.chartOpts(FPA.brlShort);
        const M = Math.max(...win(K.burn).map(v => Math.abs(v || 0))) * 1.15 || 1;
        o.scales.y.beginAtZero = false;
        o.scales.y2 = { position: 'right', min: -M, max: M, grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, color: C.text, callback: v => FPA.brlShort(v) } };
        return o;
      })(),
    });
  }

  FPA.pages = FPA.pages || {};
  FPA.pages['visao-geral'] = {
    async show(root) {
      if (root.dataset.ready) return;
      root.innerHTML = FPA.loading();
      try {
        const K = await FPA.klip();
        let mrr = null, take = null;
        try { mrr = await FPA.mrrBD(); } catch (e) { console.warn('MRR BD', e); }
        try { take = await FPA.takeRate(); } catch (e) { console.warn('Take rate', e); }
        const projFor = k => mrr ? FPA.projectStats(mrr, K.months[k].y, K.months[k].m) : null;
        const internos = new Set(FPA.PROJETOS_INTERNOS);
        const prolancers = take ? new Set(take.filter(t => !internos.has(t.projeto.toUpperCase())).map(t => t.prolancer.toUpperCase())).size : null;
        const i = K.closedIdx;
        render(root, K, i, { proj: projFor(i), projFor, prolancers });
        root.dataset.ready = '1';
      } catch (e) {
        root.innerHTML = FPA.errorBox(e, 'a BASE KLIP');
      }
    },
  };
})();
