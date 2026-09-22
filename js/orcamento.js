// 06 Orcamento: pagina reservada. Construcao em uma fase dedicada.
(function () {
  FPA.pages = FPA.pages || {};
  FPA.pages.orcamento = {
    show(root) {
      if (root.dataset.ready) return;
      root.innerHTML = `
        <header class="page-head">
          <div>
            <p class="eyebrow">06 Orçamento</p>
            <h1>Orçamento</h1>
            <p class="lede">Espaço reservado para o orçamento anual. A estrutura será desenhada junto com o time de FP&amp;A.</p>
          </div>
          <span class="badge badge--accent">Em construção</span>
        </header>
        <div class="construction">
          <h3>O que já está disponível</h3>
          <p class="muted" style="margin-top:.4rem;max-width:68ch">O budget atual de receita, take rate, margem, EBITDA, resultado e caixa já aparece em <a href="#/dash/budget">Real vs Budget</a> no Dash Finance, lido da BASE KLIP.</p>
        </div>`;
      root.dataset.ready = '1';
    },
  };
})();
