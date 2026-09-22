// Roteamento por hash, sub abas do Dash Finance e utilidades de interface.
(function () {
  const DASH_TABS = {
    revenue: ['Revenue', 'Receita recorrente, evolução do MRR e composição da base de clientes.'],
    cashflow: ['Cashflow', 'Posição de caixa, queima, recebimentos e prazo médio.'],
    budget: ['Real vs Budget', 'Realizado do ano contra o budget, por mês, YTD e ano.'],
    headcount: ['Headcount', 'Evolução do time, custo por centro de custo e eficiência.'],
    dre: ['DRE Gerencial', 'Mês, trimestre e ano, com take rate, margem, EBITDA e resultado.'],
    kpis: ['KPIs', 'Indicadores de SaaS e de receita do ano corrente.'],
    forecast: ['Forecast base', 'Projeção até dezembro. Para simular cenários, use a página Forecast.'],
  };
  let dashStarted = false;

  FPA.toast = function (msg, ms = 3000) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
  };

  function showDashTab(tab) {
    if (!DASH_TABS[tab]) tab = 'revenue';
    document.querySelectorAll('#dash-subnav a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    document.querySelectorAll('#legacy-root .tab-content').forEach(el => el.classList.toggle('active', el.id === 'tab-' + tab));
    document.getElementById('dash-title').textContent = DASH_TABS[tab][0];

    if (!dashStarted) {
      dashStarted = true;
      const st = document.getElementById('dash-status');
      st.innerHTML = FPA.loading();
      window.initLegacyDash().then(() => { if (!st.querySelector('.callout')) st.innerHTML = ''; })
        .catch(e => { st.innerHTML = FPA.errorBox(e, 'o Dash Finance'); console.error(e); });
    }
  }

  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'visao-geral').split('/');
    const page = (FPA.pages[parts[0]] || parts[0] === 'dash') ? parts[0] : 'visao-geral';
    document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== page; });
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === page));
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    const root = document.querySelector(`.page[data-page="${page}"]`);
    if (page === 'dash') showDashTab(parts[1] || 'revenue');
    else FPA.pages[page].show(root);
    document.title = (page === 'dash' ? 'Dash Finance' : document.querySelector(`.nav a[data-route="${page}"]`).childNodes[1].textContent.trim()) + ' | Factor FP&A';
  }

  window.addEventListener('hashchange', route);
  document.getElementById('nav-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });

  FPA.klip().then(K => {
    const cur = K.months[K.curIdx], cl = K.months[K.closedIdx];
    document.getElementById('foot-snapshot').textContent = `fechado ${cl.label}, vigente ${cur.label}`;
  }).catch(() => { document.getElementById('foot-snapshot').textContent = 'erro na BASE KLIP'; });

  route();
})();
