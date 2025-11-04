// =========================================
// Favoritos / Comparación
// Requiere: properties.js, currency.js
// =========================================

// Estado
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]').map(String);
let comparison = JSON.parse(localStorage.getItem('propertyComparison') || '[]').map(String);


// Datos
function getPropertiesData() {
  return Array.isArray(window.PROPERTIES_DATA) ? window.PROPERTIES_DATA : [];
}

// Init
document.addEventListener('DOMContentLoaded', async function () {
  if (!(window.PROPERTIES_DATA && window.PROPERTIES_DATA.length)) {
    await (window.PROPERTIES_READY || Promise.resolve());
  }
  loadFavorites();
  loadComparison();
  initNavigation();
});

// Tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
  if (tabName === 'favorites') loadFavorites();
  if (tabName === 'comparison') loadComparison();
}

// ======================
//   FAVORITOS
// ======================
function loadFavorites() {
  const container = document.getElementById('favoritesGrid');
  const properties = getPropertiesData();
  const favoriteProperties = properties.filter(p => favorites.includes(String(String(p.id))));

  if (favoriteProperties.length === 0) {
    container.innerHTML = `
              <div class="empty-state" style="grid-column:1 / -1;">
                <i class="fas fa-heart-broken"></i>
                <h3>No tienes favoritos aún</h3>
                <p>Explora nuestro catálogo y marca las propiedades que más te gusten</p>
                <a href="catalogo.html" class="browse-btn">
                  <i class="fas fa-magnifying-glass btn-icon" aria-hidden="true"></i>
                  Explorar propiedades
                </a>
              </div>`;
    return;
  }

  container.innerHTML = '';
  favoriteProperties.forEach(property => container.appendChild(createFavoriteCard(property)));
}

function createFavoriteCard(property) {
  const card = document.createElement('div');
  card.className = 'property-card fade-in';
  card.innerHTML = `
            <div class="property-image">
              <img src="${property.image}" alt="${property.title}">
              <button class="remove-favorite" onclick="removeFavorite(\'${property.id}\')" title="Quitar de favoritos">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="property-info">
                <div class="property-price"
                    data-price="${property.price}"
                    data-transaction="${property.transaction}">
                ${formatPrice(property.price, property.transaction)}
                </div>
              <div class="property-title">${property.title}</div>
              <div class="property-location">
                <i class="fas fa-map-marker-alt"></i> ${property.location}
              </div>
              <div class="property-features">
                ${property.bedrooms > 0 ? `<div class="feature"><i class="fas fa-bed feature-icon"></i>${property.bedrooms} hab</div>` : ''}
                <div class="feature"><i class="fas fa-bath feature-icon"></i>${property.bathrooms} baños</div>
                <div class="feature"><i class="fas fa-ruler-combined feature-icon"></i>${property.area} m²</div>
              </div>
              <div class="property-actions">
                <a href="propiedad.html?id=${property.id}" class="action-btn">
                  <i class="fas fa-eye"></i> Ver
                </a>
                <button class="action-btn desktop-only" onclick="addToComparison('${property.id}')" >
                  <i class="fas fa-balance-scale"></i> Comparar
                </button>
                <button class="action-btn whatsapp-btn" onclick="contactWhatsApp('${property.id}')" >
                  <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
              </div>
            </div>
          `;
  // Click en tarjeta = navegar (excepto botones)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('a')) {
      window.location.href = `propiedad.html?id=${property.id}`;
    }
  });
  return card;
}

function removeFavorite(propertyId) {
  propertyId = String(propertyId);
  propertyId = String(propertyId);
  favorites = favorites.filter(id => id !== propertyId);
  localStorage.setItem('favorites', JSON.stringify(favorites));
  loadFavorites();
  showNotification('Propiedad eliminada de favoritos', 'error');
}

// ======================
//   COMPARACIÓN
// ======================
function loadComparison() {
  const container = document.getElementById('comparisonContainer');
  const properties = getPropertiesData();

  // Re-sync por si se modificó en otra vista/acción:
  comparison = JSON.parse(localStorage.getItem('propertyComparison') || '[]').map(String);

  const cmp = properties.filter(p => comparison.includes(String(String(p.id))));

  if (cmp.length === 0) {
    container.innerHTML = `
              <div class="empty-state">
                <i class="fas fa-balance-scale"></i>
                <h3>No hay propiedades en comparación</h3>
                <p>Agrega hasta 3 propiedades para compararlas lado a lado</p>
                <a href="catalogo.html" class="browse-btn">
                  <i class="fas fa-magnifying-glass btn-icon" aria-hidden="true"></i>
                  Explorar propiedades
                </a>
              </div>`;
    return;
  }

  let tableHTML = `
            <h3 style="margin-bottom:20px; color:#0F172A;">
              <i class="fas fa-balance-scale"></i> Comparar Propiedades
            </h3>
            <table class="comparison-table">
              <thead>
                <tr>
                  <th>Características</th>
          `;
  cmp.forEach(p => {
    tableHTML += `
              <th class="property-cell">
                <button class="remove-comparison" onclick="removeFromComparison(\'${p.id}\')" title="Quitar de comparación">
                  <i class="fas fa-times"></i>
                </button>
                <img src="${p.image}" alt="${p.title}">
                <div style="font-size:14px; font-weight:600;">${p.title}</div>
              </th>`;
  });
  tableHTML += `
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Precio</strong></td>
          `;
  cmp.forEach(p => {
    tableHTML += `
              <td class="property-cell" style="color:#193A8A; font-weight:600;">
                ${formatPrice(p.price, p.transaction)}
              </td>`;
  });

  const compareFields = [
    { key: 'location', label: 'Ubicación', icon: 'map-marker-alt' },
    { key: 'area', label: 'Área (m²)', icon: 'ruler-combined', suffix: ' m²' },
    { key: 'bedrooms', label: 'Habitaciones', icon: 'bed' },
    { key: 'bathrooms', label: 'Baños', icon: 'bath' },
    { key: 'parking', label: 'Parqueadero', icon: 'car', format: 'si_no' },
    { key: 'stratum', label: 'Estrato', icon: 'layer-group' }
  ];

  compareFields.forEach(field => {
    tableHTML += `
              </tr>
              <tr>
                <td><strong><i class="fas fa-${field.icon}"></i> ${field.label}</strong></td>
            `;
    cmp.forEach(p => {
      let value = p[field.key];

      if (field.format === 'currency' && typeof value === 'number') {
        value = Currency.format(value); // <<<< integración de moneda
      }
      // Formato Sí/No (para booleanos y equivalentes)
      if (field.format === 'si_no') {
        const t = String(value).trim().toLowerCase();
        const truthy = (value === true) || t === 'true' || t === '1' || t === 'si' || t === 'sí' || t === 'yes';
        value = truthy ? 'Sí' : 'No';
      }
      tableHTML += `<td class="property-cell">${(value ?? 'N/A')}${field.suffix || ''}</td>`;
    });
  });

  tableHTML += `
              </tr>
              <tr>
                <td><strong>Acciones</strong></td>
          `;
  cmp.forEach(p => {
    tableHTML += `
              <td class="property-cell">
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <a href="propiedad.html?id=${p.id}" class="action-btn" style="font-size:12px;">
                    <i class="fas fa-eye"></i> Ver Detalles
                  </a>
                    <button class="action-btn whatsapp-btn" onclick="contactWhatsApp('${p.id}')" style="font-size:12px;">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
              </td>`;
  });

  tableHTML += `
              </tr>
            </tbody>
          </table>`;
  container.innerHTML = tableHTML;
}

function addToComparison(propertyId) {
  propertyId = String(propertyId);
  if (comparison.length >= 3) return showNotification('Máximo 3 propiedades en comparación', 'error');

  if (!comparison.includes(propertyId)) {
    comparison.push(propertyId);
    localStorage.setItem('propertyComparison', JSON.stringify(comparison));
    showNotification('Propiedad agregada a comparación', 'success');

    // REFRESCOS:
    showQuickStats();
    if (document.getElementById('comparison').classList.contains('active')) {
      loadComparison();
    }
  } else {
    showNotification('La propiedad ya está en comparación', 'info');
  }
}

function removeFromComparison(propertyId) {
  propertyId = String(propertyId);
  propertyId = String(propertyId);
  comparison = comparison.filter(id => id !== propertyId);
  localStorage.setItem('propertyComparison', JSON.stringify(comparison));
  loadComparison();
  showNotification('Propiedad eliminada de la comparación', 'error');
}

function contactWhatsApp(propertyId) {
  propertyId = String(propertyId);
  const p = getPropertiesData().find(x => String(x.id) === String(propertyId));
  if (!p) return;
  const message = `Hola, estoy interesado en la propiedad: ${p.title} - ${p.location}`;
  const url = `https://wa.me/573145069405?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ======================
//   UTILIDADES
// ======================
function showNotification(message, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  n.style.cssText = `
    position:fixed;top:20px;right:20px;
    color:#fff;
    padding:12px 20px;border-radius:10px;
    z-index:9999;
    animation:slideInRight .3s ease;
    box-shadow:0 10px 25px rgba(0,0,0,.2)
  `;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = 'slideInRight .3s ease reverse';
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

// Limpiar todo (favoritos y comparación)
function clearAllData() {
  if (!confirm('¿Eliminar todos tus datos guardados?')) return;
  localStorage.removeItem('favorites');
  localStorage.removeItem('propertyComparison');
  favorites = [];
  comparison = [];
  loadFavorites();
  loadComparison();
  showQuickStats();
  showNotification('Todos los datos han sido eliminados', 'error');
}

// Botones extra (exportar / limpiar)
function addUtilityButtons() {
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;';
  box.innerHTML = `
            <button class="browse-btn" onclick="clearAllData()" style="background:#FF0000; font-size:14px; padding:8px 16px;">
              <i class="fas fa-trash btn-icon"></i> Limpiar Todo
            </button>
          `;
  const header = document.querySelector('.page-header');
  if (header) header.appendChild(box);
}

// Stats rápidas (en el subtítulo)
function showQuickStats() {
  const favCount = favorites.length;
  const compCount = comparison.length;
  const subtitle = document.querySelector('.page-subtitle');
  if (subtitle) {
    subtitle.innerHTML = `
      Tienes <strong>${favCount}</strong> favorito${favCount !== 1 ? 's' : ''}
      <span class="desktop-only"> y <strong>${compCount}</strong> en comparación</span>
    `;
  }
}

// Carga utilitarios y sincroniza stats si cambian favoritos/comparación
window.addEventListener('load', function () {
  addUtilityButtons();
  showQuickStats();

  const origSet = localStorage.setItem;
  localStorage.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (['favorites', 'propertyComparison'].includes(k)) setTimeout(showQuickStats, 100);
  };
});

function initNavigation() {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  // Cierra el menú al pulsar un enlace
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });
}

document.addEventListener('currencychange', () => {
  // re-renderiza para que todo (incluyendo campos currency de comparación) se actualice
  if (document.getElementById('favorites')) loadFavorites();
  if (document.getElementById('comparison')) loadComparison();
});