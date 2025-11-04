// js/supa-config.js
window.SUPABASE = {
    url: 'https://ymzzzssjzqwyboqxhyoi.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltenp6c3NqenF3eWJvcXhoeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2OTczNTEsImV4cCI6MjA3NzI3MzM1MX0.dbdGkJqL5Oxd0BY8EpOt_IdZ0Ma0u0MGRiBml_IvV9o',
    bucket: 'properties',                 // tu bucket de imágenes
    bucketIsPublic: true                  // público ahora; si lo cambias a privado, podremos firmar URL
};

// js/db.js
// Inicializa Supabase y expone PROPERTIES_DATA + PROPERTIES_READY (Promise)

const SUPABASE_URL = 'https://ymzzzssjzqwyboqxhyoi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltenp6c3NqenF3eWJvcXhoeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2OTczNTEsImV4cCI6MjA3NzI3MzM1MX0.dbdGkJqL5Oxd0BY8EpOt_IdZ0Ma0u0MGRiBml_IvV9o';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mapas (id -> nombre / códigos)
async function loadCatalogs() {
    const [pt, tt, st] = await Promise.all([
        supabase.from('property_type').select('id,name'),
        supabase.from('transaction_type').select('id,code,name'),
        supabase.from('status_type').select('id,code,name'),
    ]);

    const toMap = (arr) => Object.fromEntries((arr?.data || []).map(x => [x.id, { name: x.name, code: x.code }]));
    return {
        PT: toMap(pt),
        TT: toMap(tt),
        ST: toMap(st),
    };
}

function publicUrlFromKey(storage_key) {
    const { data } = supabase.storage.from('properties').getPublicUrl(storage_key);
    return data.publicUrl;
}

// Normaliza un registro de la DB a la forma esperada por tu front (en inglés)
function adaptProperty(p, loc, media, catalogs) {
    const { PT, TT, ST } = catalogs;

    // Texto transacción esperado por el front
    const tt = TT[p.transaction_type_id]?.code || TT[p.transaction_type_id]?.name || '';
    const transaction = /arriendo/i.test(tt) ? 'arriendo' : 'venta';

    // Estado solicitado por tu front (catalogo.js filtra por 'available')
    const stCode = (ST[p.status_type_id]?.code || ST[p.status_type_id]?.name || '').toLowerCase();
    const status = stCode === 'disponible' ? 'available' : 'not-available';

    const typeName = (PT[p.property_type_id]?.name || '').toLowerCase();

    // Ubicación
    const municipio = loc?.municipio || '';
    const sector = loc?.sector || '';
    const address = loc?.direccion || '';
    const location = [sector, municipio].filter(Boolean).join(', ');

    // Galería (imágenes + videos)
    const gallery = (media || [])
        .sort((a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order))
        .map(m => {
            const url = publicUrlFromKey(m.storage_key);
            const isVideo = /\.mp4$|\.webm$/i.test(m.storage_key || '');
            return { type: isVideo ? 'video' : 'image', src: url };
        });

    // Back-compat: 'images' solo con las de tipo imagen y 'image' principal
    const images = gallery.filter(x => x.type === 'image').map(x => x.src);
    const image = images[0] || '';

    return {
        id: String(p.id),
        title: p.nombre,
        price: p.precio,
        featured: !!p.destacada,
        transaction,        // 'venta' | 'arriendo'
        status,             // 'available' | 'not-available'
        type: typeName,     // usado en filtros/categorías
        area: p.area_m2 || 0,
        bedrooms: p.habitaciones || 0,
        bathrooms: p.banos || 0,
        parking: !!p.parqueadero,
        stratum: p.estrato || 0,
        description: p.descripcion || '',
        additionalFeatures: Array.isArray(p.caracteristicas) ? p.caracteristicas : [],
        // localización
        location, municipio, sector, address,
        // multimedia
        image, images, gallery
    };
}

// Carga todo y expone variables globales
async function fetchAllProperties() {
    // 1) Trae properties
    const { data: props, error } = await supabase
        .from('property')
        .select('id,nombre,precio,property_type_id,transaction_type_id,status_type_id,estrato,area_m2,habitaciones,banos,parqueadero,descripcion,caracteristicas,destacada,created_at')
        .order('created_at', { ascending: false });
    if (error) throw error;

    if (!props?.length) return [];

    // 2) Catálogos + hijos (location, media)
    const [catalogs, locsRes, mediaRes] = await Promise.all([
        loadCatalogs(),
        supabase.from('location').select('*').in('property_id', props.map(p => p.id)),
        supabase.from('media').select('*').in('property_id', props.map(p => p.id))
            .order('is_primary', { ascending: false })
            .order('sort_order', { ascending: true })
    ]);

    const locByPid = {};
    (locsRes.data || []).forEach(l => { locByPid[l.property_id] = l; });

    const mediaByPid = {};
    (mediaRes.data || []).forEach(m => { (mediaByPid[m.property_id] ||= []).push(m); });

    return props.map(p => adaptProperty(p, locByPid[p.id], mediaByPid[p.id], catalogs));
}

// Exponer datos al resto del sitio
window.PROPERTIES_DATA = [];
window.PROPERTIES_READY = (async () => {
    try {
        const rows = await fetchAllProperties();
        window.PROPERTIES_DATA = rows;
        document.dispatchEvent(new CustomEvent('properties:ready'));
        return rows;
    } catch (e) {
        console.error('Error cargando propiedades:', e);
        return [];
    }
})();
