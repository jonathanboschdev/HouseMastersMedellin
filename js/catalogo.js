// Get properties data from the global object or local storage
let propertiesData = [];

let filteredProperties = []; let currentView = 'grid';
let currentPage = 1;
const itemsPerPage = 6;


// Favorites
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]').map(String);

// === Normalization & alias helpers (hardened filters) ===
const KNOWN_LOCATIONS = [
    'el poblado', 'envigado', 'belen', 'itagui', 'laureles', 'sabaneta', 'bello', 'rionegro', 'el retiro'
];

const TYPE_EQUIV = {
    'local comercial': 'local',
    'aparta estudio': 'apartaestudio',
    'aparta-estudio': 'apartaestudio',
    'apartaestudio': 'apartaestudio',
    'apto': 'apartamento',
    'finca': 'finca',
    'finca campestre': 'finca',
    'campestre': 'finca',
    'hacienda': 'finca',
    'piso comercial': 'piso_comercial',
    'piso_comercial': 'piso_comercial'
};

function norm(s) {
    return (s ?? '').toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .toLowerCase().trim();
}

function canonType(s) {
    const t = norm(s);
    return TYPE_EQUIV[t] || t;
}

function canonLocationValue(s) {
    return norm(s);
}

function propertyHasLocation(property, filterLoc) {
    if (!filterLoc) return true;
    // 1) Normaliza, elimina artículos ("el/la/los/las","de/del")
    //    y soporta valores compuestos con guion como "laureles-estadio"
    const base = norm(filterLoc)
        .replace(/^(el|la|los|las)\s+/, '')
        .replace(/^(de|del)\s+/, '');
    // queries: si viene "laureles-estadio" => ["laureles", "estadio"]; si no, queda un solo término
    const queries = base.split(/\s*-\s*/).filter(Boolean).map(s => s.replace(/-/g, ' '));

    // 2) Compara contra municipio y sector (campos ya separados que trae db.js)
    const sec = norm(property.sector || '').replace(/-/g, ' ');
    const municipio = norm(property.municipio || '').replace(/-/g, ' ');
    // Si alguna query coincide con sector o municipio, aceptar
    if (queries.some(q => sec === q || municipio === q)) return true;
    if (queries.some(q => sec.includes(q) || municipio.includes(q))) return true; // tolera "poblado", etc.

    // 3) Fallback: compara contra el string completo "Poblado, Medellin"
    const pLoc = norm(property.location || '').replace(/-/g, ' '); // "poblado medellin"
    if (queries.some(q => pLoc.includes(q))) return true;
    const parts = pLoc.replace(/[.,-]/g, ' ').split(/\s+/).filter(Boolean);
    const tokens = parts.slice();
    for (let i = 0; i < parts.length - 1; i++) tokens.push(parts[i] + ' ' + parts[i + 1]);
    return queries.some(q => tokens.includes(q));
}


// Initialization
document.addEventListener('DOMContentLoaded', async function () {
    if (!(window.PROPERTIES_DATA && window.PROPERTIES_DATA.length)) {
        await (window.PROPERTIES_READY || Promise.resolve());
    }
    propertiesData = Array.isArray(window.PROPERTIES_DATA) ? window.PROPERTIES_DATA : [];
    filteredProperties = propertiesData.filter(p => p.status === 'available');
    applyQueryParams();
    renderProperties();
    renderPagination();
    initAnimations();
    initFilterListeners();
});

function applyQueryParams() {

    const params = new URLSearchParams(window.location.search);
    if (!params || [...params.keys()].length === 0) return;

    const type = params.get('type') || '';
    const transaction = params.get('transaction') || '';
    const location = (params.get('location') || '').toLowerCase();
    const budget = params.get('budget') || '';
    const auto = params.get('autosearch') === '1';

    const typeEl = document.getElementById('propertyType');
    const transEl = document.getElementById('transactionType');
    const locEl = document.getElementById('location');
    const maxPriceEl = document.getElementById('maxPrice');

    if (typeEl && type) typeEl.value = type;
    if (transEl && transaction) transEl.value = transaction;
    if (locEl && location) locEl.value = location;
    if (maxPriceEl && budget) {
        // Parse budget range
        if (budget.includes('-')) {
            const [min, max] = budget.split('-');
            if (max && max !== '99999999999') {
                maxPriceEl.value = max;
            }
            if (min && min !== '0') {
                document.getElementById('minPrice').value = min;
            }
        }
    }

    // Aplica automáticamente SOLO si venimos desde "Tipos" (autosearch=1)
    if (auto && (type || transaction || location || budget)) {
        // Pequeño diferido para asegurar que el DOM esté listo
        setTimeout(applyFilters, 0);
        // (Opcional) limpiar la bandera de la URL para que recargas no re-busquen
        try {
            const clean = new URL(window.location.href);
            clean.searchParams.delete('autosearch');
            history.replaceState({}, '', clean.toString());
        } catch (_) { /* no-op */ }
    }
}

function renderProperties() {
    const grid = document.getElementById('propertiesGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageProperties = filteredProperties.slice(start, end);

    grid.innerHTML = '';

    if (pageProperties.length === 0) {
        grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <i class="fas fa-home" style="font-size: 4rem; color: #ccc; margin-bottom: 20px;"></i>
                        <h3>No se encontraron propiedades</h3>
                        <p>Intenta ajustar los filtros de búsqueda</p>
                    </div>
                `;
    } else {
        pageProperties.forEach((property, index) => {
            const card = createPropertyCard(property);
            card.style.animationDelay = `${index * 0.1}s`;
            grid.appendChild(card);
        });
    }

    document.getElementById('resultsCount').textContent = filteredProperties.length;
}

function createPropertyCard(property) {
    const card = document.createElement('div');
    card.className = 'property-card stagger-animation';

    const isAvailable = (property.status || '').toLowerCase() === 'available';
    const isRent = (property.transaction || '').toLowerCase() === 'arriendo';

    const statusClass = isAvailable
        ? (isRent ? 'status-rent' : 'status-sale')  // naranja vs verde
        : 'status-sold';                            // rojo si no está disponible

    const statusText = isRent ? 'Arriendo' : 'Venta';

    card.innerHTML = `
                <div class="property-image">
                    <img src="${property.image}" alt="${property.title}">
                    <div class="property-status ${statusClass}">
                        ${statusText}
                    </div>
                    <button
                    class="property-favorite ${favorites.includes(String(property.id)) ? 'is-fav' : ''}"
                    type="button"
                    data-id="${property.id}"
                    onclick="toggleFavorite(event, '${property.id}')"
                    aria-pressed="${favorites.includes(String(property.id))}">
                    <i class="${favorites.includes(String(property.id)) ? 'fas' : 'far'} fa-heart"></i>
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
                        <i class="fas fa-map-marker-alt"></i>
                        ${property.location}
                    </div>
                    <div class="property-features">
                        ${property.bedrooms > 0 ? `
                        <div class="feature">
                            <i class="fas fa-bed feature-icon"></i>
                            ${property.bedrooms} hab
                        </div>` : ''}
                        ${Number(property.bathrooms) > 0 ? `
                        <div class="feature">
                            <i class="fas fa-bath feature-icon"></i>
                            ${property.bathrooms} baños
                        </div>` : ''}
                        <div class="feature">
                            <i class="fas fa-ruler-combined feature-icon"></i>
                            ${property.area} m²
                        </div>
                    </div>
                    <div class="property-actions">
                        <button class="action-btn" onclick="viewProperty('${property.id}')">
                            <i class="fas fa-eye"></i>
                            Ver Detalles
                        </button>
                        <button class="action-btn whatsapp-btn" onclick="contactWhatsApp('${property.id}')">
                            <i class="fab fa-whatsapp"></i>
                            WhatsApp
                        </button>
                        <button class="action-btn" onclick="shareProperty('${property.id}')">
                            <i class="fas fa-share"></i>
                            Compartir
                        </button>
                    </div>
</div>
                </div>
            `;

    card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            viewProperty(property.id);
        }
    });

    return card;
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);

    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prevBtn);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => changePage(i);
            pagination.appendChild(pageBtn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 10px';
            pagination.appendChild(dots);
        }
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    pagination.appendChild(nextBtn);
}

function changePage(page) {
    currentPage = page;
    renderProperties();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Filter functions
function applyFilters() {
    showLoading();

    setTimeout(() => {
        const rawType = document.getElementById('propertyType').value;
        const rawTransaction = document.getElementById('transactionType').value;
        const rawLocation = document.getElementById('location').value;
        const rawBedrooms = document.getElementById('bedrooms').value;
        const rawBathrooms = document.getElementById('bathrooms').value;
        const rawStratum = document.getElementById('stratum').value;

        const filters = {
            type: canonType(rawType),
            transaction: norm(rawTransaction),
            location: canonLocationValue(rawLocation),
            bedrooms: rawBedrooms,
            bathrooms: rawBathrooms,
            stratum: rawStratum,
            minPrice: (window.Currency && Currency.toCOP) ? Currency.toCOP(parseFloat(document.getElementById('minPrice').value) || 0) : (parseFloat(document.getElementById('minPrice').value) || 0),
            maxPrice: (window.Currency && Currency.toCOP) ? Currency.toCOP((document.getElementById('maxPrice').value ? parseFloat(document.getElementById('maxPrice').value) : Infinity)) : ((document.getElementById('maxPrice').value ? parseFloat(document.getElementById('maxPrice').value) : Infinity)),
            minArea: parseInt(document.getElementById('minArea').value) || 0,
            maxArea: parseInt(document.getElementById('maxArea').value) || Infinity
        };

        filteredProperties = propertiesData.filter(property => {
            const pStatus = norm(property.status);
            const pType = canonType(property.type);
            const pTrans = norm(property.transaction);
            const pStratum = (property.stratum ?? '').toString();
            const pBedrooms = Number(property.bedrooms || 0);
            const pBathrooms = Number(property.bathrooms || 0);
            const pPrice = Number(property.price || 0);
            const pArea = Number(property.area || 0);

            return (
                pStatus === 'available' &&
                (!filters.type || pType === filters.type) &&
                (!filters.transaction || pTrans === filters.transaction) &&
                propertyHasLocation(property, filters.location) &&
                (!filters.bedrooms || pBedrooms === Number(filters.bedrooms) || (filters.bedrooms === '4' && pBedrooms >= 4)) &&
                (!filters.bathrooms || pBathrooms === Number(filters.bathrooms) || (filters.bathrooms === '3' && pBathrooms >= 3)) &&
                (!filters.stratum || pStratum === filters.stratum) &&
                (pPrice >= filters.minPrice && pPrice <= filters.maxPrice) &&
                (pArea >= filters.minArea && pArea <= filters.maxArea)
            );
        });

        currentPage = 1;
        hideLoading();
        renderProperties();
        renderPagination();

        showNotification(`${filteredProperties.length} propiedades encontradas`, 'success');
    }, 800);
}

function clearFilters() {
    document.getElementById('propertyType').value = '';
    document.getElementById('transactionType').value = '';
    document.getElementById('location').value = '';
    document.getElementById('bedrooms').value = '';
    document.getElementById('bathrooms').value = '';
    document.getElementById('stratum').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('minArea').value = '';
    document.getElementById('maxArea').value = '';

    filteredProperties = propertiesData.filter(p => p.status === 'available');
    currentPage = 1;
    renderProperties();
    renderPagination();

    showNotification('Filtros limpiados', 'info');
}

function sortProperties() {
    const sortBy = document.getElementById('sortBy').value;

    filteredProperties.sort((a, b) => {
        switch (sortBy) {
            case 'price-low':
                return a.price - b.price;
            case 'price-high':
                return b.price - a.price;
            case 'area':
                return b.area - a.area;
            case 'recent':
            default:
                return b.year - a.year;
        }
    });

    currentPage = 1;
    renderProperties();
    renderPagination();
}

// View functions
function toggleView(view) {
    currentView = view;

    const gridBtn = document.getElementById('gridViewBtn');
    const mapBtn = document.getElementById('mapViewBtn');
    const propertiesGrid = document.getElementById('propertiesGrid');
    const mapContainer = document.getElementById('mapContainer');
    const pagination = document.getElementById('pagination');

    if (view === 'grid') {
        gridBtn.classList.add('active');
        mapBtn.classList.remove('active');
        propertiesGrid.style.display = 'grid';
        mapContainer.classList.remove('active');
        pagination.style.display = 'flex';
    } else {
        mapBtn.classList.add('active');
        gridBtn.classList.remove('active');
        propertiesGrid.style.display = 'none';
        mapContainer.classList.add('active');
        pagination.style.display = 'none';
    }
}

function toggleFilters() {
    const filtersGrid = document.getElementById('filtersGrid');
    filtersGrid.classList.toggle('show');
}

// Interaction functions
function toggleFavorite(ev, propertyId) {
    if (arguments.length > 1 && typeof propertyId !== "undefined") propertyId = String(propertyId);
    propertyId = String(propertyId);
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }

    let added;
    const idx = favorites.indexOf(String(String(propertyId)));
    if (idx >= 0) {
        favorites.splice(idx, 1);
        added = false;
        showNotification('Eliminado de favoritos', 'error');   // ← rojo
    } else {
        favorites.push(String(String(propertyId)));
        added = true;
        showNotification('Agregado a favoritos', 'success');    // ← verde
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));

    // Actualiza solo el botón pulsado (sin re-render)
    const btn = document.querySelector(`.property-favorite[data-id="${propertyId}"]`);
    if (btn) {
        btn.classList.toggle('is-fav', added);
        btn.setAttribute('aria-pressed', String(added));
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fas', added);
            icon.classList.toggle('far', !added);
        }
    }
}

function viewProperty(propertyId) {
    showNotification('Redirigiendo a la ficha de la propiedad...', 'info');
    window.location.href = `propiedad.html?id=${propertyId}`;
}

function contactWhatsApp(propertyId) {
    const property = propertiesData.find(p => String(p.id) === String(propertyId));
    if (!property) return;

    const message = `Hola, estoy interesado en la propiedad: ${property.title} - ${property.location}`;
    const whatsappUrl = `https://wa.me/573145069405?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function shareProperty(propertyId) {
    const property = propertiesData.find(p => String(p.id) === String(propertyId));
    if (!property) return;

    if (navigator.share) {
        navigator.share({
            title: property.title,
            text: `${property.title} - ${property.location}`,
            url: `propiedad.html?id=${propertyId}`
        });
    } else {
        const url = `${window.location.origin}/propiedad.html?id=${propertyId}`;
        navigator.clipboard.writeText(url);
        showNotification('Enlace copiado al portapapeles', 'info');
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('propertiesGrid').style.opacity = '0.5';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('propertiesGrid').style.opacity = '1';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}


function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.stagger-animation').forEach(el => {
        observer.observe(el);
    });
}

function initFilterListeners() {
    // Auto-apply filters while typing
    /*     const filterInputs = document.querySelectorAll('.filter-input');
        filterInputs.forEach(input => {
            let timeout;
            input.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(applyFilters, 1000);
            });
        }); */

    // Sin auto-aplicado. Solo aplicamos cuando el usuario pulsa "Buscar" o Enter.
    const filterInputs = document.querySelectorAll('.filter-input');
    filterInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyFilters();   // acción explícita del usuario
            }
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && currentPage > 1) {
            changePage(currentPage - 1);
        } else if (e.key === 'ArrowRight') {
            const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
            if (currentPage < totalPages) {
                changePage(currentPage + 1);
            }
        }
    });
}

// Responsive: Close filters when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const filtersGrid = document.getElementById('filtersGrid');
        const toggleBtn = e.target.closest('.toggle-filters');
        const filtersContainer = e.target.closest('.filters-container');

        if (!toggleBtn && !filtersContainer && filtersGrid.classList.contains('show')) {
            filtersGrid.classList.remove('show');
        }
    }
});

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initial render
    renderProperties();
    renderPagination();
    initAnimations();
    initFilterListeners();
    initNavigation();
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

// Format price function - esta función debe existir
function formatPrice(price, transaction) {
    if (window.Currency && window.Currency.format) {
        return window.Currency.format(price);
    } else {
        // Fallback formatting
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }
}

// Actualiza el rótulo del rango de precios según la moneda seleccionada (EUR, USD, COP)
document.addEventListener('DOMContentLoaded', function () {
    try {
        var min = document.getElementById('minPrice');
        if (!min) return;
        var group = min.closest('.filter-group');
        if (!group) return;
        var label = group.querySelector('.filter-label');
        if (!label) return;
        var code = (window.Currency && Currency.code) ? Currency.code : 'COP';
        label.textContent = 'Rango de Precio (' + code + ')';
    } catch (e) { /* no-op */ }

});
