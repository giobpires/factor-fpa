// 03 Margem por projeto: receita bruta, liquida (-9,05%), prolancers e take rate
// por cliente e projeto, no mes atual. Custos Factor entram numa fase seguinte.
(function () {
  const state = { tipo: '', q: '', open: new Set() };
  let data = null;

  const key = s => s.toUpperCase().replace(/\s+/g, ' ').trim();

  function build(mrr, take, K) {
    const t = FPA.today();
    // Mes atual; se a base ainda nao tiver o mes, usa o ultimo mes com receita ate hoje.
    let y = t.y, m = t.m;
    if (!mrr.some(r => r.y === y && r.m === m && r.bruta)) {
      const cands = mrr.filter(r => r.bruta && FPA.ym(r.y, r.m) <= FPA.ym(t.y, t.m)).map(r => FPA.ym(r.y, r.m));
      const best = Math.max(...cands);
      y = Math.floor(best / 100); m = best % 100;
    }
    const internos = new Set(FPA.PROJETOS_INTERNOS.map(key));
    const projetos = {};
    const semCompetencia = [];
    mrr.filter(r => r.y === y && r.m === m).forEach(r => {
      const k = key(r.projeto);
      if (internos.has(k)) return;
      if (!r.bruta && r.faturamento) semCompetencia.push(r);
      const p = projetos[k] || (projetos[k] = { key: k, projeto: r.projeto, cliente: r.cliente, tipos: new Set(), bruta: 0, prolancers: [] });
      p.bruta += r.bruta;
      if (r.tipo) p.tipos.add(r.tipo);
    });
    const custoSemReceita = [];
    const takeValid = take.filter(tk => !internos.has(key(tk.projeto)));
    takeValid.forEach(tk => {
      const k = key(tk.projeto);
      let p = projetos[k];
      if (!p) {
        p = projetos[k] = { key: k, projeto: tk.projeto, cliente: tk.projeto, tipos: new Set(), bruta: 0, prolancers: [], orphan: true };
      }
      p.prolancers.push(tk);
    });
    Object.values(projetos).forEach(p => {
      p.tipo = [...p.tipos].join(', ');
      p.liquida = p.bruta * (1 - FPA.DEDUCAO);
      p.deducao = p.bruta - p.liquida;
      p.custoPro = p.prolancers.reduce((a, b) => a + b.valor, 0);
      p.tr = p.liquida - p.custoPro;
      p.trPct = p.liquida ? p.tr / p.liquida : null;
      p.prolancers.sort((a, b) => b.valor - a.valor);
      if (p.orphan) custoSemReceita.push(p);
    });
    const clientes = {};
    Object.values(projetos).forEach(p => {
      const c = clientes[p.cliente] || (clientes[p.cliente] = { cliente: p.cliente, projetos: [] });
      c.projetos.push(p);
    });
    Object.values(clientes).forEach(c => {
      ['bruta', 'deducao', 'liquida', 'custoPro', 'tr'].forEach(f => c[f] = c.projetos.reduce((a, p) => a + p[f], 0));
      c.trPct = c.liquida ? c.tr / c.liquida : null;
      c.projetos.sort((a, b) => b.bruta - a.bruta);
      c.tipo = [...new Set(c.projetos.flatMap(p => [...p.tipos]))].join(', ');
    });
    const idx = K ? K.idxOf(y, m) : -1;
    return {
      y, m, clientes: Object.values(clientes).sort((a, b) => b.bruta - a.bruta),
      semCompetencia, custoSemReceita,
      semCusto: Object.values(projetos).filter(p => p.bruta && !p.custoPro),
      dreProlancer: idx >= 0 ? K.prolancer[idx] : null,
      dreReceita: idx >= 0 ? K.grossRevenue[idx] : null,
      takeTotal: takeValid.reduce((a, b) => a + b.valor, 0),
    };
  }

  const bar = (v) => {
    if (v === null || !isFinite(v)) return '<span class="muted">n/d</span>';
    const w = Math.max(0, Math.min(100, v * 100));
    return `<span class="cell-bar"><span class="track"><span class="fill ${v < 0.3 ? 'low' : ''}" style="width:${w}%"></span></span>${FPA.pct(v)}</span>`;
  };
  const money = v => `<span class="${v < 0 ? 'neg' : ''}">${FPA.brl(v)}</span>`;
  const neg = v => v ? FPA.brl(-v) : '<span class="muted">R$ 0</span>';

  function filtered() {
    const q = state.q.toLowerCase();
    return data.clientes.map(c => {
      const ps = c.projetos.filter(p => (!state.tipo || p.tipos.has(state.tipo)) &&
        (!q || p.projeto.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q) || p.prolancers.some(x => x.prolancer.toLowerCase().includes(q))));
      if (!ps.length) return null;
      const cc = { cliente: c.cliente, projetos: ps, tipo: c.tipo };
      ['bruta', 'deducao', 'liquida', 'custoPro', 'tr'].forEach(f => cc[f] = ps.reduce((a, p) => a + p[f], 0));
      cc.trPct = cc.liquida ? cc.tr / cc.liquida : null;
      return cc;
    }).filter(Boolean);
  }

  function tableHtml(list) {
    const pend = '<td class="pending">em construção</td><td class="pending">em construção</td>';
    let rows = '';
    list.forEach(c => {
      const cid = 'c:' + c.cliente;
      const openC = state.open.has(cid) || state.q;
      rows += `<tr class="row-click" data-toggle="${FPA.esc(cid)}"><td><span class="caret">${openC ? '−' : '+'}</span><b>${FPA.esc(c.cliente)}</b> <span class="cell-note" style="display:inline">${c.projetos.length > 1 ? c.projetos.length + ' projetos' : ''}</span></td>
        <td>${FPA.esc(c.tipo)}</td><td>${FPA.brl(c.bruta)}</td><td>${neg(c.deducao)}</td><td>${FPA.brl(c.liquida)}</td><td>${neg(c.custoPro)}</td><td>${money(c.tr)}</td><td>${bar(c.trPct)}</td>${pend}</tr>`;
      if (!openC) return;
      c.projetos.forEach(p => {
        const pid = 'p:' + p.key;
        const openP = state.open.has(pid);
        rows += `<tr class="child row-click" data-toggle="${FPA.esc(pid)}"><td><span class="caret">${p.prolancers.length ? (openP ? '−' : '+') : ''}</span>${FPA.esc(p.projeto)}${p.orphan ? ' <span class="badge badge--warn">sem receita</span>' : ''}${p.bruta && !p.custoPro ? ' <span class="badge badge--muted">sem prolancer</span>' : ''}
          <span class="cell-note">${p.prolancers.length} ${p.prolancers.length === 1 ? 'prolancer' : 'prolancers'}</span></td>
          <td>${FPA.esc(p.tipo)}</td><td>${FPA.brl(p.bruta)}</td><td>${neg(p.deducao)}</td><td>${FPA.brl(p.liquida)}</td><td>${neg(p.custoPro)}</td><td>${money(p.tr)}</td><td>${bar(p.trPct)}</td>${pend}</tr>`;
        if (openP) p.prolancers.forEach(x => {
          rows += `<tr class="child sub"><td style="padding-left:3.4rem">${FPA.esc(x.prolancer)}</td><td></td><td></td><td></td><td></td><td>${FPA.brl(-x.valor)}</td><td></td><td class="small">${p.custoPro ? FPA.pct(x.valor / p.custoPro, 0) + ' do custo' : ''}</td><td></td><td></td></tr>`;
        });
      });
    });
    const T = list.reduce((a, c) => { ['bruta', 'deducao', 'liquida', 'custoPro', 'tr'].forEach(f => a[f] += c[f]); return a; }, { bruta: 0, deducao: 0, liquida: 0, custoPro: 0, tr: 0 });
    rows += `<tr class="grand"><td>Total</td><td></td><td>${FPA.brl(T.bruta)}</td><td>${neg(T.deducao)}</td><td>${FPA.brl(T.liquida)}</td><td>${neg(T.custoPro)}</td><td>${money(T.tr)}</td><td>${bar(T.liquida ? T.tr / T.liquida : null)}</td><td class="pending"></td><td class="pending"></td></tr>`;
    return `<table class="t" id="mg-table"><thead><tr>
      <th>Cliente / projeto</th><th>Tipo</th><th>Receita bruta</th><th>(-) Deduções 9,05%</th><th>Receita líquida</th><th>(-) Prolancers</th><th>Take rate R$</th><th>Take rate %</th><th class="pending">(-) Custos Factor</th><th class="pending">Margem líquida</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function render(root) {
    const list = filtered();
    const T = list.reduce((a, c) => { ['bruta', 'liquida', 'custoPro', 'tr'].forEach(f => a[f] += c[f]); return a; }, { bruta: 0, liquida: 0, custoPro: 0, tr: 0 });
    const tipos = [...new Set(data.clientes.flatMap(c => c.projetos.flatMap(p => [...p.tipos])))].sort();
    const mes = `${FPA.MESES_LONGOS[data.m - 1]} de ${data.y}`;

    const alerts = [];
    data.custoSemReceita.forEach(p => alerts.push(`<b>${FPA.esc(p.projeto)}</b> tem ${FPA.brl(p.custoPro)} de prolancer e nenhuma receita em ${FPA.monthLabel(data.y, data.m)}. Confira o nome do projeto nas duas planilhas.`));
    data.semCompetencia.forEach(r => alerts.push(`<b>${FPA.esc(r.projeto)}</b> tem faturamento de ${FPA.brl(r.faturamento)} mas o Valor Competência está vazio na aba BD. Entra como receita zero.`));
    if (data.semCusto.length) alerts.push(`Sem custo de prolancer na planilha de take rate: ${data.semCusto.map(p => '<b>' + FPA.esc(p.projeto) + '</b>').join(', ')}. Take rate de 100% nesses projetos.`);
    if (data.dreProlancer !== null) {
      const dre = -data.dreProlancer, dif = dre - data.takeTotal;
      alerts.push(`Conciliação: o DRE de ${FPA.monthLabel(data.y, data.m)} traz ${FPA.brl(dre)} de prolancer e a planilha de take rate soma ${FPA.brl(data.takeTotal)} (sem projetos internos). Diferença de <b>${FPA.brl(dif)}</b>.`);
    }

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">03 Margem por projeto</p>
          <h1>Take rate por cliente e projeto</h1>
          <p class="lede">Competência de ${mes}. Receita líquida é a bruta menos 9,05%. O custo de prolancer vem da planilha de take rate. Custos Factor entram na próxima fase.</p>
        </div>
        <div class="controls">
          <label class="field"><span>Tipo</span><select id="mg-tipo"><option value="">Todos</option>${tipos.map(t => `<option ${t === state.tipo ? 'selected' : ''}>${FPA.esc(t)}</option>`).join('')}</select></label>
          <label class="field"><span>Buscar</span><input type="text" id="mg-q" placeholder="cliente, projeto ou prolancer" value="${FPA.esc(state.q)}"></label>
          <button class="btn" id="mg-csv">Exportar CSV</button>
        </div>
      </header>

      <section class="section grid g5">
        <div class="stat panel"><span class="stat-label">Receita bruta</span><span class="stat-value">${FPA.brlShort(T.bruta)}</span><span class="stat-sub">${list.reduce((a, c) => a + c.projetos.length, 0)} projetos, ${list.length} clientes</span></div>
        <div class="stat panel"><span class="stat-label">Receita líquida</span><span class="stat-value">${FPA.brlShort(T.liquida)}</span><span class="stat-sub">após 9,05% de deduções</span></div>
        <div class="stat panel"><span class="stat-label">Custo prolancer</span><span class="stat-value">${FPA.brlShort(T.custoPro)}</span><span class="stat-sub">${T.liquida ? FPA.pct(T.custoPro / T.liquida) + ' da líquida' : ''}</span></div>
        <div class="stat panel"><span class="stat-label">Take rate R$</span><span class="stat-value">${FPA.brlShort(T.tr)}</span><span class="stat-sub">líquida menos prolancer</span></div>
        <div class="stat panel"><span class="stat-label">Take rate %</span><span class="stat-value">${FPA.pct(T.liquida ? T.tr / T.liquida : null)}</span><span class="stat-sub">sobre a receita líquida</span></div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Abertura por cliente</h2>
          <div class="controls"><button class="btn btn--ghost" id="mg-expand">Expandir tudo</button><button class="btn btn--ghost" id="mg-collapse">Recolher</button></div>
        </div>
        <div class="table-wrap">${tableHtml(list)}</div>
        <p class="small muted" style="margin-top:.6rem">Clique no cliente para ver os projetos e no projeto para ver os prolancers. Projetos internos (BOSSABOX) ficam fora.</p>
      </section>

      ${alerts.length ? `<section class="section"><div class="callout callout--warn"><p class="callout-label">Conferências</p><ul class="reading">${alerts.map(a => `<li class="alert">${a}</li>`).join('')}</ul></div></section>` : ''}
    `;

    root.querySelector('#mg-tipo').onchange = e => { state.tipo = e.target.value; render(root); };
    const q = root.querySelector('#mg-q');
    q.oninput = e => { state.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(() => { render(root); const n = root.querySelector('#mg-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    root.querySelector('#mg-table').onclick = e => {
      const tr = e.target.closest('tr[data-toggle]');
      if (!tr) return;
      const k = tr.dataset.toggle;
      state.open.has(k) ? state.open.delete(k) : state.open.add(k);
      render(root);
    };
    root.querySelector('#mg-expand').onclick = () => { data.clientes.forEach(c => { state.open.add('c:' + c.cliente); c.projetos.forEach(p => state.open.add('p:' + p.key)); }); render(root); };
    root.querySelector('#mg-collapse').onclick = () => { state.open.clear(); render(root); };
    root.querySelector('#mg-csv').onclick = () => exportCSV(list);
  }

  function exportCSV(list) {
    const n = v => (Math.round(v * 100) / 100).toString().replace('.', ',');
    const lines = [['Cliente', 'Projeto', 'Prolancer', 'Tipo', 'Receita bruta', 'Deducoes', 'Receita liquida', 'Custo prolancer', 'Take rate R$', 'Take rate %'].join(';')];
    list.forEach(c => c.projetos.forEach(p => {
      lines.push([c.cliente, p.projeto, '', p.tipo, n(p.bruta), n(p.deducao), n(p.liquida), n(p.custoPro), n(p.tr), p.trPct === null ? '' : n(p.trPct * 100)].join(';'));
      p.prolancers.forEach(x => lines.push([c.cliente, p.projeto, x.prolancer, '', '', '', '', n(x.valor), '', ''].join(';')));
    }));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `margem-projetos-${data.y}-${String(data.m).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  FPA.pages = FPA.pages || {};
  FPA.pages.margem = {
    async show(root) {
      if (root.dataset.ready) return;
      root.innerHTML = FPA.loading();
      try {
        const [mrr, take] = await Promise.all([FPA.mrrBD(), FPA.takeRate()]);
        let K = null;
        try { K = await FPA.klip(); } catch (e) { console.warn(e); }
        data = build(mrr, take, K);
        render(root);
        root.dataset.ready = '1';
      } catch (e) {
        root.innerHTML = FPA.errorBox(e, 'a base de MRR ou a planilha de take rate');
      }
    },
  };
})();
