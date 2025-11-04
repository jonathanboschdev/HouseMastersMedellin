// Global properties data - SHARED ACROSS ALL PAGES
window.PROPERTIES_DATA = window.PROPERTIES_DATA || [];

// Initialization
document.addEventListener('DOMContentLoaded', async function () {
    if (!(window.PROPERTIES_DATA && window.PROPERTIES_DATA.length)) {
        await (window.PROPERTIES_READY || Promise.resolve());
    }
    initNavigation();
    initCounters();
    renderFeaturedProperties();
    renderPropertyTypesSection();
    initScrollAnimations();
    initForms();
    initSmoothScroll();
    initHeaderScroll();
    initNavActive();        // ← activa la pestaña correcta (Inicio/Nosotros/Contacto)

    // Si ya venimos con #hash, re-scrollea cuando el contenido termine de pintarse
    document.addEventListener('home:content-ready', scrollToCurrentHash, { passive: true });
    // Y también si el hash cambia
    window.addEventListener('hashchange', scrollToCurrentHash, { passive: true });
    // Primer intento (por si el contenido ya estuviera)
    scrollToCurrentHash();
});

// Re-scrollea a la sección indicada por location.hash, si existe
function scrollToCurrentHash() {
    const hash = (location.hash || '').trim();
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (target) {
        // usa smooth en interacción normal; instantáneo si fue llamado tras render
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function initNavigation() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// Marca activa la opción del menú según hash, clic y scroll
function initNavActive() {
    const nav = document.getElementById('navLinks');
    if (!nav) return;
    const links = nav.querySelectorAll('a[href^="#"]'); // solo anclas internas
    const sections = [...links]
        .map(a => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    function setActive(hash) {
        const h = hash || '#hero';
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === h));
    }

    // Al hacer clic (tu smooth scroll evita cambiar el hash), activamos manualmente
    links.forEach(a => {
        a.addEventListener('click', () => setActive(a.getAttribute('href')));
    });

    // Si el hash cambia por cualquier razón, actualiza
    window.addEventListener('hashchange', () => setActive(location.hash));

    // Con el scroll: activa la sección visible
    /*     if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(ent => {
                    if (ent.isIntersecting) setActive('#' + ent.target.id);
                });
            }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
            sections.forEach(sec => io.observe(sec));
        } */

    // Estado inicial (al entrar con #nosotros/#contacto o sin hash)
    setActive(location.hash || '#hero');
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
}

function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { animateCounter(entry.target); observer.unobserve(entry.target); } });
    });
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(counter) {
    const target = parseInt(counter.getAttribute('data-count'));
    const count = parseInt(counter.textContent);
    const increment = target / 200;
    if (count < target) { counter.textContent = Math.ceil(count + increment); setTimeout(() => animateCounter(counter), 1); }
    else { counter.textContent = target; }
}

/* === Render Tipos de Propiedad === */
function renderPropertyTypesSection() {
    const grid = document.getElementById('typesGrid');
    if (!grid) return;

    // helper normalize accents
    const norm = s => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    const data = Array.isArray(window.PROPERTIES_DATA) ? window.PROPERTIES_DATA : [];

    // Mapas de categorías con sinónimos comúnmente usados en tu DB
    const CATEGORIES = [
        { key: 'Apartamentos', filter: 'apartamento', large: true, img: './img/apartamento.jpg', match: /aparta?mento/i },
        { key: 'Casas', filter: 'casa', large: false, img: './img/casa.jpg', match: /casa(?!\s*comercial)/i },
        { key: 'Bodegas', filter: 'bodega', large: false, img: './img/bodega.jpg', match: /bodega/i },
        { key: 'Fincas', filter: 'finca', large: false, img: './img/finca.jpg', match: /finca/i },
        { key: 'Locales', filter: 'local', large: false, img: './img/local_comercial.jpg', match: /local(?!\s*comercial)/i },
        { key: 'Lotes', filter: 'lote', large: false, img: './img/lote.jpg', match: /lote|terreno/i },
        { key: 'Apartaestudios', filter: 'apartaestudio', large: false, img: './img/apartaestudio.jpg', match: /apartaestudio/i },
        // Nuevo: Pisos Comerciales
        //{ key: 'Pisos Comerciales', filter: 'piso_comercial', large: false, img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=70', match: /piso[\s_]*comercial/i },
    ];

    // Conteos por categoría
    const counts = {};
    for (const cat of CATEGORIES) {
        counts[cat.key] = data.filter(p => {
            const status = norm(p.status);
            if (status !== 'available') return false;
            const t = norm(p.type || p.category || p.propertyType);
            return cat.match.test(t);
        }).length;
    }

    // Construcción de cards
    grid.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const card = document.createElement('article');
        card.className = 'type-card' + (cat.large ? ' type-card--large' : '');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.onclick = () => {
            const params = new URLSearchParams({ type: cat.filter }); // ya en minúscula exacta
            window.location.href = 'catalogo.html?' + params.toString();
        };
        card.onkeypress = (e) => { if (e.key === 'Enter') card.click(); };

        const count = counts[cat.key] || 0;
        card.innerHTML = `
                    <div class="type-bg" style="background-image:url('${cat.img}')"></div>
                    <div class="type-overlay"></div>
                    <div class="type-info">
                        <div class="type-count">${count} Propiedades</div>
                        <div class="type-name">${cat.key}</div>
                    </div>
                    <div class="type-footer"><i class="fa-solid fa-arrow-right"></i> Ver ${cat.key}</div>
                `;
        grid.appendChild(card);
    });
    // Notifica que ya terminó el render de esta sección
    document.dispatchEvent(new Event('home:content-ready'));
}

// Render featured properties
function renderFeaturedProperties() {
    const container = document.getElementById('featuredProperties');
    if (!container) return;
    container.innerHTML = '';
    let featuredProperties = window.PROPERTIES_DATA.filter(p => p.featured && p.status === 'available');
    if (featuredProperties.length === 0) {
        // Fallback: toma las últimas disponibles (máx 6)
        featuredProperties = window.PROPERTIES_DATA
            .filter(p => p.status === 'available')
            .slice(0, 6);
    }
    featuredProperties.forEach((property, index) => {
        const card = createPropertyCard(property);
        card.style.animationDelay = `${index * 0.2}s`;
        card.classList.add('scroll-animate');
        container.appendChild(card);
    });
    // Notifica que ya terminó el render de destacadas
    document.dispatchEvent(new Event('home:content-ready'));
}

function createPropertyCard(property) {
    const card = document.createElement('div');
    const isRent = (property.transaction || '').toLowerCase() === 'arriendo';
    const statusClass = isRent ? 'status-rent' : 'status-sale';
    const statusText = isRent ? 'Arriendo' : 'Venta';
    card.className = 'property-card';
    card.innerHTML = `
                <div class="property-image">
                    <img src="${property.image}" alt="${property.title}" loading="lazy">
                    <div class="property-status ${statusClass}">${statusText}</div>
                    <div class="property-overlay">
                        <button class="overlay-btn" onclick="viewProperty('${property.id}')">
                            <i class="fas fa-eye"></i> Ver Detalles
                        </button>
                        <button class="overlay-btn" onclick="contactWhatsApp('${property.id}')">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                    </div>
                </div>
                <div class="property-info">
                    <div class="property-price"
                        data-price="${property.price}"
                        data-transaction="${property.transaction}">
                    ${formatPrice(property.price, property.transaction)}
                    </div>
                    <div class="property-title">${property.title}</div>
                    <div class="property-location"><i class="fas fa-map-marker-alt"></i> ${property.location}</div>

                    <div class="property-features">
                    ${Number(property.bedrooms) > 0 ? `<div class="feature"><i class="fas fa-bed feature-icon-small"></i>${property.bedrooms} hab</div>` : ''}
                    ${Number(property.bathrooms) > 0 ? `<div class="feature"><i class="fas fa-bath feature-icon-small"></i>${property.bathrooms} baños</div>` : ''}
                    ${Number(property.area) > 0 ? `<div class="feature"><i class="fas fa-ruler-combined feature-icon-small"></i>${property.area} m²</div>` : ''}
                    </div>
                </div>`;
    return card;
}

function viewProperty(propertyId) {
    showNotification('Redirigiendo a la ficha de la propiedad...', 'info');
    window.location.href = `propiedad.html?id=${propertyId}`;
}

function contactWhatsApp(propertyId) {
    const property = window.PROPERTIES_DATA.find(p => String(p.id) === String(propertyId));
    if (!property) return;
    const message = `Hola, estoy interesado en la propiedad: ${property.title} - ${property.location}`;
    const whatsappUrl = `https://wa.me/573145069405?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function initForms() {
    document.getElementById('propertySearchForm')?.addEventListener('submit', function (e) {
        e.preventDefault();
        const searchParams = {
            type: document.getElementById('searchType').value,
            transaction: document.getElementById('searchTransaction').value,
            location: document.getElementById('searchLocation').value,
            budget: document.getElementById('searchBudget').value
        };
        showNotification('Buscando propiedades...', 'info');
        setTimeout(() => {
            showNotification('Redirigiendo al catálogo con tus filtros...', 'info');
            const params = new URLSearchParams();
            Object.keys(searchParams).forEach(key => { if (searchParams[key]) { params.set(key, searchParams[key]); } });
            window.location.href = `catalogo.html?${params.toString()}`;
        }, 1000);
    });

    document.getElementById('contactForm')?.addEventListener('submit', function (e) {
        e.preventDefault();
        showNotification('Enviando mensaje...', 'info');
        setTimeout(() => { showNotification('¡Mensaje enviado! Te contactaremos pronto.', 'success'); this.reset(); }, 2000);
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function initHeaderScroll() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) header.classList.add('scrolled'); else header.classList.remove('scrolled');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = type === 'error' ? 'times' : (type === 'info' ? 'info' : 'check');
    notification.innerHTML = `<i class="fas fa-${icon}-circle"></i> ${message}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInNotification 0.5s ease reverse';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Parallax efecto fondo
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset || 0;
    const hero = document.querySelector('.hero');
    if (hero) hero.style.backgroundPosition = `center ${Math.round(scrolled * 0.4)}px`;
});

// Lazy loading
function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.src; img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    images.forEach(img => imageObserver.observe(img));
}

document.addEventListener('DOMContentLoaded', initLazyLoading);

// === Seamless hero slider (JS marquee, no "jump") ===
(function initHeroMarquee() {
    const track = document.querySelector('.hero-slider .slider-track');
    if (!track) return;
    track.style.animation = 'none'; // disable CSS animation

    // duplicate once if only one set is present (safety)
    if (!track.dataset.duplicated) {
        track.innerHTML += track.innerHTML;
        track.dataset.duplicated = '1';
    }

    let speedPxPerSec = 54; // ~25s per loop (adjust to taste)
    let offsetX = 0, lastTs = 0, loopWidth = 0, gap = 24;

    function measure() {
        const items = track.children;
        const half = Math.floor(items.length / 2);
        const cs = getComputedStyle(track);
        const g = (cs.gap || cs.columnGap || '24px').toString().split(' ')[0];
        gap = parseFloat(g) || 24;
        loopWidth = 0;
        for (let i = 0; i < half; i++) { loopWidth += items[i].offsetWidth; }
        loopWidth += gap * Math.max(0, half - 1);
    }

    function raf(ts) {
        if (!lastTs) lastTs = ts;
        const dt = Math.min(60, ts - lastTs) / 1000;
        lastTs = ts;
        offsetX -= speedPxPerSec * dt;
        if (offsetX <= -loopWidth) offsetX += loopWidth;
        track.style.transform = 'translate3d(' + offsetX + 'px,0,0)';
        requestAnimationFrame(raf);
    }

    measure();
    requestAnimationFrame(raf);
    window.addEventListener('resize', () => { const prev = loopWidth; measure(); if (prev !== loopWidth) offsetX = offsetX % loopWidth; });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { const prev = loopWidth; measure(); if (prev !== loopWidth) offsetX = offsetX % loopWidth; });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { lastTs = 0; } });

})();
