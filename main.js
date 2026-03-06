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
    <span className="text-xs uppercase tracking-widest text-gray-500 mt-1">{label}</span>
  </div>
);

const ADMIN_BYPASS_KEY = "Xela1615";

const ModuloAbierto = ({ user }) => (
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-green-800">¡El módulo está disponible!</p>
        <p className="text-xs text-green-700 mt-0.5">
          Haz clic en el botón para acceder con tu cuenta institucional.
          Tu sesión de Google ya está activa.
        </p>
      </div>
    </div>
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
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
      </div>
      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
    </div>
    <a
      href={`${CONSTANCIAS_URL}?email=${encodeURIComponent(user.email)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-itd-red hover:bg-red-800 text-white font-bold rounded-lg transition-colors shadow-sm text-sm"
    >
      <Award className="w-4 h-4" />
      Acceder a mis constancias
      <ExternalLink className="w-4 h-4 ml-auto opacity-70" />
    </a>
  </div>
);

const CardConstancias = ({ user }) => {
  const { dias, horas, minutos, segundos, abierto } = useCountdown(CONSTANCIAS_FECHA_APERTURA);
  const [bypassActivo, setBypassActivo]   = useState(false);
  const [mostrarInput, setMostrarInput]   = useState(false);
  const [inputClave, setInputClave]       = useState('');
  const [errorClave, setErrorClave]       = useState(false);

  const intentarBypass = () => {
    if (inputClave === ADMIN_BYPASS_KEY) {
      setBypassActivo(true);
      setMostrarInput(false);
      setErrorClave(false);
      setInputClave('');
    } else {
      setErrorClave(true);
      setInputClave('');
    }
  };

  const moduloVisible = abierto || bypassActivo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-itd-red to-itd-blue p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white bg-opacity-20 rounded-lg p-2">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Generación de Constancias</h2>
            <p className="text-white opacity-75 text-xs mt-0.5">Cursos del periodo Enero–Junio 2026</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {moduloVisible ? (
          <ModuloAbierto user={user} />
        ) : (
          // ── MÓDULO BLOQUEADO CON CUENTA REGRESIVA ──
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Disponible a partir del 29 de Junio 2026</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Este módulo estará activo una vez que concluya el periodo actual (cursos hasta el 26 de junio).
                  Podrás generar tus constancias de los cursos en los que participaste.
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

            <p className="text-xs text-center text-gray-400">
              Se habilitará automáticamente el 29 de Junio de 2026
            </p>

            {/* ── Bypass admin: solo visible para admins ── */}
            {user.isAdmin && !mostrarInput && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => { setMostrarInput(true); setErrorClave(false); }}
                  className="text-gray-300 hover:text-gray-400 transition-colors p-1 rounded"
                  title="Acceso administrador"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {user.isAdmin && mostrarInput && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Acceso administrador</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={inputClave}
                    onChange={(e) => { setInputClave(e.target.value); setErrorClave(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && intentarBypass()}
                    placeholder="Contraseña"
                    className={`flex-1 text-sm px-3 py-2 rounded-lg border ${errorClave ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'} outline-none focus:border-itd-blue transition-colors`}
                    autoFocus
                  />
                  <button
                    onClick={intentarBypass}
                    className="px-3 py-2 bg-itd-blue hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => { setMostrarInput(false); setInputClave(''); setErrorClave(false); }}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
                {errorClave && (
                  <p className="text-xs text-red-500 font-medium">Contraseña incorrecta.</p>
                )}
              </div>
            )}

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
  const { abierto } = useCountdown(CONSTANCIAS_FECHA_APERTURA);
  const [bypassActivo, setBypassActivo] = useState(false);
  const [mostrarInputBypass, setMostrarInputBypass] = useState(false);
  const [inputBypass, setInputBypass] = useState('');
  const [errorBypass, setErrorBypass] = useState(false);

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
        onLogin({ email: email, name: payload.name, picture: payload.picture, isAdmin });
    } else {
        setError('No se pudo verificar la identidad.');
    }
  };

  const intentarBypassLogin = () => {
    if (inputBypass === ADMIN_BYPASS_KEY) {
      setBypassActivo(true);
      setMostrarInputBypass(false);
      setErrorBypass(false);
      setInputBypass('');
    } else {
      setErrorBypass(true);
      setInputBypass('');
    }
  };

  const constanciasDesbloqueadas = abierto || bypassActivo;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">

      {/* Header institucional */}
      <div className="text-center mb-6">
        <img src={LOGO_URL} className="h-20 mx-auto mb-3 object-contain" alt="ITD Logo" onError={(e) => e.target.style.display='none'}/>
        <h1 className="text-2xl font-bold text-itd-blue">Constancias y Reconocimientos</h1>
        <p className="text-gray-500 text-sm mt-1">Instituto Tecnológico de Durango — Portal ITD</p>
      </div>

      {/* Dos tarjetas lado a lado */}
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Tarjeta 1: Ver documentos (login Google) ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-itd-blue to-itd-red h-0.5"></div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(27,57,106,0.1)'}}>
                <FileText className="w-5 h-5 text-itd-blue" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Mis Constancias</h2>
                <p className="text-xs text-gray-500">Descarga tus documentos</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Inicia sesión con tu cuenta institucional <span className="font-semibold text-itd-blue">@itdurango.edu.mx</span> para ver y descargar tus constancias y reconocimientos.
            </p>
            <div className="mt-auto space-y-3">
              {GOOGLE_CLIENT_ID === "TU_CLIENT_ID_AQUI.apps.googleusercontent.com" ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                  <strong className="flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5"/> Configuración pendiente</strong>
                  Agrega el <code>GOOGLE_CLIENT_ID</code> en main.js.
                </div>
              ) : (
                <>
                  <div id="googleSignInDiv" className="w-full flex justify-center min-h-10"></div>
                  <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3"/>
                    Autenticación segura con Google
                  </p>
                </>
              )}
              {error && (
                <div className="p-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>{error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tarjeta 2: Generar constancia (Apps Script) ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-itd-red to-itd-blue h-0.5"></div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(179,32,50,0.1)'}}>
                <Award className="w-5 h-5 text-itd-red" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Generar Constancia</h2>
                <p className="text-xs text-gray-500">Cursos Enero–Junio 2026</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Genera el PDF de tu constancia de participación de los cursos de actualización docente del periodo actual.
            </p>
            <div className="mt-auto space-y-3">
              {constanciasDesbloqueadas ? (
                <a
                  href={CONSTANCIAS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-itd-red hover:bg-red-800 text-white font-bold rounded-lg transition-colors text-sm"
                >
                  <Award className="w-4 h-4" />
                  Generar mi constancia
                  <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
                </a>
              ) : (
                <>
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 font-bold rounded-lg cursor-not-allowed text-sm border border-gray-200"
                  >
                    <Lock className="w-4 h-4" />
                    Disponible el 29 Jun 2026
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    Se habilitará al concluir el periodo de cursos
                  </p>
                  {/* Bypass admin: candado discreto solo visible si es admin (detectado por email en URL) */}
                  {!mostrarInputBypass && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => { setMostrarInputBypass(true); setErrorBypass(false); }}
                        className="text-gray-200 hover:text-gray-400 transition-colors p-1 rounded"
                        title=""
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {mostrarInputBypass && (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={inputBypass}
                          onChange={(e) => { setInputBypass(e.target.value); setErrorBypass(false); }}
                          onKeyDown={(e) => e.key === 'Enter' && intentarBypassLogin()}
                          placeholder="Contraseña"
                          className={`flex-1 text-sm px-3 py-2 rounded-lg border ${errorBypass ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'} outline-none focus:border-itd-blue transition-colors`}
                          autoFocus
                        />
                        <button
                          onClick={intentarBypassLogin}
                          className="px-3 py-2 bg-itd-blue hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => { setMostrarInputBypass(false); setInputBypass(''); setErrorBypass(false); }}
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      {errorBypass && <p className="text-xs text-red-500 font-medium">Contraseña incorrecta.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      <p className="text-xs text-gray-400 mt-6">
        © {new Date().getFullYear()} Dr. Alejandro Calderón Rentería — Coordinación Docente ITD
      </p>
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
                         <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                    {user.isAdmin && <span className="bg-itd-red text-white text-xs px-2 py-0.5 rounded font-bold uppercase ml-2">Admin</span>}
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
                        <div className="mt-3 text-sm text-red-800 bg-white bg-opacity-50 p-3 rounded">
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
                                    <div className="md:hidden flex items-center gap-1 mt-1 text-xs text-gray-400">
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
