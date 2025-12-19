import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, LogOut, Search, ShieldCheck, AlertCircle, FileText, Download, AlertTriangle } from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// ==========================================

// ID de tu Hoja de Cálculo
const SPREADSHEET_ID = "1IXvv_gc9yER_LzM5JkxeIoxEO2dRU86jSyIgPZI1PJ8";

// Configuración de las pestañas.
// IMPORTANTE: Asegúrate de que el GID coincida con el de la URL de tu hoja cuando seleccionas la pestaña.
const SHEET_CONFIGS = {
  '2025': { gid: '0', label: '2025 (Actual)' },
  '2024': { gid: '123456789', label: '2024' }, // Reemplaza con el GID real de la pestaña 2024
  '2026': { gid: '987654321', label: '2026' }  // Reemplaza con el GID real de la pestaña 2026
};

// Correos de administradores (tienen acceso total y herramientas de reporte)
const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx',
    'usuario@gmail.com' // Agrega tu gmail de pruebas aquí si lo necesitas
];

// ==========================================
// LÓGICA DE DATOS
// ==========================================

const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i+1] === '"') { currentField += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { currentRow.push(currentField); currentField = ''; }
    else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && text[i+1] === '\n') i++;
      currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = '';
    } else { currentField += char; }
  }
  if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
  return rows;
};

// Función auxiliar para normalizar texto (quitar acentos y minúsculas) para comparar headers
const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

const fetchSheetData = async (year) => {
  const config = SHEET_CONFIGS[year];
  if (!config) return { data: [], error: null, headersFound: [] };
  
  // URL compatible con CORS y JSONP indirecto vía CSV
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${config.gid}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error ${response.status}: No se pudo acceder a la hoja.`);
    const text = await response.text();
    
    // Si devuelve HTML (ej. página de login de Google), es un error de permisos
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("La hoja no es pública. Ve a Archivo > Compartir > Cualquier persona con el enlace.");
    }

    const rows = parseCSV(text);
    if (rows.length < 2) return { data: [], error: "La hoja parece estar vacía o sin encabezados.", headersFound: [] };

    // Detección "Fuzzy" de columnas
    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => normalize(h));
    
    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(normalize(k))));

    const idx = {
        nombre: findCol(['nombre', 'participante', 'docente', 'alumno']),
        correo: findCol(['correo', 'email', 'mail']),
        curso: findCol(['curso', 'taller', 'reconocimiento', 'concepto', 'actividad']),
        fecha: findCol(['fecha', 'periodo', 'año']),
        status: findCol(['status', 'estatus', 'estado']),
        link: findCol(['link', 'url', 'pdf', 'descarga', 'archivo', 'constancia'])
    };

    // Validación crítica: Si no encuentra Nombre o Correo, algo anda mal
    if (idx.correo === -1) {
        return { 
            data: [], 
            error: "No se encontró la columna 'Correo'. Verifica los encabezados de tu hoja.",
            headersFound: rawHeaders
        };
    }

    const cleanData = rows.slice(1).map((r, i) => {
        const statusRaw = idx.status !== -1 ? (r[idx.status] || '') : 'ENVIADO'; // Si no hay columna status, asume ENVIADO por defecto o ajusta a PENDIENTE
        return {
            id: i,
            nombre: idx.nombre !== -1 ? r[idx.nombre] : 'Usuario ITD',
            correo: (r[idx.correo] || '').trim().toLowerCase(),
            curso: idx.curso !== -1 ? r[idx.curso] : 'Documento General',
            fecha: idx.fecha !== -1 ? r[idx.fecha] : year,
            status: statusRaw.toUpperCase().trim(),
            link: idx.link !== -1 ? r[idx.link] : '',
            year: year
        };
    }).filter(item => item.correo && item.correo.includes('@')); // Solo filas con email válido

    return { data: cleanData, error: null, headersFound: rawHeaders };

  } catch (error) {
    console.error(error);
    return { data: [], error: error.message, headersFound: [] };
  }
};

// ==========================================
// COMPONENTES UI
// ==========================================

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
        const mail = email.trim().toLowerCase();
        // Permitir ITD y Gmail
        const allowed = mail.endsWith('@itdurango.edu.mx') || mail.endsWith('@gmail.com');
        
        if (!allowed) {
            setError('Solo se permite acceso con correos @itdurango.edu.mx o @gmail.com');
            setLoading(false);
            return;
        }

        const isAdmin = ADMIN_EMAILS.includes(mail);
        onLogin({ email: mail, isAdmin });
        setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-itd-red to-itd-blue h-2"></div>
        <div className="p-8">
            <div className="text-center mb-8">
                <img src="https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_ITD.png" className="h-20 mx-auto mb-4 object-contain" onError={(e)=>e.target.style.display='none'} alt="ITD"/>
                <h1 className="text-2xl font-bold text-gray-900">Constancias ITD</h1>
                <p className="text-gray-500 text-sm mt-1">Descarga tus documentos digitales</p>
            </div>

            {step === 1 ? (
                <div className="space-y-4">
                    <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                         <Mail className="w-5 h-5 text-gray-500" />
                         Ingresar con Correo
                    </button>
                    <p className="text-xs text-center text-gray-400">Disponible para personal y alumnos</p>
                </div>
            ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                    <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-itd-blue flex items-center mb-2">
                        <ArrowRight className="h-3 w-3 rotate-180 mr-1"/> Regresar
                    </button>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Institucional o Gmail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue"
                            placeholder="usuario@itdurango.edu.mx"
                            required
                            autoFocus
                        />
                    </div>
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5"/>{error}</div>}
                    <button type="submit" disabled={loading} className="w-full py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-blue-900 disabled:opacity-70">
                        {loading ? 'Verificando...' : 'Acceder'}
                    </button>
                </form>
            )}
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
    setLoading(true);
    setErrorStr(null);
    fetchSheetData(year)
      .then(res => {
        setAllData(res.data);
        setHeaders(res.headersFound);
        if (res.error) setErrorStr(res.error);
        setLoading(false);
      })
      .catch(err => {
          setErrorStr("Error desconocido al cargar datos.");
          setLoading(false);
      });
  }, [year]);

  const filteredData = useMemo(() => {
    // Si hay un error crítico, no mostrar nada
    if (errorStr && allData.length === 0) return [];

    return allData.filter(item => {
        // Lógica de Permisos:
        // Admin: Ve TODO.
        // Usuario: Ve SOLO si coincide correo Y status es 'ENVIADO'.
        const isOwner = item.correo === user.email;
        const isStatusOk = item.status === 'ENVIADO';
        
        // Si no es admin y no cumple condiciones, fuera.
        if (!user.isAdmin && !(isOwner && isStatusOk)) return false;

        // Filtro de Búsqueda
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

  // Función para descargar reporte (Solo Admin)
  const downloadReport = () => {
    if (!filteredData.length) return;
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Nombre,Correo,Curso,Fecha,Status,Link\n"
        + filteredData.map(e => `"${e.nombre}","${e.correo}","${e.curso}","${e.fecha}","${e.status}","${e.link}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_accesos_${year}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-3">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_ITD.png" className="h-8 w-auto" alt="ITD" />
                    <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
                    <div>
                        <h1 className="text-lg font-bold text-itd-blue leading-tight">Portal ITD</h1>
                        <span className="text-xs text-gray-500 block">Sistema de Constancias</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 hidden md:block">{user.email}</span>
                    {user.isAdmin && <span className="bg-itd-red text-white text-[10px] px-2 py-1 rounded font-bold">ADMIN</span>}
                    <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full"><LogOut className="w-5 h-5"/></button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controles */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 w-full md:w-auto">
                <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full p-2.5">
                    {Object.entries(SHEET_CONFIGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>
            <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-gray-400"/></div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-itd-blue focus:border-itd-blue block w-full pl-10 p-2.5" placeholder="Buscar por nombre o curso..." />
            </div>
            {user.isAdmin && (
                <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <Download className="w-4 h-4"/> Descargar Lista
                </button>
            )}
        </div>

        {/* Mensaje de Error / Diagnóstico */}
        {errorStr && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0"/>
                    <div>
                        <h3 className="text-red-800 font-bold mb-1">Problema detectado</h3>
                        <p className="text-red-700 text-sm mb-3">{errorStr}</p>
                        {headers.length > 0 && user.isAdmin && (
                            <div className="bg-white p-3 rounded border border-red-100 text-xs text-gray-600 font-mono">
                                <strong>Columnas encontradas en la hoja:</strong> {headers.join(", ")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Lista de Resultados */}
        {loading ? (
            <div className="text-center py-12">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-itd-blue rounded-full mb-2"></div>
                <p className="text-gray-500 text-sm">Cargando datos...</p>
            </div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all flex flex-col overflow-hidden group">
                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-itd-blue group-hover:bg-itd-blue group-hover:text-white transition-colors">
                                    <FileText className="w-6 h-6"/>
                                </div>
                                {user.isAdmin && (
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.status === 'ENVIADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {item.status}
                                    </span>
                                )}
                            </div>
                            <h3 className="font-bold text-gray-900 leading-tight mb-2">{item.curso}</h3>
                            <p className="text-sm text-gray-500 mb-4">{item.fecha}</p>
                            <div className="pt-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-400 uppercase">Otorgado a</p>
                                <p className="text-sm text-gray-800 truncate">{item.nombre}</p>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                            {item.link ? (
                                <a href={item.link} target="_blank" className="flex items-center justify-center w-full px-4 py-2 bg-itd-blue hover:bg-blue-900 text-white text-sm font-medium rounded-lg transition-colors">
                                    <FileDown className="w-4 h-4 mr-2"/> Descargar PDF
                                </a>
                            ) : (
                                <button disabled className="w-full px-4 py-2 bg-gray-200 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">No disponible</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <ShieldCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No se encontraron constancias</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
                    {search ? 'No hay resultados para tu búsqueda.' : 'No tienes documentos disponibles con estatus "ENVIADO" en este periodo.'}
                </p>
                {user.isAdmin && (
                    <p className="text-xs text-itd-red mt-4 bg-red-50 inline-block px-3 py-1 rounded">
                        Admin: Si ves esto, revisa que el correo en la hoja coincida exactamente y que el Status sea 'ENVIADO'.
                    </p>
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
