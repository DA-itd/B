import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, LogOut, Search, ShieldCheck, AlertCircle, FileText, Download, AlertTriangle, Database, Lock } from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE GOOGLE (OBLIGATORIO)
// ==========================================
// Pega aquí tu ID de Cliente obtenido en Google Cloud Console
// Si no lo pones, el botón no se mostrará.
const GOOGLE_CLIENT_ID = "916349562772-08j3sv7m57d3a1ni3u69oufhhlp14g7o.apps.googleusercontent.com"; 

// ==========================================
// CONFIGURACIÓN LOCAL (GITHUB)
// ==========================================

const LOGO_URL = "https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true";

// CONFIGURACIÓN DE ARCHIVOS
const DATA_SOURCES = {
  '2026': './db_2026.csv',
  '2025': './db_2025.csv', 
  '2024': './db_2024.csv',
  '2023': './db_2023.csv'
};

const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx',
    'usuario@itdurango.edu.mx' 
];

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
    
    if (!text || text.trim().length === 0) {
        throw new Error("El archivo CSV está vacío.");
    }

    const rows = parseCSV(text);
    if (rows.length < 2) return { data: [], error: "El archivo CSV no tiene datos suficientes.", headersFound: [] };

    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => normalize(h));
    
    // Función de búsqueda flexible de columnas
    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(normalize(k))));

    // DICCIONARIO AMPLIADO DE COLUMNAS
    const idx = {
        nombre: findCol(['nombre', 'participante', 'docente', 'alumno', 'name']),
        correo: findCol(['emailaddress', 'correo', 'email', 'mail', 'e-mail']),
        curso: findCol(['codigo', 'curso', 'taller', 'reconocimiento', 'concepto', 'actividad', 'clave', 'code']),
        fecha: findCol(['año', 'fecha', 'periodo', 'year', 'date']),
        status: findCol(['status', 'estatus', 'estado']),
        link: findCol(['fileattachments', 'link', 'url', 'pdf', 'descarga', 'archivo', 'constancia'])
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
            id: i,
            nombre: idx.nombre !== -1 ? r[idx.nombre] : 'Usuario ITD',
            correo: (r[idx.correo] || '').trim().toLowerCase(),
            curso: idx.curso !== -1 ? r[idx.curso] : 'Documento ITD',
            fecha: idx.fecha !== -1 ? r[idx.fecha] : year,
            status: statusRaw.toUpperCase().trim(),
            link: idx.link !== -1 ? r[idx.link] : '',
            year: year
        };
    }).filter(item => item && item.correo && item.correo.includes('@'));

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
// COMPONENTES UI
// ==========================================

const Login = ({ onLogin }) => {
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Inicializar botón de Google si el script se cargó y tenemos un ID
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
        
        // Opcional: Validar dominio si deseas restringir solo a ITD o Gmail
        // const allowed = email.endsWith('@itdurango.edu.mx') || email.endsWith('@gmail.com');
        // if (!allowed) { setError('Dominio no permitido.'); return; }

        const isAdmin = ADMIN_EMAILS.includes(email);
        onLogin({ email: email, name: payload.name, picture: payload.picture, isAdmin });
    } else {
        setError('No se pudo verificar la identidad.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-itd-red to-itd-blue h-2"></div>
        <div className="p-8">
            <div className="text-center mb-8">
                <img src={LOGO_URL} className="h-24 mx-auto mb-4 object-contain" alt="ITD Logo" onError={(e) => e.target.style.display='none'}/>
                <h1 className="text-2xl font-bold text-gray-900">Portal ITD</h1>
                <p className="text-gray-500 text-sm">Descarga de Constancias Segura</p>
            </div>

            <div className="space-y-6">
                {GOOGLE_CLIENT_ID === "TU_CLIENT_ID_AQUI.apps.googleusercontent.com" ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        <strong className="block mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Configuración Pendiente</strong>
                        Para activar el inicio de sesión, el administrador debe agregar el <code>GOOGLE_CLIENT_ID</code> en el código (archivo main.js).
                    </div>
                ) : (
                    <>
                        <div id="googleSignInDiv" className="w-full flex justify-center min-h-[40px]"></div>
                        <p className="text-xs text-center text-gray-400">
                            <Lock className="w-3 h-3 inline mr-1"/>
                            Autenticación verificada por Google. Solo tú puedes ver tus documentos.
                        </p>
                    </>
                )}
                
                {error && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4"/>{error}
                    </div>
                )}
            </div>
        </div>
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
    if (!DATA_SOURCES[year]) {
        setAllData([]);
        return;
    }
    setLoading(true);
    setErrorStr(null);
    fetchLocalData(year)
      .then(res => {
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

        if (search) {
            const term = search.toLowerCase();
            return (
                item.nombre.toLowerCase().includes(term) || 
                item.curso.toLowerCase().includes(term) ||
                item.correo.includes(term)
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-3">
                    <img src={LOGO_URL} className="h-10 w-auto" alt="ITD" onError={(e) => e.target.style.display='none'}/>
                    <div className="h-8 w-px bg-gray-300 hidden sm:block mx-1"></div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold text-itd-blue leading-none">Portal ITD</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                             <Database className="w-3 h-3"/> Base de datos estática
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
                    <button onClick={onLogout} className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5"/></button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 w-full md:w-auto items-center">
                <span className="text-sm font-bold text-gray-500 uppercase">Año:</span>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full md:w-48 p-2.5">
                    {Object.keys(DATA_SOURCES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
            </div>
            <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-gray-400"/></div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full pl-10 p-2.5" placeholder="Buscar documento o código..." />
            </div>
            {user.isAdmin && (
                <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <Download className="w-4 h-4"/> Reporte
                </button>
            )}
        </div>

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

        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-itd-blue border-t-transparent mb-4"></div>
                <p className="text-gray-500 font-medium">Cargando registros del {year}...</p>
            </div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group">
                        <div className="p-5 flex-1 relative">
                            {user.isAdmin && (
                                <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold text-white rounded-bl-lg ${item.status === 'ENVIADO' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                    {item.status}
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-itd-blue group-hover:bg-itd-blue group-hover:text-white transition-colors">
                                    <FileText className="w-6 h-6"/>
                                </div>
                                <span className="text-xs text-gray-400 font-mono">{item.fecha}</span>
                            </div>
                            <h3 className="font-bold text-gray-900 leading-snug mb-2 line-clamp-2" title={item.curso}>{item.curso}</h3>
                            
                            <div className="mt-4 pt-3 border-t border-gray-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Otorgado a</p>
                                <div className="flex items-center">
                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 mr-2">
                                        {item.nombre.charAt(0)}
                                    </div>
                                    <p className="text-sm text-gray-700 truncate font-medium">{item.nombre}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                            {item.link && item.link !== '#' ? (
                                <a href={item.link} target="_blank" className="flex items-center justify-center w-full px-4 py-2.5 bg-itd-blue hover:bg-blue-900 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                                    <FileDown className="w-4 h-4 mr-2"/> Descargar Documento
                                </a>
                            ) : (
                                <button disabled className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">
                                    No disponible
                                </button>
                            )}
                        </div>
                    </div>
                ))}
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
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
