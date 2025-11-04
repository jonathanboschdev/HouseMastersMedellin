/* ============================
   Propiedad (interna)
   Requiere: properties.js, currency.js
   ============================ */

const urlParams = new URLSearchParams(window.location.search);
const propertyId = urlParams.get('id') || '';
const AGENCY_EMAIL = 'contacto@jonathanbosch4164@gmail.com'; // ← pon aquí tu correo real

// Estado
let currentProperty = null;
let currentImageIndex = 0;
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]').map(String);
let isGalleryOpen = false;

// Datos
const propertiesData = Array.isArray(window.PROPERTIES_DATA) ? window.PROPERTIES_DATA : [];

// Init
document.addEventListener('DOMContentLoaded', async function () {
    if (!(window.PROPERTIES_DATA && window.PROPERTIES_DATA.length)) {
        await (window.PROPERTIES_READY || Promise.resolve());
    }
    loadPropertyData();
    updateFavoriteButton();
    initNavigation();

    // Reconstruye la galería si cambiamos de móvil↔desktop
    try {
        const mqDesktop = window.matchMedia('(min-width: 1024px)');
        mqDesktop.addEventListener ?
            mqDesktop.addEventListener('change', () => { if (currentProperty) loadGallery(); }) :
            mqDesktop.addListener && mqDesktop.addListener(() => { if (currentProperty) loadGallery(); });
    } catch (_) { /* fallback silencioso */ }
});

// ----------------------------
//   CARGA PRINCIPAL
// ----------------------------
function loadPropertyData() {
    currentProperty = (Array.isArray(window.PROPERTIES_DATA) ? window.PROPERTIES_DATA : []).find(p => String(p.id) === String(propertyId));

    if (!currentProperty) {
        showNotification('Propiedad no encontrada', 'error');
        setTimeout(() => (window.location.href = 'catalogo.html'), 1500);
        return;
    }

    // Título / breadcrumb
    document.title = `${currentProperty.title} - House Masters Medellin`;
    const bc = document.getElementById('breadcrumbTitle');
    if (bc) bc.textContent = currentProperty.title;


    // Galería
    loadGallery();

    // Detalles
    loadPropertyDetails();

    // WhatsApp (botón principal)
    updateWhatsAppLink();

    // Correo (boton principal)
    updateEmailLink();

    // Similares (tarjeta independiente a todo el ancho)
    setTimeout(loadSimilarProperties, 300);
}

function buildHeaderHTML() {
    const locationText = [currentProperty.address, currentProperty.sector, currentProperty.municipio]
        .filter(Boolean).join(', ') || currentProperty.location;

    return `
            <div class="pp-header-row">
            <div class="pp-header-left">
                <h1 class="pp-title">${currentProperty.title}</h1>
                <div class="pp-location"><i class="fas fa-map-marker-alt" style="margin-right:0.6%"></i> ${locationText}</div>

                <!-- PRECIO AHORA VA DEBAJO DE LA UBICACIÓN -->
                <div id="ppPrice"
                    class="pp-price"
                    data-price="${currentProperty.price}"
                    data-transaction="${currentProperty.transaction}">
                ${formatPrice(currentProperty.price, currentProperty.transaction)}
                </div>
            </div>

            <!-- EN LA COLUMNA DERECHA: CTA "VER MAPA" A TODA ALTURA -->
            <div class="pp-header-right">
                <button class="pp-map-cta" onclick="openMapModal()" title="Ver ubicacion">
                <i class="fas fa-map-marked-alt" aria-hidden="true"></i>Ver ubicacion en el mapa
                </button>
            </div>
            </div>`;
}

// Devuelve la galería unificada (image/video); back-compat si no existe
function getGallery() {
    const g = currentProperty?.gallery;
    if (Array.isArray(g) && g.length) return g;
    const imgs = (currentProperty?.images || []).map(src => ({ type: 'image', src }));
    return imgs.length ? imgs : (currentProperty?.image ? [{ type: 'image', src: currentProperty.image }] : []);
}

function renderInto(el, item, opts = {}) {
    if (!el || !item) return;
    // Si había un <video> renderizado previamente, páralo y descárgalo
    try {
        const prevVid = el.querySelector && el.querySelector('video');
        if (prevVid) {
            prevVid.pause();
            prevVid.currentTime = 0;
            prevVid.removeAttribute('src');
            prevVid.load();
        }
    } catch (_) { }
    el.innerHTML = '';
    if (item.type === 'video') {
        const v = document.createElement('video');
        v.src = item.src;
        v.playsInline = true;
        if (opts.context === 'hero') { v.muted = true; v.autoplay = true; v.loop = true; v.controls = false; }
        if (opts.context === 'modal') { v.controls = true; v.autoplay = true; }
        v.style.width = '100%';
        v.style.height = '100%';
        v.style.objectFit = (opts.objectFit || 'cover');
        el.appendChild(v);
    } else {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = currentProperty?.title || '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = (opts.objectFit || 'cover');
        el.appendChild(img);
    }
}

function loadGallery() {
    const gallery = getGallery();

    currentImageIndex = 0;

    // Venta/Arriendo (tu badge actual)
    const isRent = /^(arriendo|renta|alquiler)$/i.test(currentProperty.transaction || '');
    const badgeCls = isRent ? 'renta' : 'venta';
    const badgeTxt = isRent ? 'Arriendo' : 'Venta';
    const badgeHTML = `<div class="pp-badge ${badgeCls}">${badgeTxt}</div>`;

    // ¿Usamos layout grid (desktop) o hero simple (mobile)?
    const useGrid = window.matchMedia('(min-width: 1024px)').matches;

    // Miniaturas (desktop)
    let thumbsHTML = '';
    if (useGrid) {
        const thumbs = gallery.slice(1, 4); // 3 miniaturas
        const extraCount = Math.max(0, gallery.length - 4);

        thumbsHTML = thumbs.map((item, i) => `
          <div class="pp-thumb-wrap" role="button" aria-label="Abrir galería"
               onclick="openGalleryModal(${i + 1})">
            ${item.type === 'video'
                ? `<video class="pp-thumb" src="${item.src}" muted playsinline></video>
                 <span class="pp-more-count" style="pointer-events:none">▶</span>`
                : `<img class="pp-thumb" src="${item.src}" alt="${currentProperty.title} - ${i + 2}">`}
          </div>
        `).join('');


        // Tile "ver galería": usar la imagen que SIGUE a las 3 miniaturas (índice 4 si existe)
        const nextIndex = (gallery.length > 4) ? 4 : (gallery.length - 1);
        const moreBg = gallery[nextIndex]?.src;
        thumbsHTML += `
        <button class="pp-more"
                style="--more-bg: url('${moreBg || ''}')"
                onclick="openGalleryModal(0)"   /* abrir SIEMPRE desde la primera */
                aria-label="Abrir galería">
            <span class="pp-more-count">+${Math.max(0, gallery.length - 4)}</span>
            <span class="pp-more-btn"><i class="fas fa-expand"></i> ver galería</span>
        </button>
        `;


    }

    const heroClass = useGrid ? 'pp-hero grid' : 'pp-hero';

    const html = `
    <div class="${heroClass}">
      ${badgeHTML}

      <div class="pp-actions">
        <button id="shareBtn" class="pp-iconbtn" title="Compartir" onclick="shareProperty()">
          <i class="fas fa-share-alt"></i>
        </button>
        <button id="favoriteBtn" class="pp-iconbtn heart" title="Favorito" onclick="toggleFavorite()">
          <i class="${favorites.includes(propertyId) ? 'fas' : 'far'} fa-heart"></i>
        </button>
      </div>

      <!-- COLUMNA PRINCIPAL -->
      <div class="pp-main">
        <button class="pp-nav prev" aria-label="Anterior" onclick="previousImage()">
          <i class="fas fa-chevron-left"></i>
        </button>

        <div id="heroHost" style="width:100%;height:100%"></div>

        <button class="pp-nav next" aria-label="Siguiente" onclick="nextImage()">
          <i class="fas fa-chevron-right"></i>
        </button>

        <div class="pp-counter" id="heroCounter">1 / ${gallery.length}</div>
      </div>

      <!-- COLUMNA DE MINIATURAS (solo desktop) -->
      ${useGrid ? `<div class="pp-thumbs">${thumbsHTML}</div>` : ''}

    </div>

    ${buildHeaderHTML()}
  `;

    const container = document.getElementById('galleryContainer');
    container.classList.add('pp-fullbleed');
    container.innerHTML = html;

    // pintar primer item (img o video) en el hero
    const heroHost = document.getElementById('heroHost');
    renderInto(heroHost, gallery[0], { context: 'hero', objectFit: 'cover' });
    if (heroHost && typeof openGalleryModal === 'function') {
        heroHost.style.cursor = 'pointer';
        heroHost.addEventListener('click', () => openGalleryModal(currentImageIndex));
    }

    updateFavoriteButton();
    updateWhatsAppLink();
}




// eliminar la card de acciones si existe
(function () {
    const el = document.querySelector('.property-actions');
    if (el) el.remove();
})();


// Actualiza imagen/counter del hero (y del modal si existe)
function setImageByIndex(idx) {
    const gal = getGallery();
    if (!gal.length) return;
    const n = gal.length;
    currentImageIndex = (idx % n + n) % n;
    const counter = document.getElementById('heroCounter');
    if (counter) counter.textContent = `${currentImageIndex + 1} / ${n}`;
    // hero (si modal no está abierto)
    if (!isGalleryOpen) {
        const host = document.getElementById('heroHost');
        renderInto(host, gal[currentImageIndex], { context: 'hero', objectFit: 'cover' });
    }
    // sincroniza modal (si está abierto)
    syncModal();
}

function nextImage() { setImageByIndex(currentImageIndex + 1); }
function previousImage() { setImageByIndex(currentImageIndex - 1); }



// Primera letra mayúscula del valor "tipo de inmueble"
function capitalizeFirst(str) {
    if (!str) return '';
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function loadPropertyDetails() {
    const p = currentProperty;

    const features = [];

    // Solo agregue si es > 0
    const beds = Number(p.bedrooms);
    if (beds > 0) {
        features.push({ icon: "fas fa-bed", title: `${beds} Habitaciones`, description: "Numero de habitaciones" });
    }

    const baths = Number(p.bathrooms);
    if (baths > 0) {
        features.push({ icon: "fas fa-bath", title: `${baths} Baños`, description: "Numero de baños" });
    }

    const area = Number(p.area);
    if (area > 0) {
        features.push({ icon: "fas fa-ruler-combined", title: `${area} m²`, description: "Área construida" });
    }

    // Siempre puede mostrarse (texto)
    features.push({ icon: "fas fa-house", title: `${capitalizeFirst(p.type)}`, description: "Tipo de inmueble" });

    const stratum = Number(p.stratum);
    if (stratum > 0) {
        features.push({ icon: "fas fa-layer-group", title: `Estrato ${stratum}`, description: "Estrato" });
    }

    // Parqueadero
    features.push({ icon: "fas fa-car", title: p.parking ? "Sí" : "No", description: "Parqueadero" });



    // Render
    let featuresHTML = '';
    features.forEach(f => {
        featuresHTML += `
      <div class="feature-item">
        <i class="${f.icon} feature-icon"></i>
        <div><strong>${f.title}</strong><br><small>${f.description}</small></div>
      </div>`;
    });

    const extras = Array.isArray(p.caracteristicasAdicionales)
        ? p.caracteristicasAdicionales
        : (Array.isArray(p.additionalFeatures) ? p.additionalFeatures : []);

    const extrasHTML = (extras && extras.length)
        ? extras.map(txt => `
        <li class="extras-item">
          <span class="extras-icon"><i class="fas fa-check"></i></span>
          <span class="extras-text">${txt}</span>
        </li>`).join('')
        : `<p class="no-extras">No registra características adicionales</p>`;

    const detailsHTML = `
    <h2 class="section-title">Características</h2>
    <div class="features-grid">${featuresHTML}</div>

    <h3 class="section-title">Descripción</h3>
    <div class="description"><p>${p.description}</p></div>

    <h3 class="section-title">Información Adicional</h3>
    <ul class="extras-list">${extrasHTML}</ul>
  `;

    document.getElementById('propertyDetails').innerHTML = detailsHTML;
}

// ----------------------------
//   SIMILARES (tarjeta aparte)
// ----------------------------
function loadSimilarProperties() {
    if (!Array.isArray(window.PROPERTIES_DATA)) return;

    const similar = window.PROPERTIES_DATA
        .filter(p => p.id !== currentProperty.id && (p.type === currentProperty.type || p.location === currentProperty.location))
        .slice(0, 3);

    if (!similar.length) return;

    const container = document.getElementById('similarContainer');
    if (!container) return;

    let html = `
            <h3 class="section-title">Propiedades Similares</h3>
            <div class="similar-grid">
            `;

    similar.forEach(p => {
        html += `
            <div class="property-card" onclick="window.location.href='propiedad.html?id=${p.id}'"
                 style="cursor:pointer;background:#fff;border-radius:15px;overflow:hidden;box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <div style="position:relative;">
                <img src="${p.image}" alt="${p.title}" style="width:100%;height:150px;object-fit:cover;display:block;">
                <span class="pp-badge ${/^(arriendo|renta|alquiler)$/i.test(p.transaction || '') ? 'renta' : 'venta'}">
                    ${/^(arriendo|renta|alquiler)$/i.test(p.transaction || '') ? 'Arriendo' : 'Venta'}
                </span>
                </div>
                <div style="padding:15px;">
                    <div style="font-weight:600;color:#193A8A;margin-bottom:5px;"data-price="${p.price}"
                        data-transaction="${p.transaction}">
                    ${formatPrice(p.price, p.transaction)}
                    </div>
                    <div style="font-size:14px;color:#333;margin-bottom:5px;">${p.title}</div>
                    <div style="font-size:12px;color:#666;"><i class="fas fa-map-marker-alt"></i> ${p.location}</div>
                </div>
            </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
    container.style.display = 'block';
}

// ----------------------------
//   WHATSAPP / COMPARTIR
// ----------------------------
function updateWhatsAppLink() {
    const msg = `Hola, estoy interesado en la propiedad: ${currentProperty.title} - ${currentProperty.location}. Precio: ${Currency.format(currentProperty.price)}`;
    const url = `https://wa.me/573145069405?text=${encodeURIComponent(msg)}`;

    const side = document.getElementById('whatsappLink');     // botón del sidebar (ya existente)
    const head = document.getElementById('whatsappBtnMain');  // botón nuevo bajo el hero
    if (side) side.href = url;
    if (head) head.href = url;
}

function updateEmailLink() {
    const el = document.getElementById('emailLink');
    if (!el || !currentProperty) return;
    const fullAddress = [currentProperty.address, currentProperty.sector, currentProperty.municipio]
        .filter(Boolean).join(', ') || (currentProperty.location || '');
    const subject = `Consulta sobre: ${currentProperty.title}`;
    const body = `Hola, me interesa la propiedad "${currentProperty.title}" en ${fullAddress}.
                        Precio: ${Currency.format(currentProperty.price)}
                        Enlace: ${window.location.href}`;
    el.href = `mailto:${AGENCY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


// ----------------------------
//   GALERÍA
// ----------------------------
function imagesArray() { return getGallery().map(x => x.src); }

function openGalleryModal(index = currentImageIndex || 0) {
    currentImageIndex = index;
    isGalleryOpen = true;
    const modal = document.getElementById('galleryModal');
    modal.style.display = 'block';
    syncModal();
    document.addEventListener('keydown', modalKeyHandler);
}

function closeGalleryModal() {
    const modal = document.getElementById('galleryModal');
    // Detén y descarga cualquier <video> dentro del modal
    try {
        const host = document.getElementById('modalMedia');
        if (host) {
            host.querySelectorAll('video').forEach(v => {
                v.pause();
                v.currentTime = 0;
                v.removeAttribute('src');
                v.load();
            });
            // Limpia el contenedor para evitar que el navegador mantenga decodificadores activos
            host.innerHTML = '';
        }
    } catch (_) { }
    modal.style.display = 'none';
    document.removeEventListener('keydown', modalKeyHandler);
    isGalleryOpen = false;
}

/* ---- Navegación exclusiva del modal ---- */
function setModalImageByIndex(idx) {
    const gal = getGallery();
    if (!gal.length) return;
    const n = gal.length;
    currentImageIndex = (idx % n + n) % n;
    const host = document.getElementById('modalMedia');
    renderInto(host, gal[currentImageIndex], { context: 'modal', objectFit: 'contain' });
    const counter = document.getElementById('modalCounter');
    if (counter) counter.textContent = `${currentImageIndex + 1} / ${n}`;
}

function nextModalImage() { setModalImageByIndex(currentImageIndex + 1); }

function previousModalImage() { setModalImageByIndex(currentImageIndex - 1); }

function modalKeyHandler(e) {
    if (e.key === 'ArrowRight') nextModalImage();
    else if (e.key === 'ArrowLeft') previousModalImage();
    else if (e.key === 'Escape') closeGalleryModal();
}

function syncModal() {
    const gal = getGallery();
    const host = document.getElementById('modalMedia');
    renderInto(host, gal[currentImageIndex], { context: 'modal', objectFit: 'contain' });
    const counter = document.getElementById('modalCounter');
    if (counter) counter.textContent = `${currentImageIndex + 1} / ${gal.length}`;
}


// ----------------------------
//   FAVORITO
// ----------------------------
function updateFavoriteButton() {
    const btn = document.getElementById('favoriteBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (favorites.includes(propertyId)) {
        icon.className = 'fas fa-heart'; btn.style.color = '#FF0000';
    } else {
        icon.className = 'far fa-heart'; btn.style.color = '#4a5568';
    }
}

function toggleFavorite() {
    const pid = String(propertyId);
    const btn = document.getElementById('favoriteBtn');
    const icon = btn ? btn.querySelector('i') : null;

    if (favorites.includes(pid)) {
        // Quitar de favoritos
        favorites = favorites.filter(id => id !== pid);
        if (icon) {
            icon.className = 'far fa-heart';
            btn.style.color = '#4a5568';
        }
        showNotification('Eliminado de favoritos', 'error');   // ← ROJO
    } else {
        // Agregar a favoritos
        favorites.push(pid);
        if (icon) {
            icon.className = 'fas fa-heart';
            btn.style.color = '#FF0000';
        }
        showNotification('Agregado a favoritos', 'success');    // ← VERDE
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));
}



// ----------------------------
//   UTILIDADES
// ----------------------------
function showNotification(message, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = message;
    n.style.cssText = `
    position:fixed;top:20px;right:20px;
    color:#fff;
    padding:12px 20px;border-radius:8px;
    z-index:9999;
    animation:slideIn .3s ease;
    box-shadow:0 10px 25px rgba(0,0,0,.2)
  `;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.animation = 'slideOut .3s ease';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// ----------------------------
//   MAPA
// ----------------------------
function getFullAddress() {
    // Usa los campos atómicos si existen; si no, cae a location
    return [currentProperty.address, currentProperty.sector, currentProperty.municipio]
        .filter(Boolean).join(', ') || currentProperty.location || '';
}

function openMapModal() {
    const addr = getFullAddress();
    if (!addr) return;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(addr)}&hl=es&z=16&output=embed`;
    const frame = document.getElementById('mapFrame');
    frame.src = url;
    document.getElementById('mapModal').style.display = 'block';
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'none';
    // Limpia el src para que deje de cargar cuando se cierre
    const frame = document.getElementById('mapFrame');
    if (frame) frame.src = '';
}


// Cerrar modales al hacer click fuera
window.onclick = function (event) {
    const galleryModal = document.getElementById('galleryModal');
    const contactModal = document.getElementById('contactFormModal');
    const mapModal = document.getElementById('mapModal');

    if (event.target === galleryModal) closeGalleryModal();
    if (event.target === contactModal) contactModal.style.display = 'none';
    if (event.target === mapModal) closeMapModal();
};


// Navegación con teclado en galería
document.addEventListener('keydown', function (e) {
    const galleryModal = document.getElementById('galleryModal');
    if (galleryModal && galleryModal.style.display === 'block') {
        if (e.key === 'ArrowRight') nextImage();
        else if (e.key === 'ArrowLeft') previousImage();
        else if (e.key === 'Escape') closeGalleryModal();
    }
});

function shareProperty() {
    const title = currentProperty?.title || 'Propiedad';
    const price = (typeof Currency !== 'undefined' && currentProperty?.price != null)
        ? Currency.format(currentProperty.price)
        : '';
    const location = currentProperty?.location ? ` - ${currentProperty.location}` : '';
    const url = window.location.href.split('#')[0];
    const text = `${title}${location}${price ? ` | ${price}` : ''}`;

    if (navigator.share) {
        navigator.share({ title, text, url }).catch(() => { /* usuario canceló */ });
        return;
    }

    // Fallback: copiar enlace al portapapeles
    const toCopy = `${title}${location}\n${url}`;
    const copy = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(toCopy);
                alert('Enlace copiado al portapapeles');
            } else {
                const ta = document.createElement('textarea');
                ta.value = toCopy; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
                alert('Enlace copiado al portapapeles');
            }
        } catch (_) {
            prompt('Copia este enlace:', url);
        }
    };
    copy();
}

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
    const el = document.getElementById('ppPrice');
    if (el) {
        const base = Number(el.dataset.price) || 0;
        const tx = el.dataset.transaction || '';
        el.textContent = formatPrice(base, tx);
    }
});