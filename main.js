// ==========================================
// CONFIGURACIÓN PARA SCRIPT NORMAL
// ==========================================

const React = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const { createRoot } = ReactDOM;

// ==========================================
// CONFIGURACIÓN DE LA APLICACIÓN
// ==========================================

const GOOGLE_CLIENT_ID = "916349562772-n5pib46levgf06pagh80hanbmdb6cg2c.apps.googleusercontent.com";
const LOGO_URL = "https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true";

// AJUSTA ESTAS RUTAS SEGÚN TU REPOSITORIO
const DATA_SOURCES = {
    '2026': 'https://raw.githubusercontent.com/TU-USUARIO/TU-REPOSITORIO/main/db_2026.csv',
    '2025': 'https://raw.githubusercontent.com/TU-USUARIO/TU-REPOSITORIO/main/db_2025.csv',
    '2024': 'https://raw.githubusercontent.com/TU-USUARIO/TU-REPOSITORIO/main/db_2024.csv'
};

const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx',
    'usuario@itdurango.edu.mx'
];
const ADMIN_PASSWORD = "X987ela";

// ==========================================
// MÓDULO: GENERACIÓN DE CONSTANCIAS
// ==========================================

const CONSTANCIAS_URL = "https://script.google.com/macros/s/AKfycbxRpN34MVIg3XVJYfV80WOzNilDpVJEMSw9RuMc7PI49zH1Wl-z2Si8hLxCzOMiJaQSpA/exec";
const CONSTANCIAS_FECHA_APERTURA = new Date('2026-06-29T00:00:00');

const fetchConstanciasActivada = async () => {
    try {
        const res = await fetch(CONSTANCIAS_URL + '?action=getConstanciasStatus');
        const data = await res.json();
        if (data.success) return data.status === 'OPEN';
    } catch(e) { /* fallback a fecha automática */ }
    return null;
};

// ==========================================
// LÓGICA DE DATOS
// ==========================================

const detectDelimiter = (text) => {
    if (!text) return ',';
    const firstLine = text.split('\n')[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
};

const parseCSV = (text) => {
    if (!text) return [];
    const delimiter = detectDelimiter(text);
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"' && text[i+1] === '"') { currentField += '"'; i++; }
        else if (char === '"') { inQuotes = !inQuotes; }
        else if (char === delimiter && !inQuotes) { currentRow.push(currentField); currentField = ''; }
        else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && text[i+1] === '\n') i++;
            currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = '';
        } else { currentField += char; }
    }
    if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
    return rows;
};

const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

const fetchLocalData = async (year) => {
    const fileUrl = DATA_SOURCES[year];
    if (!fileUrl) return { data: [], error: null, headersFound: [] };
    
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            if (response.status === 404) throw new Error(`El archivo "db_${year}.csv" no se encuentra.`);
            throw new Error(`Error al cargar el archivo (${response.status})`);
        }
        const text = await response.text();
        if (!text || text.trim().length === 0) throw new Error("El archivo CSV está vacío.");

        const rows = parseCSV(text);
        if (rows.length < 2) return { data: [], error: "El archivo CSV no tiene datos suficientes.", headersFound: [] };

        const rawHeaders = rows[0];
        const headers = rawHeaders.map(h => normalize(h));
        const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(normalize(k))));

        const idx = {
            nombre: findCol(['nombre', 'participante', 'docente', 'alumno', 'name']),
            correo: findCol(['emailaddress', 'correo', 'email', 'mail', 'e-mail']),
            curso:  findCol(['codigo', 'curso', 'taller', 'reconocimiento', 'concepto', 'actividad', 'clave', 'code']),
            fecha:  findCol(['año', 'fecha', 'periodo', 'year', 'date']),
            status: findCol(['status', 'estatus', 'estado']),
            link:   findCol(['fileattachments', 'link', 'url', 'pdf', 'descarga', 'archivo', 'constancia'])
        };

        if (idx.correo === -1) {
            return { 
                data: [], 
                error: `No se encontró la columna de Correo. Encabezados: ${rawHeaders.join(', ')}`,
                headersFound: rawHeaders
            };
        }

        const cleanData = rows.slice(1).map((r, i) => {
            if (r.length <= 1 && !r[0]) return null;
            const statusRaw = idx.status !== -1 ? (r[idx.status] || 'PENDIENTE') : 'ENVIADO';
            return {
                id:     i,
                nombre: idx.nombre !== -1 ? r[idx.nombre] : 'Usuario ITD',
                correo: (r[idx.correo] || '').trim().toLowerCase(),
                curso:  idx.curso !== -1 ? r[idx.curso] : 'Documento ITD',
                fecha:  idx.fecha !== -1 ? r[idx.fecha] : year,
                status: statusRaw.toUpperCase().trim(),
                link:   idx.link !== -1 ? r[idx.link] : '',
                year:   year
            };
        }).filter(item => item && item.correo);

        return { data: cleanData, error: null, headersFound: rawHeaders };
    } catch (error) {
        console.error("Error Fetch Local:", error);
        return { data: [], error: error.message, headersFound: [] };
    }
};

// ==========================================
// AUTH UTILS
// ==========================================

const decodeJwtResponse = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding JWT", e);
        return null;
    }
};

// ==========================================
// COMPONENTES - VERSIÓN SIN JSX
// ==========================================

// Iconos como funciones (sin depender de lucide-react)
const IconMail = (props) => React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props
}, React.createElement('path', { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), React.createElement('polyline', { points: "22,6 12,13 2,6" }));

const IconFileDown = (props) => React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props
}, React.createElement('path', { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), React.createElement('polyline', { points: "14 2 14 8 20 8" }), React.createElement('line', { x1: "12", y1: "18", x2: "12", y2: "12" }), React.createElement('polyline', { points: "9 15 12 18 15 15" }));

// Función para crear componentes con JSX compilado
const h = React.createElement;

// Login Component
const Login = ({ onLogin }) => {
    const [error, setError] = useState('');
    const [logoError, setLogoError] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [adminPass, setAdminPass] = useState('');
    const [adminError, setAdminError] = useState('');
    const [constActivada, setConstActivada] = useState(() => {
        try { return localStorage.getItem('constActivada') === 'true'; } catch(e) { return false; }
    });
    
    const googleIntencion = React.useRef('login');

    const abrirConstancia = () => {
        const input = document.getElementById('inputUsuarioConstancia');
        const prefijo = (input ? input.value : '').replace(/@.*$/, '').trim().toLowerCase();
        if (!prefijo) {
            if (input) { input.style.border = '1.5px solid #e05050'; setTimeout(() => { input.style.border = ''; }, 1500); }
            return;
        }
        const email = prefijo + '@itdurango.edu.mx';
        window.location.href = CONSTANCIAS_URL + '?email=' + encodeURIComponent(email);
    };

    const handleAdminToggle = () => {
        if (adminPass !== ADMIN_PASSWORD) { setAdminError('Clave incorrecta.'); return; }
        const nuevo = !constActivada;
        setConstActivada(nuevo);
        try { localStorage.setItem('constActivada', String(nuevo)); } catch(e) {}
        setShowModal(false);
        setAdminPass('');
        setAdminError('');
    };

    const handleCredentialResponse = (response) => {
        const token = response.credential;
        const payload = decodeJwtResponse(token);
        if (!payload || !payload.email) { setError('No se pudo verificar la identidad.'); return; }
        const email = payload.email.toLowerCase();
        if (googleIntencion.current === 'constancia') {
            googleIntencion.current = 'login';
            if (!email.endsWith('@itdurango.edu.mx')) {
                setError('Usa tu cuenta @itdurango.edu.mx');
                setTimeout(() => setError(''), 4000);
                return;
            }
            window.location.href = CONSTANCIAS_URL + '?email=' + encodeURIComponent(email);
        } else {
            const isAdmin = ADMIN_EMAILS.includes(email);
            onLogin({ email, name: payload.name, picture: payload.picture, isAdmin });
        }
    };

    useEffect(() => {
        if (window.google && GOOGLE_CLIENT_ID !== "TU_CLIENT_ID_AQUI.apps.googleusercontent.com") {
            try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("googleSignInDiv"),
                    { theme: "outline", size: "large", width: "100%", text: "continue_with" }
                );
                if (constActivada && document.getElementById("googleSignInDivConstancia")) {
                    window.google.accounts.id.renderButton(
                        document.getElementById("googleSignInDivConstancia"),
                        { theme: "filled_blue", size: "large", width: "100%", text: "continue_with" }
                    );
                }
            } catch (err) {
                console.error("Error initializing Google Btn", err);
                setError("Error al cargar servicios de Google.");
            }
        }
    }, [constActivada]);

    // Estilos inline
    const S = {
        page: {
            minHeight: '100vh',
            background: 'linear-gradient(150deg, #f8f4ec 0%, #efe7d5 45%, #e8f0f8 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '2rem 1rem',
            fontFamily: "'DM Sans','Inter',sans-serif",
            position: 'relative', overflow: 'hidden'
        },
        bgDeco: {
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 50% at 15% 5%, rgba(107,26,42,.08) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 95%, rgba(26,58,92,.08) 0%, transparent 50%)'
        },
        header: {
            textAlign: 'center', marginBottom: '2rem', position: 'relative',
            animation: 'fadeUp .5s cubic-bezier(.22,.68,0,1.2) both'
        },
        logoWrap: {
            position: 'relative', width: 84, height: 84, margin: '0 auto 1rem'
        },
        logoRing: {
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '1.5px solid rgba(196,154,53,.5)',
            animation: 'ringPulse 2.8s ease-out infinite'
        },
        logoRing2: {
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '1.5px solid rgba(196,154,53,.3)',
            animation: 'ringPulse 2.8s 1.4s ease-out infinite'
        },
        logoImg: {
            width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%',
            background: '#fff', padding: 8,
            boxShadow: '0 4px 22px rgba(107,26,42,.2), 0 0 0 2.5px rgba(196,154,53,.65)'
        },
        h1: {
            fontFamily: "'Playfair Display','Georgia',serif",
            fontSize: 'clamp(1.55rem,5vw,2.1rem)', fontWeight: 900,
            color: '#3D0A14', margin: '0 0 .35rem', letterSpacing: '-.015em', lineHeight: 1.15
        },
        sub: { fontSize: '.83rem', color: '#6B6B7B', margin: 0 },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(288px, 1fr))',
            gap: '1.1rem', width: '100%', maxWidth: 760,
            animation: 'fadeUp .55s .1s cubic-bezier(.22,.68,0,1.2) both'
        },
        card: (accent) => ({
            background: '#fff', borderRadius: 22, overflow: 'hidden',
            boxShadow: `0 4px 8px rgba(0,0,0,.04), 0 24px 52px ${accent}, 0 0 0 1px rgba(196,154,53,.12)`,
            display: 'flex', flexDirection: 'column'
        }),
        stripe: (g) => ({
            height: 5, backgroundSize: '200% 100%',
            animation: 'shimmer 4s linear infinite',
            background: g
        }),
        cardBody: { padding: '1.7rem 1.9rem', flex: 1, display: 'flex', flexDirection: 'column' },
        iconWrap: (bg, shadow) => ({
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: shadow
        }),
        cardTitle: { fontWeight: 700, fontSize: '1.02rem', color: '#1A1720', lineHeight: 1.2 },
        cardSub: { fontSize: '.74rem', color: '#6B6B7B', marginTop: '.08rem' },
        desc: { fontSize: '.82rem', color: '#5A5A6A', lineHeight: 1.62, margin: '1rem 0 1.2rem' },
        authNote: {
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem',
            fontSize: '.7rem', color: '#A0A0B0', marginTop: '.5rem'
        },
        footer: {
            marginTop: '1.8rem', textAlign: 'center',
            fontSize: '.68rem', color: 'rgba(80,65,55,.55)',
            animation: 'fadeUp .5s .3s ease both', letterSpacing: '.02em'
        }
    };

    // Render con React.createElement
    return h('div', { style: S.page },
        h('div', { style: S.bgDeco }),
        
        // Modal
        showModal && h('div', {
            style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
            onClick: e => { if (e.target === e.currentTarget) { setShowModal(false); setAdminPass(''); setAdminError(''); } }
        },
            h('div', { style: { background: '#fff', borderRadius: 18, overflow: 'hidden', width: '100%', maxWidth: 320, boxShadow: '0 24px 60px rgba(0,0,0,.25)', animation: 'fadeUp .3s cubic-bezier(.22,.68,0,1.2) both' } },
                h('div', { style: { height: 4, background: 'linear-gradient(90deg,#3D0A14,#6B1A2A,#C49A35,#6B1A2A,#3D0A14)', backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite' } }),
                h('div', { style: { padding: '1.5rem 1.7rem' } },
                    h('div', { style: { textAlign: 'center', marginBottom: '1.1rem' } },
                        h('div', { style: { fontSize: '1.7rem', marginBottom: '.3rem' } }, constActivada ? '🔒' : '✅'),
                        h('div', { style: { fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: '1.05rem', color: '#3D0A14' } },
                            constActivada ? 'Desactivar Tarjeta 2' : 'Activar Tarjeta 2'
                        ),
                        h('div', { style: { fontSize: '.73rem', color: '#9090A0', marginTop: '.2rem' } }, 'Ingresa la clave de administrador')
                    ),
                    h('input', {
                        type: 'password',
                        value: adminPass,
                        onChange: e => { setAdminPass(e.target.value); setAdminError(''); },
                        onKeyDown: e => e.key === 'Enter' && handleAdminToggle(),
                        placeholder: '••••••••',
                        autoFocus: true,
                        style: { width: '100%', padding: '.72rem 1rem', border: `1.5px solid ${adminError ? '#e05050' : '#e0e0e0'}`, borderRadius: 10, fontSize: '.9rem', fontFamily: "'DM Sans',sans-serif", outline: 'none', marginBottom: '.5rem', boxSizing: 'border-box', background: adminError ? '#fff5f5' : '#fff' }
                    }),
                    adminError && h('div', { style: { fontSize: '.72rem', color: '#c0392b', marginBottom: '.5rem', display: 'flex', alignItems: 'center', gap: '.3rem' } },
                        h('span', null, '⚠️'), ' ', adminError
                    ),
                    h('button', {
                        onClick: handleAdminToggle,
                        style: { width: '100%', padding: '.72rem', background: constActivada ? 'linear-gradient(135deg,#555,#888)' : 'linear-gradient(135deg,#1B396A,#2B5580)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', marginBottom: '.5rem' }
                    }, constActivada ? '🔒 Desactivar' : '✅ Activar'),
                    h('button', {
                        onClick: () => { setShowModal(false); setAdminPass(''); setAdminError(''); },
                        style: { width: '100%', padding: '.52rem', background: 'transparent', border: '1.5px solid #e8e8e8', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: '#9090A0', cursor: 'pointer' }
                    }, 'Cancelar')
                )
            )
        ),
        
        // Header
        h('div', { style: S.header },
            h('div', { ...S.logoWrap, onClick: () => { setShowModal(true); setAdminPass(''); setAdminError(''); }, style: { ...S.logoWrap, cursor: 'pointer' } },
                h('div', { style: S.logoRing }),
                h('div', { style: S.logoRing2 }),
                logoError ? 
                    h('div', { style: { width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg,#3D0A14,#6B1A2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 22px rgba(107,26,42,.2), 0 0 0 2.5px rgba(196,154,53,.65)', flexDirection: 'column', gap: 2 } },
                        h('span', { style: { fontSize: '.65rem', fontWeight: 900, color: '#F5E4A8', letterSpacing: '.1em', lineHeight: 1 } }, 'ITD'),
                        h('span', { style: { fontSize: '.42rem', color: 'rgba(245,228,168,.6)', letterSpacing: '.06em', lineHeight: 1 } }, 'DURANGO')
                    ) :
                    h('img', { src: LOGO_URL, alt: 'ITD', style: S.logoImg, onError: () => setLogoError(true) })
            ),
            h('h1', { style: S.h1 },
                'Constancias y ',
                h('em', { style: { fontStyle: 'italic', color: '#922438' } }, 'Reconocimientos')
            ),
            h('p', { style: S.sub }, 'Instituto Tecnológico de Durango — Portal ITD')
        ),
        
        // Grid de tarjetas
        h('div', { style: S.grid },
            // Tarjeta 1
            h('div', { style: S.card('rgba(107,26,42,.12)') },
                h('div', { style: S.stripe('linear-gradient(90deg,#3D0A14 0%,#6B1A2A 28%,#C49A35 50%,#6B1A2A 72%,#3D0A14 100%)') }),
                h('div', { style: S.cardBody },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '.85rem', marginBottom: '.2rem' } },
                        h('div', { style: S.iconWrap('linear-gradient(135deg,#3D0A14,#922438)', '0 3px 14px rgba(107,26,42,.28)') },
                            h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "#F5E4A8", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                h('path', { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                                h('polyline', { points: "14 2 14 8 20 8" }),
                                h('line', { x1: "16", y1: "13", x2: "8", y2: "13" }),
                                h('line', { x1: "16", y1: "17", x2: "8", y2: "17" }),
                                h('polyline', { points: "10 9 9 9 8 9" })
                            )
                        ),
                        h('div', null,
                            h('div', { style: S.cardTitle }, 'Mis Constancias'),
                            h('div', { style: S.cardSub }, 'Descarga tus documentos')
                        )
                    ),
                    h('p', { style: S.desc },
                        'Inicia sesión con tu cuenta ',
                        h('strong', { style: { color: '#1B396A' } }, '@itdurango.edu.mx'),
                        ' para ver y descargar tus constancias y reconocimientos.'
                    ),
                    GOOGLE_CLIENT_ID === "TU_CLIENT_ID_AQUI.apps.googleusercontent.com" ?
                        h('div', { style: { padding: '.85rem', background: '#fffbee', border: '1.5px solid rgba(196,154,53,.3)', borderRadius: 12, fontSize: '.78rem', color: '#7A5500' } },
                            h('strong', null, '⚠ Configuración pendiente: '),
                            'agrega el GOOGLE_CLIENT_ID en main.js.'
                        ) :
                        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '.6rem' } },
                            h('div', { id: "googleSignInDiv", style: { width: '100%', minHeight: 44 } }),
                            error && h('div', { style: { display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.7rem .9rem', background: '#fef2f2', border: '1.5px solid rgba(220,80,80,.18)', borderRadius: 10, fontSize: '.78rem', color: '#7A1E1E' } },
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('circle', { cx: 12, cy: 12, r: 10 }),
                                    h('line', { x1: 12, y1: 8, x2: 12, y2: 12 }),
                                    h('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 })
                                ),
                                ' ', error
                            ),
                            h('div', { style: S.authNote },
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
                                    h('path', { d: "M7 11V7a5 5 0 0 1 10 0v4" })
                                ),
                                ' Autenticación segura con Google'
                            )
                        )
                )
            ),
            
            // Tarjeta 2
            h('div', { style: { ...S.card('rgba(26,58,92,.1)'), opacity: constActivada ? 1 : 0.55, transition: 'opacity .3s' } },
                h('div', { style: S.stripe(constActivada ? 'linear-gradient(90deg,#1B396A 0%,#2B5580 35%,#C49A35 55%,#2B5580 75%,#1B396A 100%)' : 'linear-gradient(90deg,#999 0%,#bbb 50%,#999 100%)') }),
                h('div', { style: S.cardBody },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '.85rem', marginBottom: '.2rem' } },
                        h('div', { style: S.iconWrap(constActivada ? 'linear-gradient(135deg,#1B396A,#2B5580)' : 'linear-gradient(135deg,#999,#bbb)', constActivada ? '0 3px 14px rgba(26,58,92,.25)' : 'none') },
                            constActivada ?
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "#F5E4A8", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
                                    h('polyline', { points: "9 12 11 14 15 10" })
                                ) :
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
                                    h('path', { d: "M7 11V7a5 5 0 0 1 10 0v4" })
                                )
                        ),
                        h('div', null,
                            h('div', { style: S.cardTitle }, 'Generar Constancia'),
                            h('div', { style: S.cardSub }, constActivada ? 'Cursos Junio–Agosto 2026' : 'Disponible próximamente')
                        )
                    ),
                    h('p', { style: S.desc },
                        constActivada ?
                            'Genera el PDF de tu constancia o reconocimiento de los cursos de actualización docente del periodo actual.' :
                            'Este servicio estará disponible a partir del 29 de junio de 2026, al concluir el periodo de actualización docente.'
                    ),
                    constActivada ?
                        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '.55rem' } },
                            h('div', { style: { display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #d1d5db', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' } },
                                h('input', {
                                    id: "inputUsuarioConstancia",
                                    type: "text",
                                    placeholder: "tu.usuario",
                                    autoComplete: "off",
                                    autoCapitalize: "none",
                                    onKeyDown: (e) => { if (e.key === 'Enter') abrirConstancia(); },
                                    style: { flex: 1, padding: '.72rem .9rem', border: 'none', outline: 'none', fontSize: '.88rem', fontFamily: "'DM Sans','Inter',sans-serif", color: '#1A1720', background: 'transparent' }
                                }),
                                h('span', { style: { display: 'flex', alignItems: 'center', padding: '.72rem .75rem .72rem 0', fontSize: '.78rem', color: '#9090A0', fontFamily: "'DM Sans','Inter',sans-serif", whiteSpace: 'nowrap', userSelect: 'none' } }, '@itdurango.edu.mx')
                            ),
                            h('button', {
                                onClick: abrirConstancia,
                                style: { width: '100%', padding: '.82rem 1rem', background: 'linear-gradient(135deg,#1B396A,#2B5580)', color: '#F5E4A8', border: 'none', borderRadius: 12, fontFamily: "'DM Sans','Inter',sans-serif", fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', boxShadow: '0 4px 14px rgba(26,58,92,.30)' }
                            },
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#F5E4A8", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
                                    h('polyline', { points: "9 12 11 14 15 10" })
                                ),
                                ' Generar mi Constancia'
                            ),
                            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem', fontSize: '.7rem', color: '#A0A0B0' } },
                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                    h('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
                                    h('path', { d: "M7 11V7a5 5 0 0 1 10 0v4" })
                                ),
                                ' Acceso con tu usuario institucional'
                            )
                        ) :
                        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', padding: '.82rem 1rem', borderRadius: 12, background: '#f0f0f0', color: '#999', fontSize: '.83rem', fontWeight: 500 } },
                            h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "#bbb", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                h('circle', { cx: 12, cy: 12, r: 10 }),
                                h('polyline', { points: "12 6 12 12 16 14" })
                            ),
                            ' Próximamente — 29 Jun 2026'
                        )
                )
            ),
            
            // Tarjeta 3
            h('a', {
                href: "./otras-constancias.html",
                style: { ...S.card('rgba(107,26,42,.1)'), cursor: 'pointer', textDecoration: 'none', transition: 'transform .2s, box-shadow .2s' },
                onMouseEnter: (e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,.07),0 32px 64px rgba(107,26,42,.15)'; },
                onMouseLeave: (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }
            },
                h('div', { style: S.stripe('linear-gradient(90deg,#3D0A14 0%,#6B1A2A 28%,#C49A35 50%,#6B1A2A 72%,#3D0A14 100%)') }),
                h('div', { style: S.cardBody },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '.85rem', marginBottom: '.2rem' } },
                        h('div', { style: S.iconWrap('linear-gradient(135deg,#3D0A14,#922438)', '0 3px 14px rgba(107,26,42,.28)') },
                            h('svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 38 38", width: 22, height: 22 },
                                h('path', { d: "M19 2 L36 2 L36 28 Q27.5 36 19 31 Q10.5 36 2 28 L2 2 Z", fill: "rgba(255,255,255,0.15)", stroke: "#F5E4A8", strokeWidth: "1.8", opacity: "0.9" }),
                                h('circle', { cx: 19, cy: 18, r: 5.5, fill: "none", stroke: "#F5E4A8", strokeWidth: "1.5", opacity: "0.85" }),
                                h('circle', { cx: 19, cy: 18, r: 2, fill: "#F5E4A8", opacity: "0.95" }),
                                h('line', { x1: 19, y1: 6, x2: 19, y2: 29, stroke: "#F5E4A8", strokeWidth: "1", opacity: "0.4" }),
                                h('line', { x1: 5, y1: 18, x2: 33, y2: 18, stroke: "#F5E4A8", strokeWidth: "1", opacity: "0.4" })
                            )
                        ),
                        h('div', null,
                            h('div', { style: S.cardTitle }, 'Desarrollo Académico'),
                            h('div', { style: S.cardSub }, 'Uso Interno')
                        )
                    ),
                    h('p', { style: S.desc },
                        'Genera constancias y reconocimientos personalizados con la plantilla oficial ITD. Ingresa nombres manualmente o carga un Excel. Incluye QR de verificación.'
                    ),
                    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', padding: '.85rem 1rem', borderRadius: 12, background: 'linear-gradient(135deg,#3D0A14,#922438)', color: '#F5E4A8', fontWeight: 700, fontSize: '.84rem', boxShadow: '0 4px 18px rgba(107,26,42,.30)' } },
                        '📜 Acceder'
                    )
                )
            )
        ),
        
        h('div', { style: S.footer },
            '© ', new Date().getFullYear(), ' Dr. Alejandro Calderón Rentería — Coordinación Docente ITD'
        )
    );
};

// ==========================================
// Dashboard Component
// ==========================================

const Dashboard = ({ user, onLogout }) => {
    const [year, setYear] = useState('2025');
    const [allData, setAllData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [errorStr, setErrorStr] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!DATA_SOURCES[year]) { setAllData([]); return; }
        setLoading(true);
        setErrorStr(null);
        fetchLocalData(year).then(res => {
            setAllData(res.data);
            setHeaders(res.headersFound);
            if (res.error) setErrorStr(res.error);
            setLoading(false);
        });
    }, [year]);

    const filteredData = useMemo(() => {
        if (errorStr || allData.length === 0) return [];
        return allData.filter(item => {
            const isOwner = item.correo === user.email;
            const isStatusOk = item.status === 'ENVIADO';
            if (!user.isAdmin && !(isOwner && isStatusOk)) return false;
            if (!user.isAdmin && !item.correo.includes('@')) return false;
            if (search) {
                const term = normalize(search);
                return (
                    normalize(item.nombre).includes(term) ||
                    normalize(item.curso).includes(term) ||
                    normalize(item.correo).includes(term)
                );
            }
            return true;
        });
    }, [allData, user, search, errorStr]);

    const downloadReport = () => {
        if (!filteredData.length) return;
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Nombre,Correo,Documento,Fecha,Status,Link\n"
            + filteredData.map(e => `"${e.nombre}","${e.correo}","${e.curso}","${e.fecha}","${e.status}","${e.link}"`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_itd_${year}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const handleShareEmail = (item) => {
        const subject = `Documento ITD: ${item.curso}`;
        const body = `Hola ${item.nombre},\n\nAdjunto encontrarás el enlace para descargar tu documento: "${item.curso}".\n\nEnlace de descarga: ${item.link}\n\nAtentamente,\nCoordinación de Actualización Docente\nDesarrollo Académico`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return h('div', { className: "min-h-screen bg-gray-50 font-sans flex flex-col" },
        // Navbar
        h('nav', { className: "bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm" },
            h('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
                h('div', { className: "flex justify-between h-16 items-center" },
                    h('div', { className: "flex items-center gap-3" },
                        h('img', { src: LOGO_URL, className: "h-10 w-auto", alt: "ITD", onError: (e) => e.target.style.display = 'none' }),
                        h('div', { className: "h-8 w-px bg-gray-300 hidden sm:block mx-1" }),
                        h('div', { className: "flex flex-col" },
                            h('span', { className: "text-base md:text-lg font-bold text-itd-blue leading-tight" }, "Descarga de Constancias y Reconocimientos")
                        )
                    ),
                    h('div', { className: "flex items-center gap-3" },
                        user.picture ?
                            h('img', { src: user.picture, alt: "Profile", className: "w-8 h-8 rounded-full border border-gray-200" }) :
                            h('div', { className: "w-8 h-8 rounded-full bg-itd-blue text-white flex items-center justify-center text-xs font-bold" },
                                user.email.charAt(0).toUpperCase()
                            ),
                        h('div', { className: "hidden md:flex flex-col items-end" },
                            h('span', { className: "text-xs font-bold text-gray-700" }, user.name || 'Usuario'),
                            h('span', { className: "text-[10px] text-gray-500" }, user.email)
                        ),
                        user.isAdmin && h('span', { className: "bg-itd-red text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase ml-2" }, "Admin"),
                        h('button', {
                            onClick: onLogout,
                            className: "ml-2 flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100",
                            title: "Salir"
                        },
                            h('span', { className: "text-sm font-medium hidden sm:inline" }, "Salir"),
                            h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                h('path', { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
                                h('polyline', { points: "16 17 21 12 16 7" }),
                                h('line', { x1: "21", y1: "12", x2: "9", y2: "12" })
                            )
                        )
                    )
                )
            )
        ),
        
        // Main
        h('main', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full" },
            // Filtros
            h('div', { className: "bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center" },
                h('div', { className: "flex gap-4 w-full md:w-auto items-center" },
                    h('span', { className: "text-sm font-bold text-gray-500 uppercase" }, "Año:"),
                    h('select', {
                        value: year,
                        onChange: (e) => setYear(e.target.value),
                        className: "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full md:w-48 p-2.5"
                    },
                        Object.keys(DATA_SOURCES).map(k => h('option', { key: k, value: k }, k))
                    )
                ),
                h('div', { className: "relative w-full md:w-96" },
                    h('div', { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" },
                        h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "text-gray-400" },
                            h('circle', { cx: 11, cy: 11, r: 8 }),
                            h('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
                        )
                    ),
                    h('input', {
                        type: "text",
                        value: search,
                        onChange: (e) => setSearch(e.target.value),
                        className: "bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full pl-10 p-2.5",
                        placeholder: "Buscar por nombre, correo o documento..."
                    })
                ),
                user.isAdmin && h('button', {
                    onClick: downloadReport,
                    className: "flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                },
                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                        h('path', { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                        h('polyline', { points: "7 10 12 15 17 10" }),
                        h('line', { x1: 12, y1: 15, x2: 12, y2: 3 })
                    ),
                    " Reporte"
                )
            ),
            
            // Error
            errorStr && h('div', { className: "bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm mb-8 animate-pulse" },
                h('div', { className: "flex items-start" },
                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "text-red-600 mr-4 mt-1 flex-shrink-0" },
                        h('path', { d: "M12 9v4" }),
                        h('path', { d: "M12 17h.01" }),
                        h('circle', { cx: 12, cy: 12, r: 10 })
                    ),
                    h('div', null,
                        h('h3', { className: "text-lg font-bold text-red-800 mb-2" }, "Error de lectura"),
                        h('p', { className: "text-red-700 font-medium mb-3" }, errorStr),
                        h('div', { className: "mt-3 text-sm text-red-800 bg-white/50 p-3 rounded" },
                            h('strong', null, "Ayuda:"),
                            h('p', { className: "mt-1" }, "Revisa que el archivo ", h('code', null, `db_${year}.csv`), " esté en GitHub.")
                        )
                    )
                )
            ),
            
            // Lista de documentos
            loading ?
                h('div', { className: "flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100" },
                    h('div', { className: "animate-spin rounded-full h-10 w-10 border-4 border-itd-blue border-t-transparent mb-4" }),
                    h('p', { className: "text-gray-500 font-medium" }, `Cargando registros del ${year}...`)
                ) :
                filteredData.length > 0 ?
                    h('div', { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" },
                        h('div', { className: "hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider" },
                            h('div', { className: "col-span-4" }, "Nombre / Correo"),
                            h('div', { className: "col-span-5" }, "Documento"),
                            h('div', { className: "col-span-3 text-right" }, "Acciones")
                        ),
                        h('div', null,
                            filteredData.map((item, index) =>
                                h('div', { key: item.id, className: `grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-red-50'} hover:bg-blue-50` },
                                    h('div', { className: "col-span-1 md:col-span-4 flex items-start gap-3" },
                                        h('div', { className: `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${index % 2 === 0 ? 'bg-blue-100 text-itd-blue' : 'bg-white text-itd-red border border-red-100'}` },
                                            item.nombre.charAt(0)
                                        ),
                                        h('div', { className: "min-w-0 flex-1" },
                                            h('p', { className: "font-bold text-gray-900 text-sm truncate" }, item.nombre),
                                            h('p', { className: "text-xs text-gray-500 truncate" }, item.correo),
                                            h('div', { className: "md:hidden flex items-center gap-1 mt-1 text-[10px] text-gray-400" },
                                                h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                                    h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
                                                    h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
                                                    h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
                                                    h('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
                                                ),
                                                ' ', item.fecha
                                            )
                                        )
                                    ),
                                    h('div', { className: "col-span-1 md:col-span-5" },
                                        h('div', { className: "flex items-start gap-2" },
                                            user.isAdmin && h('div', { className: "mt-1" },
                                                item.status === 'ENVIADO' ?
                                                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "text-green-500" },
                                                        h('path', { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
                                                        h('polyline', { points: "22 4 12 14.01 9 11.01" })
                                                    ) :
                                                    h('div', { className: "w-3 h-3 rounded-full bg-yellow-400" })
                                            ),
                                            h('div', null,
                                                h('h3', { className: "text-sm font-medium text-gray-800 leading-snug" }, item.curso),
                                                h('p', { className: "hidden md:flex items-center gap-1 text-xs text-gray-400 mt-1" },
                                                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                                        h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
                                                        h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
                                                        h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
                                                        h('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
                                                    ),
                                                    ' ', item.fecha
                                                )
                                            )
                                        )
                                    ),
                                    h('div', { className: "col-span-1 md:col-span-3 flex justify-start md:justify-end gap-2" },
                                        item.link && item.link !== '#' && item.status === 'ENVIADO' ?
                                            h('div', { className: "flex gap-2" },
                                                h('button', {
                                                    onClick: () => handleShareEmail(item),
                                                    className: "p-2 text-gray-500 hover:text-itd-blue hover:bg-blue-100 rounded-lg transition-colors",
                                                    title: "Enviar enlace por correo"
                                                },
                                                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                                        h('path', { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }),
                                                        h('polyline', { points: "22,6 12,13 2,6" })
                                                    )
                                                ),
                                                h('a', {
                                                    href: item.link,
                                                    target: "_blank",
                                                    className: "w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-itd-blue hover:text-itd-blue text-gray-600 text-xs font-bold rounded-lg transition-all shadow-sm group-hover:shadow-md"
                                                },
                                                    h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
                                                        h('path', { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                                                        h('polyline', { points: "14 2 14 8 20 8" }),
                                                        h('line', { x1: "12", y1: "18", x2: "12", y2: "12" }),
                                                        h('polyline', { points: "9 15 12 18 15 15" })
                                                    ),
                                                    h('span', null, "Descargar")
                                                )
                                            ) :
                                            h('span', { className: "text-xs text-gray-400 italic px-4 py-2 bg-gray-50 rounded border border-gray-100 w-full md:w-auto text-center" },
                                                item.status !== 'ENVIADO' ? 'No Aprobado, Revisar con su instructor' : 'No disponible'
                                            )
                                    )
                                )
                            )
                        )
                    ) :
                    !loading && !errorStr && h('div', { className: "text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200" },
                        h('svg', { xmlns: "http://www.w3.org/2000/svg", width: 64, height: 64, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "mx-auto h-16 w-16 text-gray-200 mb-4" },
                            h('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
                            h('polyline', { points: "9 12 11 14 15 10" })
                        ),
                        h('h3', { className: "text-xl font-bold text-gray-900" }, "Sin resultados"),
                        h('p', { className: "text-gray-500 mt-2 max-w-sm mx-auto" },
                            search ? 'No encontramos coincidencias para tu búsqueda.' : 'No tienes documentos disponibles con estatus "ENVIADO" para este año.'
                        ),
                        user.isAdmin && h('div', { className: "mt-6 inline-block px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 text-left" },
                            h('strong', null, "Diagnóstico Admin:"), h('br', null),
                            "Leyendo archivo: ", h('code', null, `db_${year}.csv`), h('br', null),
                            "Asegúrate que el archivo esté subido en GitHub en la carpeta raíz."
                        )
                    )
        ),
        
        // Footer
        h('footer', { className: "bg-itd-red text-white py-6 mt-auto" },
            h('div', { className: "max-w-7xl mx-auto px-4 text-center" },
                h('p', { className: "text-sm font-medium" }, `© ${new Date().getFullYear()} Dr. Alejandro Calderón Rentería - Coordinación Docente`)
            )
        )
    );
};

// ==========================================
// APP PRINCIPAL
// ==========================================

const App = () => {
    const [user, setUser] = useState(null);
    const handleLogout = () => { window.location.href = "https://da-itd.github.io/A/"; };
    return user ? h(Dashboard, { user, onLogout: handleLogout }) : h(Login, { onLogin: setUser });
};

// ==========================================
// MONTAJE
// ==========================================

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(h(App, null));
}

console.log('✅ Aplicación iniciada correctamente');
