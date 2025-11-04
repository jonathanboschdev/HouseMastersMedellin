
/* ==========================================================
   currency.js — Selector de moneda con icono de "mundo"
   (sin caja superior; solo título + lista con banderas SVG)
   Expone: window.Currency y window.formatPrice
   ========================================================== */
(function () {
  // Tasas base (fallback) desde COP; se reemplazan con API si hay red
  let rates = { COP: 1, USD: 1 / 3900, EUR: 1 / 4200 };
  const API_URL = 'https://open.er-api.com/v6/latest/COP';
  const CACHE_KEY = 'currency_rates_cache_v1';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hora

  function loadCachedRates() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { at, rates: r } = JSON.parse(raw);
      if (!at || !r) return;
      if (Date.now() - at < CACHE_TTL && r.USD && r.EUR) {
        rates = { COP: 1, USD: r.USD, EUR: r.EUR };
      }
    } catch (_) { }
  }

  async function fetchRates() {
    try {
      const res = await fetch(API_URL, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error('Bad status');
      const data = await res.json();
      // Exchangerate.host retorna { base:'COP', rates:{ USD: <USD/COP>, EUR: <EUR/COP> }, date: 'YYYY-MM-DD' }
      const r = data && data.rates ? data.rates : null;
      if (r && typeof r.USD === 'number' && typeof r.EUR === 'number') {
        rates = { COP: 1, USD: r.USD, EUR: r.EUR };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rates: { USD: r.USD, EUR: r.EUR } }));
        // Notifica para refrescar etiquetas/precios ya pintados
        document.dispatchEvent(new CustomEvent('currencychange', { detail: { code: Currency.code } }));
      }
    } catch (_) {
      // Silencioso: conserva fallback si hay error/red
    }
  }

  const symbols = { COP: '$', USD: '$', EUR: '€' };
  const locales = { COP: 'es-CO', USD: 'en-US', EUR: 'es-ES' };
  const display = { COP: 'COP / $', USD: 'USD / $', EUR: 'EUR / €' };

  // ---------------- State ----------------
  function getCode() {
    try { return JSON.parse(localStorage.getItem('currency'))?.code || 'COP'; }
    catch { return 'COP'; }
  }
  function setCode(code) { localStorage.setItem('currency', JSON.stringify({ code })); }

  // ---------------- API pública ----------------
  const CURRENCY = {
    get code() { return getCode(); },
    set(code) { setCode(code); },
    format(copAmount, { withoutSymbol = false } = {}) {
      const code = getCode();
      const factor = rates[code] || 1;
      const amount = (copAmount || 0) * factor;
      const locale = locales[code] || 'es-CO';
      const text = amount.toLocaleString(locale, { maximumFractionDigits: 0 });
      if (withoutSymbol) return text;
      // Formatos solicitados por el cliente:
      // EUR: precio €  |  USD: $precio  |  COP: $ precio
      if (code === 'EUR') return `${text} ${symbols[code]}`;
      if (code === 'COP') return `${symbols[code]} ${text}`;
      return `${symbols[code]}${text}`;
    },
    label() { return display[getCode()] || display.COP; },
    // Conversión: desde y hacia COP
    fromCOP(copAmount) { const code = getCode(); const factor = rates[code] || 1; return (copAmount || 0) * factor; },
    toCOP(amountInSelected) { const code = getCode(); const factor = rates[code] || 1; return (amountInSelected || 0) / factor; }
  };
  window.Currency = CURRENCY;

  // Helper para tarjetas/listados
  window.formatPrice = function (priceCop, transaction) {
    return `${CURRENCY.format(priceCop)}${transaction === 'arriendo' ? ' /mes' : ''}`;
  };

  // ---------------- Banderas (SVG inline, independientes de emojis) ----------------
  function flagSVG(code) {
    switch (code) {
      // Colombia: amarillo (1/2), azul (1/4), rojo (1/4)
      case 'COP':
        return `
          <svg viewBox="0 0 4 3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="4" height="3" fill="#FCD116"/>
            <rect y="1.5" width="4" height="0.75" fill="#003893"/>
            <rect y="2.25" width="4" height="0.75" fill="#CE1126"/>
          </svg>`;
      // Estados Unidos: franjas + cantón azul (sin estrellas para simplicidad)
      case 'USD':
        return `
          <svg viewBox="0 0 19 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="19" height="10" fill="#fff"/>
            <g fill="#B22234">
              <rect y="0" width="19" height="1"/>
              <rect y="2" width="19" height="1"/>
              <rect y="4" width="19" height="1"/>
              <rect y="6" width="19" height="1"/>
              <rect y="8" width="19" height="1"/>
            </g>
            <rect width="8" height="5.5" fill="#3C3B6E"/>
          </svg>`;
      // España: rojo/amarillo/rojo (1:2:1)
      case 'EUR':
        return `
          <svg viewBox="0 0 4 3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="4" height="3" fill="#AA151B"/>
            <rect y="0.75" width="4" height="1.5" fill="#F1BF00"/>
          </svg>`;
      default:
        return '';
    }
  }

  // ---------------- UI (icono + dropdown) ----------------
  document.addEventListener('DOMContentLoaded', () => {
    // 1) Carga caché (si vigente) y 2) pide tasas frescas en segundo plano
    loadCachedRates();
    fetchRates();
    const navLinks = document.querySelector('nav .nav-links');
    if (!navLinks || navLinks.querySelector('.currency-menu')) return;

    const li = document.createElement('li');
    li.className = 'currency-menu';
    li.innerHTML = `
  <!-- Botón rectangular con bandera + label + chevron -->
  <button class="currency-toggle" aria-label="Cambiar moneda" title="Moneda" type="button">
    <span class="flag-svg">${flagSVG(Currency.code)}</span>
    <span class="label">${Currency.label()}</span>
    <i class="fas fa-caret-down chevron" aria-hidden="true"></i>
  </button>

  <div class="currency-panel" role="menu" aria-label="Moneda">
    <div class="panel-title">Moneda</div>
    <ul class="currency-options">
      <li data-code="COP">
        <span class="flag-svg">${flagSVG('COP')}</span>
        <span class="label">COP / $</span>
        <i class="fas fa-check"></i>
      </li>
      <li data-code="USD">
        <span class="flag-svg">${flagSVG('USD')}</span>
        <span class="label">USD / $</span>
        <i class="fas fa-check"></i>
      </li>
      <li data-code="EUR">
        <span class="flag-svg">${flagSVG('EUR')}</span>
        <span class="label">EUR / €</span>
        <i class="fas fa-check"></i>
      </li>
    </ul>
  </div>
`;
    navLinks.appendChild(li);

    const panel = li.querySelector('.currency-panel');
    const toggle = li.querySelector('.currency-toggle');
    const options = li.querySelectorAll('.currency-options li');

    function renderToggle() {
      // pinta bandera + "CODE / símbolo" + chevron dentro del botón rectangular
      toggle.innerHTML = `
    <span class="flag-svg">${flagSVG(Currency.code)}</span>
    <span class="label">${Currency.label()}</span>
    <i class="fas fa-caret-down chevron" aria-hidden="true"></i>
  `;
    }

    function markActive() {
      options.forEach(opt => opt.classList.toggle('active', opt.dataset.code === Currency.code));
    }
    markActive();
    renderToggle();

    // Abrir/cerrar
    function open() { li.classList.add('open'); panel.classList.add('open'); }
    function close() { li.classList.remove('open'); panel.classList.remove('open'); }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      li.classList.contains('open') ? close() : open();
    });
    /*         li.addEventListener('mouseenter', open);
            li.addEventListener('mouseleave', close); */
    document.addEventListener('click', (e) => { if (!li.contains(e.target)) close(); });


    // Cambio de moneda (sin recargar)
    options.forEach(o => o.addEventListener('click', () => {
      Currency.set(o.dataset.code);
      markActive();
      renderToggle();

      // 1) Aviso global para que otras vistas reaccionen si lo necesitan
      document.dispatchEvent(new CustomEvent('currencychange', { detail: { code: Currency.code } }));

      // 2) Actualización inmediata de todos los precios pintados con data attributes
      const applyCurrency = () => {
        // Precios en tarjetas / listados / encabezados
        document.querySelectorAll('[data-price]').forEach(el => {
          const base = Number(el.getAttribute('data-price')) || 0;          // precio base en COP
          const tx = el.getAttribute('data-transaction') || '';           // 'venta' | 'arriendo'
          el.textContent = (window.formatPrice ? window.formatPrice(base, tx) : Currency.format(base));
        });

        // Etiquetas de filtros de precio
        document.querySelectorAll('[data-price-label]').forEach(el => {
          el.textContent = `Rango de Precio (${Currency.code})`;
        });
      };
      applyCurrency();

      // Cierra el panel
      (li.classList?.remove && panel.classList?.remove) && (li.classList.remove('open'), panel.classList.remove('open'));
    }));

    // Sincroniza etiquetas al cargar (usará rates de caché si existen)
    document.querySelectorAll('[data-price-label]').forEach(el => {
      el.textContent = `Rango de Precio (${Currency.code})`;
    });
  });
})();

