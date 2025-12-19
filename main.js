import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, LogOut, Search, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// ==========================================

// ID de tu Hoja de Cálculo proporcionada
const SPREADSHEET_ID = "1IXvv_gc9yER_LzM5JkxeIoxEO2dRU86jSyIgPZI1PJ8";

// Configuración de las pestañas (GIDs). 
// Asumimos que la primera hoja (gid=0) es 2025. 
// Si agregas más hojas para otros años, añade sus GID aquí.
const SHEET_CONFIGS = {
  '2025': { gid: '0', label: '2025' },
  '2024': { gid: '123456789', label: '2024 (Histórico)' }, // Cambiar GID real si existe
  '2026': { gid: '987654321', label: '2026 (Futuro)' }    // Cambiar GID real si existe
};

const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx' // Ejemplo, agregar los necesarios
];

// ==========================================
// UTILIDADES
// ==========================================

// Analizador de CSV robusto para leer la respuesta de Google Sheets
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

const fetchSheetData = async (year) => {
  const config = SHEET_CONFIGS[year];
  if (!config) return [];
  
  // URL de exportación CSV de Google Sheets
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${config.gid}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error conectando con Google Sheets");
    const text = await response.text();
    
    // Parsear CSV
    const rows = parseCSV(text);
    if (rows.length < 2) return []; // Solo encabezados o vacío

    // Mapeo dinámico de columnas basado en nombres (insensible a mayúsculas/minúsculas)
    // Busca columnas específicas mencionadas: Nombre, Correo, Status, URL (Link)
    const headers = rows[0].map(h => h.toLowerCase().trim());
    
    const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const idx = {
        nombre: getIdx(['nombre', 'participante', 'docente']),
        correo: getIdx(['correo', 'email', 'e-mail']),
        curso: getIdx(['curso', 'taller', 'reconocimiento', 'concepto']),
        fecha: getIdx(['fecha', 'periodo']),
        status: getIdx(['status', 'estatus', 'estado']),
        link: getIdx(['link', 'url', 'descarga', 'archivo', 'pdf'])
    };

    // Transformar filas en objetos limpios
    return rows.slice(1).map((r, i) => {
        return {
            id: i,
            nombre: idx.nombre !== -1 ? r[idx.nombre] : 'Participante',
            correo: idx.correo !== -1 ? (r[idx.correo] || '').trim().toLowerCase() : '',
            curso: idx.curso !== -1 ? r[idx.curso] : 'Documento ITD',
            fecha: idx.fecha !== -1 ? r[idx.fecha] : '',
            status: idx.status !== -1 ? (r[idx.status] || 'PENDIENTE').toUpperCase().trim() : 'PENDIENTE',
            link: idx.link !== -1 ? r[idx.link] : '',
            year: year
        };
    }).filter(item => item.correo && item.correo.includes('@')); // Solo filas con correo válido

  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
};

// ==========================================
// COMPONENTES
// ==========================================

// --- PANTALLA DE LOGIN ---
const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simular pequeña espera de red
    setTimeout(() => {
        const mail = email.trim().toLowerCase();
        
        // Validación de dominio
        const allowed = mail.endsWith('@itdurango.edu.mx') || mail.endsWith('@gmail.com');
        
        if (!allowed) {
            setError('Acceso denegado. Utilice un correo institucional (@itdurango.edu.mx) o Gmail.');
            setLoading(false);
            return;
        }

        const isAdmin = ADMIN_EMAILS.includes(mail);
        onLogin({ email: mail, isAdmin });
        setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-itd-red to-itd-blue h-2"></div>
        <div className="p-8">
            <div className="text-center mb-8">
                <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_ITD.png" 
                    className="h-24 mx-auto mb-4 object-contain" 
                    onError={(e) => {
                        e.target.style.display='none';
                        e.target.parentElement.innerHTML += '<h1 class="text-4xl font-bold text-itd-red mb-2">ITD</h1>';
                    }}
                    alt="Logo ITD" 
                />
                <h2 className="text-2xl font-bold text-gray-900">Portal de Constancias</h2>
                <p className="text-sm text-gray-500 mt-2">Instituto Tecnológico de Durango</p>
            </div>

            {step === 1 ? (
                <div className="space-y-4">
                    <button 
                        onClick={() => setStep(2)}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                         <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continuar con Google
                    </button>
                    <div className="text-center text-xs text-gray-400">
                        Solo para personal y alumnos autorizados
                    </div>
                </div>
            ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                    <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-itd-blue flex items-center mb-2">
                        <ArrowRight className="h-3 w-3 rotate-180 mr-1"/> Regresar
                    </button>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue sm:text-sm"
                                placeholder="usuario@itdurango.edu.mx"
                                required
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-blue-900 focus:outline-none transition-colors disabled:opacity-70"
                    >
                        {loading ? 'Verificando...' : 'Acceder'}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

// --- PANEL PRINCIPAL (DASHBOARD) ---
const Dashboard = ({ user, onLogout }) => {
  const [year, setYear] = useState('2025');
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Cargar datos al cambiar el año
  useEffect(() => {
    setLoading(true);
    fetchSheetData(year)
      .then(rows => {
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  // Filtrado de datos
  const filteredData = useMemo(() => {
    return data.filter(item => {
        // 1. Filtro de propiedad y status
        // - Admin ve todo.
        // - Usuario normal SOLO ve sus propios registros Y si Status == "ENVIADO"
        const isOwner = item.correo === user.email;
        const isReady = item.status === 'ENVIADO';
        
        const hasPermission = user.isAdmin || (isOwner && isReady);

        if (!hasPermission) return false;

        // 2. Filtro de búsqueda (texto)
        if (search) {
            const term = search.toLowerCase();
            return item.nombre.toLowerCase().includes(term) || 
                   item.curso.toLowerCase().includes(term);
        }

        return true;
    });
  }, [data, user, search]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-3">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_ITD.png" className="h-8 w-auto" alt="ITD Logo" />
                    <div className="hidden md:block w-px h-6 bg-gray-300"></div>
                    <div>
                        <h1 className="text-lg font-bold text-itd-blue leading-none">Portal ITD</h1>
                        <span className="text-xs text-gray-500">Constancias</span>
                    </div>
                    {user.isAdmin && <span className="ml-2 bg-itd-red text-white text-[10px] px-2 py-0.5 rounded-full font-bold">ADMIN</span>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                    </div>
                    <button onClick={onLogout} className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 transition-colors" title="Cerrar sesión">
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Barra de Herramientas */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="w-full md:w-auto flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Periodo:</label>
                <select 
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="block w-full md:w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-itd-blue focus:border-itd-blue sm:text-sm rounded-md bg-gray-50"
                >
                    {Object.entries(SHEET_CONFIGS).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
            </div>
            
            <div className="w-full md:w-96 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-itd-blue focus:border-itd-blue sm:text-sm"
                    placeholder="Buscar constancia..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
        </div>

        {/* Contenido Principal */}
        {loading ? (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-itd-blue"></div>
                <p className="mt-2 text-gray-500">Buscando registros...</p>
            </div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-itd-blue">
                                    <FileText className="h-6 w-6" />
                                </div>
                                {user.isAdmin && (
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded ${item.status === 'ENVIADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {item.status}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 line-clamp-2 mb-1">{item.curso}</h3>
                            <p className="text-sm text-gray-500 mb-3">{item.fecha}</p>
                            
                            <div className="pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-400 uppercase font-semibold">Participante</p>
                                <p className="text-sm text-gray-700 truncate">{item.nombre}</p>
                                {user.isAdmin && <p className="text-xs text-gray-400 truncate">{item.correo}</p>}
                            </div>
                        </div>
                        <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                            {item.link ? (
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-blue-900 focus:outline-none transition-colors"
                                >
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Descargar PDF
                                </a>
                            ) : (
                                <button disabled className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed">
                                    No disponible
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <ShieldCheck className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No hay documentos disponibles</h3>
                <p className="mt-1 text-sm text-gray-500">
                    {search ? 'No se encontraron resultados para tu búsqueda.' : 'Aún no tienes constancias con estatus "ENVIADO" para este periodo.'}
                </p>
            </div>
        )}

      </main>
    </div>
  );
};

// --- APP ROOT ---
const App = () => {
  const [user, setUser] = useState(null);

  return user ? (
    <Dashboard user={user} onLogout={() => setUser(null)} />
  ) : (
    <Login onLogin={setUser} />
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);