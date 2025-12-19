import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, LogOut, Search, Send, ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react';

// ==========================================
// 1. CONFIGURACIÓN Y DATOS
// ==========================================

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSRQV8teF1KNHOAJfmp61EmHt6D0ladQb_A18c3gk9cN4RfrXUPiVw_CXLhAYJhZ9-PTHMcyVhdacI8";

const SHEET_CONFIGS = {
  '2024': { gid: '1692633094', year: '2024' },
  '2025': { gid: '0', year: '2025' },
  '2026': { gid: '123456789', year: '2026' }
};

const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx'
];

// ==========================================
// 2. LOGICA DE DATOS
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

const fetchCertificates = async (year) => {
  if (year === 'ALL') {
    const years = Object.keys(SHEET_CONFIGS);
    const results = await Promise.all(years.map(y => fetchSingleYear(y)));
    return results.flat();
  }
  return fetchSingleYear(year);
};

const fetchSingleYear = async (year) => {
  const config = SHEET_CONFIGS[year];
  if (!config) return [];
  
  try {
    const response = await fetch(`${SHEET_BASE_URL}/pub?gid=${config.gid}&single=true&output=csv`);
    if (!response.ok) throw new Error("Error de red");
    const text = await response.text();
    
    // Si Google devuelve HTML (error o login), abortar
    if (text.trim().startsWith('<')) return []; 

    const rows = parseCSV(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const getIdx = (k) => headers.findIndex(h => h.includes(k));
    
    // Mapeo Inteligente de Columnas (busca variaciones comunes)
    const idx = {
        nombre: getIdx('nombre') !== -1 ? getIdx('nombre') : 0,
        correo: getIdx('correo') !== -1 ? getIdx('correo') : getIdx('email') !== -1 ? getIdx('email') : 1,
        curso: getIdx('curso') !== -1 ? getIdx('curso') : getIdx('concepto') !== -1 ? getIdx('concepto') : 2,
        fecha: getIdx('fecha') !== -1 ? getIdx('fecha') : 3,
        status: getIdx('status') !== -1 ? getIdx('status') : getIdx('estatus') !== -1 ? getIdx('estatus') : 4,
        link: getIdx('link') !== -1 ? getIdx('link') : getIdx('url') !== -1 ? getIdx('url') : 5
    };

    return rows.slice(1).map((r, i) => ({
      id: `${year}-${String(i+1).padStart(3,'0')}`,
      nombre: r[idx.nombre] || 'Sin Nombre',
      correo: (r[idx.correo] || '').trim(),
      curso: r[idx.curso] || 'Constancia General',
      fecha: r[idx.fecha] || '',
      status: (r[idx.status] || 'PENDIENTE').toUpperCase().trim(),
      link: r[idx.link] || '#',
      year
    })).filter(c => c.nombre !== 'Sin Nombre' && c.correo.includes('@'));
  } catch (e) {
    console.warn("Error cargando año:", year, e);
    return [];
  }
};

// ==========================================
// 3. COMPONENTES DE UI
// ==========================================

// --- Login ---
const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Botón Google, 2: Formulario Email

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
        const mail = email.toLowerCase().trim();
        // Validación de dominio
        const allowedDomains = ['@itdurango.edu.mx', '@gmail.com'];
        const isAllowed = allowedDomains.some(d => mail.endsWith(d));

        if (!isAllowed) {
            setError('Acceso restringido: Solo cuentas @itdurango.edu.mx o @gmail.com');
            setLoading(false);
            return;
        }

        const isAdmin = ADMIN_EMAILS.includes(mail);
        onLogin({ email: mail, isAdmin });
        setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" className="h-24 mx-auto mb-6 drop-shadow-sm" onError={(e)=>e.target.style.display='none'} alt="ITD Logo"/>
        <h2 className="text-3xl font-extrabold text-itd-blue tracking-tight">Portal ITD</h2>
        <p className="mt-2 text-sm text-gray-500">Descarga de Constancias y Reconocimientos</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200 sm:rounded-xl sm:px-10 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-itd-red to-itd-blue"></div>

          {step === 1 ? (
             <div className="space-y-6 pt-2">
                 <button 
                    onClick={() => setStep(2)}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-all shadow-sm group"
                 >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-5 w-5" alt="Google" />
                    <span className="group-hover:text-gray-900">Iniciar sesión con Google</span>
                 </button>
                 <div className="text-center">
                    <p className="text-xs text-gray-400">Acceso exclusivo para personal docente y administrativo</p>
                 </div>
             </div>
          ) : (
            <form className="space-y-6 pt-2" onSubmit={handleSubmit}>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-itd-blue flex items-center gap-1 mb-4">
                    <ArrowRight className="h-3 w-3 rotate-180" /> Regresar
                </button>
                
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Correo Electrónico</label>
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue sm:text-sm"
                            placeholder="usuario@itdurango.edu.mx"
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-itd-blue disabled:opacity-70 transition-colors"
                >
                    {loading ? 'Verificando...' : 'Acceder al Portal'}
                </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Dashboard ---
const Dashboard = ({ user, onLogout }) => {
  const [year, setYear] = useState('2025');
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCertificates(user.isAdmin && year === 'TODOS' ? 'ALL' : year).then(res => {
        setData(res);
        setLoading(false);
    });
  }, [year, user.isAdmin]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
        // Lógica de Permisos
        const isOwner = item.correo.toLowerCase() === user.email;
        // Si es Admin ve todo. Si es usuario, solo ve suyos que estén ENVIADO.
        const canView = user.isAdmin || (isOwner && item.status === 'ENVIADO');
        
        if (!canView) return false;

        // Lógica de Búsqueda
        if (search) {
            const term = search.toLowerCase();
            return item.nombre.toLowerCase().includes(term) || 
                   item.id.toLowerCase().includes(term) ||
                   item.curso.toLowerCase().includes(term);
        }
        return true;
    });
  }, [data, user, search]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12 font-sans">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
                <div className="flex items-center gap-3">
                    <img src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" className="h-9 w-auto" onError={(e)=>e.target.style.display='none'} alt="ITD"/>
                    <div className="hidden md:block w-px h-8 bg-gray-300 mx-1"></div>
                    <div className="flex flex-col">
                        <span className="font-bold text-itd-blue text-lg leading-none">Portal ITD</span>
                        <span className="text-xs text-gray-500">Constancias Digitales</span>
                    </div>
                    {user.isAdmin && (
                        <span className="ml-2 bg-itd-red text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Admin</span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    </div>
                    <button onClick={onLogout} className="p-2 text-gray-400 hover:text-itd-red bg-gray-50 hover:bg-red-50 rounded-full transition-colors" title="Cerrar Sesión">
                        <LogOut className="h-5 w-5"/>
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Año Académico</label>
                    <select 
                        value={year} 
                        onChange={(e) => setYear(e.target.value)} 
                        className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:ring-itd-blue focus:border-itd-blue rounded-lg bg-gray-50"
                    >
                        <option value="2025">2025 (Actual)</option>
                        <option value="2024">2024</option>
                        <option value="2026">2026</option>
                        {user.isAdmin && <option value="TODOS">Todos los periodos</option>}
                    </select>
                </div>
                <div className="md:col-span-9">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar Documento</label>
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-2.5 focus:ring-itd-blue focus:border-itd-blue" 
                            placeholder={user.isAdmin ? "Buscar por nombre, correo o folio..." : "Buscar mis constancias..."} 
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Lista de Documentos */}
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-itd-blue border-t-transparent mb-4"></div>
                <p className="text-gray-500 font-medium">Cargando registros...</p>
            </div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map((item) => (
                    <div key={item.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden">
                        <div className="p-5 flex-1 relative">
                            {user.isAdmin && (
                                <div className={`absolute top-0 right-0 px-2 py-1 text-[10px] font-bold text-white rounded-bl-lg ${item.status === 'ENVIADO' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                    {item.status}
                                </div>
                            )}
                            
                            <div className="flex items-center justify-between mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-itd-blue border border-blue-100 uppercase tracking-wider">
                                    {item.id}
                                </span>
                                <span className="text-xs text-gray-400 font-medium">{item.year}</span>
                            </div>

                            <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 group-hover:text-itd-blue transition-colors">
                                {item.curso}
                            </h3>
                            
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 mr-2">
                                    {item.nombre.charAt(0)}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{item.nombre}</p>
                            </div>

                            {user.isAdmin && (
                                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center text-xs text-gray-400">
                                    <Mail className="w-3 h-3 mr-1.5"/>
                                    <span className="truncate">{item.correo}</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 flex gap-3">
                            {item.link && item.link !== '#' ? (
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-itd-blue hover:bg-blue-900 transition-colors shadow-sm"
                                >
                                    <FileDown className="h-4 w-4 mr-2" /> Descargar
                                </a>
                            ) : (
                                <button disabled className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-gray-400 bg-white cursor-not-allowed">
                                    No disponible
                                </button>
                            )}
                            
                            {user.isAdmin && (
                                <button 
                                    onClick={() => window.open(`mailto:${item.correo}?subject=Constancia ITD&body=Hola ${item.nombre},%0D%0A%0D%0ATu constancia está lista: ${item.link}%0D%0A%0D%0ASaludos cordiales.`)}
                                    className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-itd-blue hover:border-itd-blue transition-colors"
                                    title="Enviar recordatorio por correo"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                <ShieldCheck className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No se encontraron constancias</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-sm">
                    No hay documentos disponibles con los filtros actuales. Verifica el año seleccionado o intenta otra búsqueda.
                </p>
                {user.isAdmin && year !== 'TODOS' && (
                    <button onClick={() => setYear('TODOS')} className="mt-4 text-sm text-itd-blue font-medium hover:underline">
                        Ver histórico completo
                    </button>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

// --- App Root ---
const App = () => {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);