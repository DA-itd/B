import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, LogOut, Search, ShieldCheck, AlertCircle, FileText, Download, AlertTriangle, Database, Lock, Calendar, CheckCircle, Send, Share2, Clock, Award, ExternalLink } from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE GOOGLE (OBLIGATORIO)
// ==========================================
const GOOGLE_CLIENT_ID = "916349562772-08j3sv7m57d3a1ni3u69oufhhlp14g7o.apps.googleusercontent.com"; 

// ==========================================
// CONFIGURACIÓN LOCAL (GITHUB)
// ==========================================
const LOGO_URL = "https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true";

// CONFIGURACIÓN DE ARCHIVOS
const DATA_SOURCES = {
  '2026': './db_2026.csv',
  '2025': './db_2025.csv', 
  '2024': './db_2024.csv'
};

const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx',
    'usuario@itdurango.edu.mx' 
];
// Clave de acceso rápido admin (doble click en logo)
const ADMIN_PASSWORD = "Xela1615";

// ==========================================
// MÓDULO: GENERACIÓN DE CONSTANCIAS
// ==========================================
const CONSTANCIAS_URL = "https://script.google.com/macros/s/AKfycbwxTOTI0iXjs4l8qZrOP5sK-tflW7Bz-cugiq55LTtuIRziM9SLfM8z9GgjqaoS-o5v/exec";
// Lunes 29 de Junio 2026 — después de que terminen los cursos el 26 de junio
const CONSTANCIAS_FECHA_APERTURA = new Date('2026-06-29T00:00:00');

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
         if (response.status === 404) throw new Error(`El archivo "db_${year}.csv" no se encuentra en el repositorio.`);
         throw new Error(`Error al cargar el archivo local (${response.status})`);
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
            error: `No se encontró la columna de Correo (buscamos: EmailAddress, Correo, Email). Encabezados detectados: ${rawHeaders.join(', ')}`,
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
// AUTH UTILS (GOOGLE JWT DECODER)
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
// COMPONENTE: CUENTA REGRESIVA — CONSTANCIAS
// ==========================================
const useCountdown = (targetDate) => {
  const calc = () => {
    const diff = targetDate - new Date();
    if (diff <= 0) return { dias: 0, horas: 0, minutos: 0, segundos: 0, abierto: true };
    return {
      dias:     Math.floor(diff / (1000 * 60 * 60 * 24)),
      horas:    Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutos:  Math.floor((diff / (1000 * 60)) % 60),
      segundos: Math.floor((diff / 1000) % 60),
      abierto:  false
    };
  };
  const [tiempo, setTiempo] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTiempo(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  return tiempo;
};

const UnitBox = ({ valor, label }) => (
  <div className="flex flex-col items-center">
    <div className="bg-itd-blue text-white rounded-lg w-14 h-14 flex items-center justify-center text-2xl font-bold tabular-nums shadow-inner">
      {String(valor).padStart(2, '0')}
    </div>
    <span className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">{label}</span>
  </div>
);

const CardConstancias = ({ user }) => {
  const { dias, horas, minutos, segundos, abierto } = useCountdown(CONSTANCIAS_FECHA_APERTURA);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-itd-red to-itd-blue p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Constancias y Reconocimientos</h2>
            <p className="text-white/75 text-xs mt-0.5">Cursos del periodo Enero–Junio 2026</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {abierto ? (
          // ── MÓDULO ABIERTO ──
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">¡El módulo está disponible!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Genera el PDF de tu constancia o reconocimiento de los cursos de actualización docente del periodo actual.
                </p>
              </div>
            </div>

            {/* Info del usuario activo */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              {user.picture ? (
                <img src={user.picture} className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0" alt=""/>
              ) : (
                <div className="w-8 h-8 rounded-full bg-itd-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{user.name || 'Usuario'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
            </div>

            <a
              href={CONSTANCIAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-itd-red hover:bg-red-800 text-white font-bold rounded-lg transition-colors shadow-sm text-sm"
            >
              <Award className="w-4 h-4" />
              Generar mi Constancia o Reconocimiento
              <ExternalLink className="w-4 h-4 ml-auto opacity-70" />
            </a>
          </div>
        ) : (
          // ── MÓDULO BLOQUEADO CON CUENTA REGRESIVA ──
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Disponible a partir del 29 de Junio 2026</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Se habilitará al concluir el periodo de cursos (hasta el 26 de junio). Podrás generar tu constancia o reconocimiento de los cursos en que participaste.
                </p>
              </div>
            </div>

            {/* Cuenta regresiva */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center mb-3">Tiempo restante</p>
              <div className="flex justify-center gap-3">
                <UnitBox valor={dias}     label="Días"  />
                <div className="text-2xl font-bold text-gray-300 self-start mt-3">:</div>
                <UnitBox valor={horas}    label="Horas" />
                <div className="text-2xl font-bold text-gray-300 self-start mt-3">:</div>
                <UnitBox valor={minutos}  label="Min"   />
                <div className="text-2xl font-bold text-gray-300 self-start mt-3">:</div>
                <UnitBox valor={segundos} label="Seg"   />
              </div>
            </div>

            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-400 font-bold rounded-lg cursor-not-allowed text-sm border border-gray-200"
            >
              <Lock className="w-4 h-4" />
              Módulo no disponible aún
            </button>

            <p className="text-[10px] text-center text-gray-400">
              Se habilitará automáticamente el 29 de Junio de 2026
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTES UI
// ==========================================


const Login = ({ onLogin }) => {
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminStep, setAdminStep] = useState('clave'); // 'clave' | 'correo'
  const { dias, horas, minutos, segundos, abierto } = useCountdown(CONSTANCIAS_FECHA_APERTURA);

  // Doble click en logo → modal admin
  const handleLogoClick = () => {
    setAdminPass('');
    setAdminError('');
    setAdminEmail('');
    setAdminStep('clave');
    setShowAdminModal(true);
  };

  const handleAdminLogin = () => {
    if (adminStep === 'clave') {
      if (adminPass === ADMIN_PASSWORD) {
        setAdminError('');
        setAdminPass('');
        setAdminStep('correo');
      } else {
        setAdminError('Clave incorrecta.');
      }
    } else {
      const prefijo = adminEmail.replace(/@.*$/, '').trim();
      if (!prefijo) { setAdminError('Ingresa un usuario válido.'); return; }
      const emailFinal = prefijo + '@itdurango.edu.mx';
      const url = CONSTANCIAS_URL + '?email=' + encodeURIComponent(emailFinal);
      window.open(url, '_blank');
      setShowAdminModal(false);
      setAdminStep('clave');
      setAdminEmail('');
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
            // Clonar visualmente al espejo de tarjeta 2
            setTimeout(() => {
              const src = document.getElementById("googleSignInDiv");
              const mirror = document.getElementById("googleSignInMirror");
              if (src && mirror) { mirror.innerHTML = src.innerHTML; }
            }, 900);
        } catch (err) {
            console.error("Error initializing Google Btn", err);
            setError("Error al cargar servicios de Google.");
        }
    }
  }, []);

  const handleCredentialResponse = (response) => {
    const payload = decodeJwtResponse(response.credential);
    if (payload && payload.email) {
        const email = payload.email.toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(email);
        onLogin({ email, name: payload.name, picture: payload.picture, isAdmin });
    } else {
        setError('No se pudo verificar la identidad.');
    }
  };

  const S = {
    page: {
      minHeight:'100vh',
      background:'linear-gradient(150deg, #f8f4ec 0%, #efe7d5 45%, #e8f0f8 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'2rem 1rem',
      fontFamily:"'DM Sans','Inter',sans-serif",
      position:'relative', overflow:'hidden'
    },
    bgDeco: {
      position:'absolute', inset:0, pointerEvents:'none',
      background:'radial-gradient(ellipse 70% 50% at 15% 5%, rgba(107,26,42,.08) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 95%, rgba(26,58,92,.08) 0%, transparent 50%)'
    },
    header: {
      textAlign:'center', marginBottom:'2rem', position:'relative',
      animation:'fadeUp .5s cubic-bezier(.22,.68,0,1.2) both'
    },
    logoWrap: {
      position:'relative', width:84, height:84, margin:'0 auto 1rem'
    },
    logoRing: {
      position:'absolute', inset:-8, borderRadius:'50%',
      border:'1.5px solid rgba(196,154,53,.5)',
      animation:'ringPulse 2.8s ease-out infinite'
    },
    logoRing2: {
      position:'absolute', inset:-8, borderRadius:'50%',
      border:'1.5px solid rgba(196,154,53,.3)',
      animation:'ringPulse 2.8s 1.4s ease-out infinite'
    },
    logoImg: {
      width:'100%', height:'100%', objectFit:'contain', borderRadius:'50%',
      background:'#fff', padding:8,
      boxShadow:'0 4px 22px rgba(107,26,42,.2), 0 0 0 2.5px rgba(196,154,53,.65)'
    },
    h1: {
      fontFamily:"'Playfair Display','Georgia',serif",
      fontSize:'clamp(1.55rem,5vw,2.1rem)', fontWeight:900,
      color:'#3D0A14', margin:'0 0 .35rem', letterSpacing:'-.015em', lineHeight:1.15
    },
    sub: { fontSize:'.83rem', color:'#6B6B7B', margin:0 },
    grid: {
      display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(288px, 1fr))',
      gap:'1.1rem', width:'100%', maxWidth:760,
      animation:'fadeUp .55s .1s cubic-bezier(.22,.68,0,1.2) both'
    },
    card: (accent) => ({
      background:'#fff', borderRadius:22, overflow:'hidden',
      boxShadow:`0 4px 8px rgba(0,0,0,.04), 0 24px 52px ${accent}, 0 0 0 1px rgba(196,154,53,.12)`,
      display:'flex', flexDirection:'column'
    }),
    stripe: (g) => ({
      height:5, backgroundSize:'200% 100%',
      animation:'shimmer 4s linear infinite',
      background: g
    }),
    cardBody: { padding:'1.7rem 1.9rem', flex:1, display:'flex', flexDirection:'column' },
    iconWrap: (bg, shadow) => ({
      width:46, height:46, borderRadius:13, flexShrink:0,
      background: bg, display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow: shadow
    }),
    cardTitle: { fontWeight:700, fontSize:'1.02rem', color:'#1A1720', lineHeight:1.2 },
    cardSub:   { fontSize:'.74rem', color:'#6B6B7B', marginTop:'.08rem' },
    desc: { fontSize:'.82rem', color:'#5A5A6A', lineHeight:1.62, margin:'1rem 0 1.2rem' },
    lockBtn: {
      display:'flex', alignItems:'center', justifyContent:'center', gap:'.6rem',
      padding:'.84rem 1rem', borderRadius:12,
      border:'1.5px solid #e2e2e2', background:'#f7f7f7',
      color:'#9090A0', fontSize:'.83rem', fontWeight:500,
      cursor:'not-allowed', userSelect:'none', marginBottom:'.65rem'
    },
    countdown: {
      display:'flex', justifyContent:'center', alignItems:'flex-start', gap:'.45rem',
      padding:'.75rem', borderRadius:12,
      background:'rgba(26,58,92,.04)', border:'1px solid rgba(26,58,92,.09)',
      marginBottom:'.55rem'
    },
    unitBox: {
      background:'#1B396A', color:'#fff', borderRadius:9,
      width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:700, fontSize:'1rem', fontVariantNumeric:'tabular-nums',
      boxShadow:'0 2px 8px rgba(26,58,92,.22)'
    },
    unitLabel: {
      fontSize:'.54rem', color:'#9090A0', marginTop:'.22rem',
      letterSpacing:'.06em', textTransform:'uppercase', textAlign:'center'
    },
    colon: { color:'#C8C8D0', fontWeight:300, fontSize:'1rem', marginTop:'.35rem', lineHeight:1 },
    authNote: {
      display:'flex', alignItems:'center', justifyContent:'center', gap:'.35rem',
      fontSize:'.7rem', color:'#A0A0B0', marginTop:'.5rem'
    },
    footer: {
      marginTop:'1.8rem', textAlign:'center',
      fontSize:'.68rem', color:'rgba(80,65,55,.55)',
      animation:'fadeUp .5s .3s ease both', letterSpacing:'.02em'
    }
  };

  return (
    <div style={S.page}>
      <div style={S.bgDeco}/>

      {/* Modal acceso admin */}
      {showAdminModal && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'
        }} onClick={e => { if(e.target===e.currentTarget) setShowAdminModal(false); }}>
          <div style={{
            background:'#fff', borderRadius:18, overflow:'hidden',
            width:'100%', maxWidth:340,
            boxShadow:'0 24px 60px rgba(0,0,0,.25)',
            animation:'fadeUp .3s cubic-bezier(.22,.68,0,1.2) both'
          }}>
            <div style={{height:4, background:'linear-gradient(90deg,#3D0A14,#6B1A2A,#C49A35,#6B1A2A,#3D0A14)', backgroundSize:'200% 100%', animation:'shimmer 3s linear infinite'}}/>
            <div style={{padding:'1.6rem 1.8rem'}}>
              <div style={{textAlign:'center', marginBottom:'1.2rem'}}>
                <div style={{fontSize:'1.8rem', marginBottom:'.4rem'}}>{adminStep === 'clave' ? '🔐' : '👤'}</div>
                <div style={{fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'1.1rem', color:'#3D0A14'}}>Acceso Administrador</div>
                <div style={{fontSize:'.75rem', color:'#9090A0', marginTop:'.2rem'}}>
                  {adminStep === 'clave' ? 'Ingresa la clave de acceso' : '¿Para quién generas la constancia?'}
                </div>
              </div>
              {adminStep === 'clave' ? (
                <input
                  type="password"
                  value={adminPass}
                  onChange={e => { setAdminPass(e.target.value); setAdminError(''); }}
                  onKeyDown={e => e.key==='Enter' && handleAdminLogin()}
                  placeholder="••••••••"
                  autoFocus
                  style={{
                    width:'100%', padding:'.75rem 1rem',
                    border:`1.5px solid ${adminError ? '#e05050' : '#e0e0e0'}`,
                    borderRadius:10, fontSize:'.9rem',
                    fontFamily:"'DM Sans',sans-serif", outline:'none',
                    marginBottom:'.5rem', boxSizing:'border-box',
                    background: adminError ? '#fff5f5' : '#fff'
                  }}
                />
              ) : (
                <div style={{display:'flex', marginBottom:'.5rem'}}>
                  <input
                    type="text"
                    value={adminEmail}
                    onChange={e => { setAdminEmail(e.target.value.replace(/@.*$/,'')); setAdminError(''); }}
                    onKeyDown={e => e.key==='Enter' && handleAdminLogin()}
                    placeholder="usuario"
                    autoFocus
                    style={{
                      flex:1, padding:'.75rem 1rem',
                      border:`1.5px solid ${adminError ? '#e05050' : '#e0e0e0'}`,
                      borderRadius:'10px 0 0 10px', fontSize:'.9rem',
                      fontFamily:"'DM Sans',sans-serif", outline:'none',
                      boxSizing:'border-box', background: adminError ? '#fff5f5' : '#fff'
                    }}
                  />
                  <span style={{
                    padding:'.75rem .6rem', background:'#f3f4f6',
                    border:'1.5px solid #e0e0e0', borderLeft:'none',
                    borderRadius:'0 10px 10px 0', fontSize:'.72rem',
                    color:'#6b7280', whiteSpace:'nowrap', display:'flex', alignItems:'center'
                  }}>@itdurango.edu.mx</span>
                </div>
              )}
              {adminError && (
                <div style={{fontSize:'.73rem', color:'#c0392b', marginBottom:'.6rem', display:'flex', alignItems:'center', gap:'.3rem'}}>
                  <AlertCircle size={12}/> {adminError}
                </div>
              )}
              <button onClick={handleAdminLogin} style={{
                width:'100%', padding:'.75rem',
                background:'linear-gradient(135deg,#3D0A14,#922438)',
                color:'#F5E4A8', border:'none', borderRadius:10,
                fontFamily:"'DM Sans',sans-serif", fontWeight:700,
                fontSize:'.88rem', cursor:'pointer',
                boxShadow:'0 4px 14px rgba(107,26,42,.28)',
                marginBottom:'.6rem'
              }}>{adminStep === 'clave' ? 'Continuar' : 'Abrir constancias'}</button>
              <button onClick={() => { setShowAdminModal(false); setAdminStep('clave'); setAdminEmail(''); setAdminPass(''); setAdminError(''); }} style={{
                width:'100%', padding:'.55rem',
                background:'transparent', border:'1.5px solid #e8e8e8',
                borderRadius:10, fontFamily:"'DM Sans',sans-serif",
                fontSize:'.8rem', color:'#9090A0', cursor:'pointer'
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={{...S.logoWrap, cursor:'pointer'}} onClick={handleLogoClick} title="">
          <div style={S.logoRing}/>
          <div style={S.logoRing2}/>
          {logoError ? (
            <div style={{
              width:'100%', height:'100%', borderRadius:'50%',
              background:'linear-gradient(135deg,#3D0A14,#6B1A2A)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 22px rgba(107,26,42,.2), 0 0 0 2.5px rgba(196,154,53,.65)',
              flexDirection:'column', gap:2
            }}>
              <span style={{fontSize:'.65rem', fontWeight:900, color:'#F5E4A8', letterSpacing:'.1em', lineHeight:1}}>ITD</span>
              <span style={{fontSize:'.42rem', color:'rgba(245,228,168,.6)', letterSpacing:'.06em', lineHeight:1}}>DURANGO</span>
            </div>
          ) : (
            <img src={LOGO_URL} alt="ITD" style={S.logoImg}
              onError={() => setLogoError(true)}/>
          )}
        </div>
        <h1 style={S.h1}>
          Constancias y <em style={{fontStyle:'italic',color:'#922438'}}>Reconocimientos</em>
        </h1>
        <p style={S.sub}>Instituto Tecnológico de Durango — Portal ITD</p>
      </div>

      {/* Grid de tarjetas */}
      <div style={S.grid}>

        {/* Tarjeta 1: Mis Constancias */}
        <div style={S.card('rgba(107,26,42,.12)')}>
          <div style={S.stripe('linear-gradient(90deg,#3D0A14 0%,#6B1A2A 28%,#C49A35 50%,#6B1A2A 72%,#3D0A14 100%)')}/>
          <div style={S.cardBody}>
            <div style={{display:'flex',alignItems:'center',gap:'.85rem',marginBottom:'.2rem'}}>
              <div style={S.iconWrap('linear-gradient(135deg,#3D0A14,#922438)','0 3px 14px rgba(107,26,42,.28)')}>
                <FileText size={21} color="#F5E4A8"/>
              </div>
              <div>
                <div style={S.cardTitle}>Mis Constancias</div>
                <div style={S.cardSub}>Descarga tus documentos</div>
              </div>
            </div>

            <p style={S.desc}>
              Inicia sesión con tu cuenta <strong style={{color:'#1B396A'}}>@itdurango.edu.mx</strong> para ver y descargar tus constancias y reconocimientos.
            </p>

            {GOOGLE_CLIENT_ID === "TU_CLIENT_ID_AQUI.apps.googleusercontent.com" ? (
              <div style={{padding:'.85rem',background:'#fffbee',border:'1.5px solid rgba(196,154,53,.3)',borderRadius:12,fontSize:'.78rem',color:'#7A5500'}}>
                <strong>⚠ Configuración pendiente:</strong> agrega el GOOGLE_CLIENT_ID en main.js.
              </div>
            ) : (
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:'.6rem'}}>
                <div id="googleSignInDiv" style={{width:'100%',minHeight:44}}/>
                {error && (
                  <div style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.7rem .9rem',background:'#fef2f2',border:'1.5px solid rgba(220,80,80,.18)',borderRadius:10,fontSize:'.78rem',color:'#7A1E1E'}}>
                    <AlertCircle size={14}/> {error}
                  </div>
                )}
                <div style={S.authNote}>
                  <Lock size={11}/> Autenticación segura con Google
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tarjeta 2: Generar Constancia */}
        <div style={S.card('rgba(26,58,92,.1)')}>
          <div style={S.stripe('linear-gradient(90deg,#1B396A 0%,#2B5580 35%,#C49A35 55%,#2B5580 75%,#1B396A 100%)')}/>
          <div style={S.cardBody}>
            <div style={{display:'flex',alignItems:'center',gap:'.85rem',marginBottom:'.2rem'}}>
              <div style={S.iconWrap('linear-gradient(135deg,#1B396A,#2B5580)','0 3px 14px rgba(26,58,92,.25)')}>
                <Award size={21} color="#F5E4A8"/>
              </div>
              <div>
                <div style={S.cardTitle}>Generar Constancia</div>
                <div style={S.cardSub}>Cursos Enero–Junio 2026</div>
              </div>
            </div>

            <p style={S.desc}>
              Genera el PDF de tu constancia o reconocimiento de los cursos de actualización docente del periodo actual.
            </p>

            {abierto ? (
              <a href={CONSTANCIAS_URL} target="_blank" rel="noopener noreferrer" style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem',
                padding:'.85rem 1rem', borderRadius:12, textDecoration:'none',
                background:'linear-gradient(135deg,#3D0A14,#922438)',
                color:'#F5E4A8', fontWeight:700, fontSize:'.84rem',
                boxShadow:'0 4px 18px rgba(107,26,42,.3)', transition:'all .2s'
              }}>
                <Award size={15}/> Acceder a mis constancias
                <ExternalLink size={12} style={{marginLeft:'auto',opacity:.7}}/>
              </a>
            ) : (
              <>
                {/* Mismo recuadro Google clonado — bloqueado */}
                <div style={{ position:'relative', marginBottom:'.7rem' }}>
                  <div id="googleSignInMirror" style={{
                    width:'100%', minHeight:44, pointerEvents:'none', userSelect:'none'
                  }}/>
                  {/* Overlay con candado encima */}
                  <div style={{
                    position:'absolute', inset:0,
                    background:'rgba(250,247,242,.72)',
                    backdropFilter:'blur(1.5px)',
                    borderRadius:4,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    gap:'.45rem', cursor:'not-allowed'
                  }}>
                    <Lock size={13} color="#8888A0"/>
                    <span style={{
                      fontSize:'.8rem', fontWeight:600,
                      color:'#5A5A6A', letterSpacing:'.01em'
                    }}>Disponible el 29 de Jun 2026</span>
                  </div>
                </div>

                {/* Cuenta regresiva */}
                <div style={S.countdown}>
                  {[{v:dias,l:'días'},{v:horas,l:'hrs'},{v:minutos,l:'min'},{v:segundos,l:'seg'}].map(({v,l},i) => (
                    <React.Fragment key={l}>
                      {i > 0 && <span style={S.colon}>:</span>}
                      <div style={{textAlign:'center'}}>
                        <div style={S.unitBox}>{String(v).padStart(2,'0')}</div>
                        <div style={S.unitLabel}>{l}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                <p style={{textAlign:'center', fontSize:'.7rem', color:'#A0A0B0', margin:0}}>
                  Se habilitará al concluir el periodo de cursos
                </p>
              </>
            )}
          </div>
        </div>

      </div>

      <div style={S.footer}>
        © {new Date().getFullYear()} Dr. Alejandro Calderón Rentería — Coordinación Docente ITD
      </div>
    </div>
  );
};

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
        const isOwner    = item.correo === user.email;
        const isStatusOk = item.status === 'ENVIADO';
        if (!user.isAdmin && !(isOwner && isStatusOk)) return false;
        if (!user.isAdmin && !item.correo.includes('@')) return false;
        if (search) {
            const term = normalize(search);
            return (
                normalize(item.nombre).includes(term) ||
                normalize(item.curso).includes(term)  ||
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

  const handleDownloadClick = (item) => {
      console.log(`[Analytics] Descarga iniciada: ${item.curso} por ${user.email}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-3">
                    <img src={LOGO_URL} className="h-10 w-auto" alt="ITD" onError={(e) => e.target.style.display='none'}/>
                    <div className="h-8 w-px bg-gray-300 hidden sm:block mx-1"></div>
                    <div className="flex flex-col">
                        <span className="text-base md:text-lg font-bold text-itd-blue leading-tight">
                            Descarga de Constancias y Reconocimientos
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {user.picture ? (
                        <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-itd-blue text-white flex items-center justify-center text-xs font-bold">
                            {user.email.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="hidden md:flex flex-col items-end">
                         <span className="text-xs font-bold text-gray-700">{user.name || 'Usuario'}</span>
                         <span className="text-[10px] text-gray-500">{user.email}</span>
                    </div>
                    {user.isAdmin && <span className="bg-itd-red text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase ml-2">Admin</span>}
                    <button 
                        onClick={onLogout} 
                        className="ml-2 flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                        title="Salir"
                    >
                        <span className="text-sm font-medium hidden sm:inline">Salir</span>
                        <LogOut className="w-4 h-4"/>
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 w-full md:w-auto items-center">
                <span className="text-sm font-bold text-gray-500 uppercase">Año:</span>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full md:w-48 p-2.5">
                    {Object.keys(DATA_SOURCES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
            </div>
            <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-gray-400"/></div>
                <input 
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full pl-10 p-2.5" 
                    placeholder="Buscar por nombre, correo o documento..." 
                />
            </div>
            {user.isAdmin && (
                <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <Download className="w-4 h-4"/> Reporte
                </button>
            )}
        </div>

        {/* Error de lectura */}
        {errorStr && (
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm mb-8 animate-pulse">
                <div className="flex items-start">
                    <AlertTriangle className="w-8 h-8 text-red-600 mr-4 mt-1 flex-shrink-0" />
                    <div>
                        <h3 className="text-lg font-bold text-red-800 mb-2">Error de lectura</h3>
                        <p className="text-red-700 font-medium mb-3">{errorStr}</p>
                        <div className="mt-3 text-sm text-red-800 bg-white/50 p-3 rounded">
                            <strong>Ayuda:</strong>
                            <p className="mt-1">Revisa que el archivo <code>db_{year}.csv</code> esté en GitHub. Las columnas soportadas son: EmailAddress, FileAttachments, Codigo, Nombre, etc.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Lista de documentos */}
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-itd-blue border-t-transparent mb-4"></div>
                <p className="text-gray-500 font-medium">Cargando registros del {year}...</p>
            </div>
        ) : filteredData.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4">Nombre / Correo</div>
                    <div className="col-span-5">Documento</div>
                    <div className="col-span-3 text-right">Acciones</div>
                </div>
                <div>
                    {filteredData.map((item, index) => (
                        <div key={item.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-red-50'} hover:bg-blue-50`}>
                            <div className="col-span-1 md:col-span-4 flex items-start gap-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${index % 2 === 0 ? 'bg-blue-100 text-itd-blue' : 'bg-white text-itd-red border border-red-100'}`}>
                                    {item.nombre.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 text-sm truncate">{item.nombre}</p>
                                    <p className="text-xs text-gray-500 truncate">{item.correo}</p>
                                    <div className="md:hidden flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                                        <Calendar className="w-3 h-3" /> {item.fecha}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-5">
                                <div className="flex items-start gap-2">
                                     {user.isAdmin && (
                                        <div className="mt-1">
                                            {item.status === 'ENVIADO' ? 
                                                <CheckCircle className="w-4 h-4 text-green-500" /> : 
                                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                            }
                                        </div>
                                     )}
                                     <div>
                                        <h3 className="text-sm font-medium text-gray-800 leading-snug">{item.curso}</h3>
                                        <p className="hidden md:flex items-center gap-1 text-xs text-gray-400 mt-1">
                                            <Calendar className="w-3 h-3" /> {item.fecha}
                                        </p>
                                     </div>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-3 flex justify-start md:justify-end gap-2">
                                {item.link && item.link !== '#' && item.status === 'ENVIADO' ? (
                                    <>
                                        <button 
                                            onClick={() => handleShareEmail(item)}
                                            className="p-2 text-gray-500 hover:text-itd-blue hover:bg-blue-100 rounded-lg transition-colors"
                                            title="Enviar enlace por correo"
                                        >
                                            <Mail className="w-5 h-5" />
                                        </button>
                                        <a 
                                            href={item.link} target="_blank"
                                            onClick={() => handleDownloadClick(item)}
                                            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-itd-blue hover:text-itd-blue text-gray-600 text-xs font-bold rounded-lg transition-all shadow-sm group-hover:shadow-md"
                                        >
                                            <FileDown className="w-4 h-4"/> 
                                            <span>Descargar</span>
                                        </a>
                                    </>
                                ) : (
                                    <span className="text-xs text-gray-400 italic px-4 py-2 bg-gray-50 rounded border border-gray-100 w-full md:w-auto text-center">
                                        {item.status !== 'ENVIADO' ? 'No Aprobado, Revisar con su instructor' : 'No disponible'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ) : !loading && !errorStr && (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                <ShieldCheck className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Sin resultados</h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                    {search ? 'No encontramos coincidencias para tu búsqueda.' : 'No tienes documentos disponibles con estatus "ENVIADO" para este año.'}
                </p>
                {user.isAdmin && (
                   <div className="mt-6 inline-block px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 text-left">
                        <strong>Diagnóstico Admin:</strong><br/>
                        Leyendo archivo: <code>db_{year}.csv</code><br/>
                        Asegúrate que el archivo esté subido en GitHub en la carpeta raíz.
                   </div>
                )}
            </div>
        )}



      </main>

      <footer className="bg-itd-red text-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-sm font-medium">© {new Date().getFullYear()} Dr. Alejandro Calderón Rentería - Coordinación Docente</p>
        </div>
      </footer>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const handleLogout = () => { window.location.href = "https://da-itd.github.io/A/"; };
  return user ? <Dashboard user={user} onLogout={handleLogout} /> : <Login onLogin={setUser} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
