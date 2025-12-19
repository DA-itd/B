import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, Send, Search, LogOut, Calendar, X, Sparkles, ShieldCheck, Copy } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSRQV8teF1KNHOAJfmp61EmHt6D0ladQb_A18c3gk9cN4RfrXUPiVw_CXLhAYJhZ9-PTHMcyVhdacI8";
const SHEET_CONFIGS = {
  '2024': { gid: '1692633094', year: '2024' },
  '2025': { gid: '0', year: '2025' },
  '2026': { gid: '123456789', year: '2026' }
};

// API Key para Gemini (ChatBot)
const GEMINI_API_KEY = ""; 

// Administradores
const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx'
];

// ==========================================
// 2. UTILIDADES
// ==========================================

const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') { currentField += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { currentRow.push(currentField); currentField = ''; }
    else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
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
    if (!response.ok) throw new Error("Error fetching");
    const text = await response.text();
    if (text.startsWith('<')) return []; // HTML Error

    const rows = parseCSV(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const getIdx = (k) => headers.findIndex(h => h.includes(k));
    
    // Indices
    const idx = {
        nombre: getIdx('nombre') !== -1 ? getIdx('nombre') : 0,
        correo: getIdx('correo') !== -1 ? getIdx('correo') : 1,
        curso: getIdx('curso') !== -1 ? getIdx('curso') : 2,
        fecha: getIdx('fecha') !== -1 ? getIdx('fecha') : 3,
        status: getIdx('status') !== -1 ? getIdx('status') : 4,
        link: getIdx('link') !== -1 ? getIdx('link') : 5
    };

    return rows.slice(1).map((r, i) => ({
      id: `${year}-${String(i+1).padStart(3,'0')}`,
      nombre: r[idx.nombre] || 'Sin Nombre',
      correo: (r[idx.correo] || '').trim(),
      curso: r[idx.curso] || 'Constancia',
      fecha: r[idx.fecha] || '',
      status: (r[idx.status] || 'PENDIENTE').toUpperCase().trim(),
      link: r[idx.link] || '#',
      year
    })).filter(c => c.nombre !== 'Sin Nombre' && c.correo.includes('@'));
  } catch (e) {
    console.warn("Error loading sheet:", e);
    return [];
  }
};

const askGemini = async (msg, context) => {
  if (!GEMINI_API_KEY) return "El chat requiere configurar una API Key.";
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const summary = context.slice(0, 30).map(c => `${c.curso} (${c.status})`).join(', ');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest',
      contents: `Usuario pregunta: "${msg}". Contexto: ${summary}. Responde brevemente.`
    });
    return response.text;
  } catch (e) { return "Lo siento, hubo un error de conexión."; }
};

// ==========================================
// 3. COMPONENTES
// ==========================================

const Login = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
        const mail = email.toLowerCase().trim();
        if (!mail.endsWith('@itdurango.edu.mx') && !mail.endsWith('@gmail.com')) {
            setError('Solo correos @itdurango.edu.mx o @gmail.com');
            setLoading(false);
            return;
        }
        onLogin({ email: mail, isAdmin: ADMIN_EMAILS.includes(mail) });
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-itd-blue h-2 w-full"></div>
        <div className="p-8 text-center">
          <img src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" className="h-20 mx-auto mb-4" alt="ITD" onError={e=>e.target.style.display='none'}/>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Portal ITD</h2>
          <p className="text-sm text-gray-500 mb-8">Constancias y Reconocimientos</p>

          {step === 1 ? (
            <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 p-3 rounded-lg hover:bg-gray-50 transition-all shadow-sm group">
               <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-5 w-5" alt="G" />
               <span className="text-gray-700 font-medium group-hover:text-gray-900">Iniciar sesión con Google</span>
            </button>
          ) : (
            <form onSubmit={handleLogin} className="text-left space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-itd-blue flex items-center gap-1 mb-2">
                    <ArrowRight className="w-3 h-3 rotate-180"/> Regresar
                </button>
                <div>
                    <label className="text-xs font-bold text-gray-600 uppercase">Correo Institucional o Gmail</label>
                    <div className="mt-1 relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400"/>
                        <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-itd-blue focus:border-transparent outline-none" 
                            placeholder="usuario@itdurango.edu.mx" />
                    </div>
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                <button disabled={loading} className="w-full bg-itd-blue text-white py-2.5 rounded-lg hover:bg-blue-900 transition-colors font-medium shadow-md disabled:opacity-70">
                    {loading ? 'Verificando...' : 'Acceder'}
                </button>
            </form>
          )}
          <p className="text-xs text-gray-400 mt-6">Sistema de Gestión Documental 2025</p>
        </div>
      </div>
    </div>
  );
};

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

  const filtered = useMemo(() => {
    return data.filter(d => {
        // Filtro de Permisos
        const isMine = d.correo.toLowerCase() === user.email;
        const canSee = user.isAdmin || (isMine && d.status === 'ENVIADO');
        if (!canSee) return false;

        // Filtro de Búsqueda
        if (search) {
            const s = search.toLowerCase();
            return d.nombre.toLowerCase().includes(s) || d.id.toLowerCase().includes(s);
        }
        return true;
    });
  }, [data, user, search]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <nav className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <img src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" className="h-8" onError={e=>e.target.style.display='none'}/>
                <div className="h-8 w-px bg-gray-300 mx-1"></div>
                <div>
                    <h1 className="font-bold text-itd-blue leading-tight">Portal ITD</h1>
                    {user.isAdmin && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded font-bold">ADMIN</span>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
                <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><LogOut className="w-5 h-5"/></button>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-gray-400 uppercase">Ciclo</label>
                <select value={year} onChange={e=>setYear(e.target.value)} className="w-full border rounded-lg p-2 bg-gray-50 text-sm">
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2026">2026</option>
                    {user.isAdmin && <option value="TODOS">Histórico Completo</option>}
                </select>
            </div>
            <div className="w-full md:w-3/4 relative">
                <label className="text-xs font-bold text-gray-400 uppercase">Buscar</label>
                <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400"/>
                <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre del docente o código..." 
                    className="w-full pl-9 pr-4 p-2 border rounded-lg text-sm focus:ring-1 focus:ring-itd-blue outline-none"/>
            </div>
        </div>

        {loading ? (
            <div className="text-center py-20 text-gray-400">
                <div className="animate-spin h-8 w-8 border-4 border-itd-blue border-t-transparent rounded-full mx-auto mb-2"></div>
                Cargando registros...
            </div>
        ) : filtered.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <p className="text-gray-500">No se encontraron documentos disponibles.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(cert => (
                    <div key={cert.id} className="bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                        <div className="p-4 flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">{cert.id}</span>
                                <span className="text-itd-blue text-xs font-mono">{cert.year}</span>
                            </div>
                            <h3 className="font-bold text-gray-800 leading-tight mb-2">{cert.curso}</h3>
                            <p className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-50 text-itd-blue flex items-center justify-center text-xs font-bold">{cert.nombre[0]}</span>
                                {cert.nombre}
                            </p>
                            {user.isAdmin && <p className="text-xs text-gray-400 mt-1 ml-7 truncate">{cert.correo}</p>}
                        </div>
                        <div className="bg-gray-50 p-3 border-t flex gap-2">
                            {cert.link !== '#' ? (
                                <a href={cert.link} target="_blank" className="flex-1 bg-itd-blue text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-900 transition-colors">
                                    <FileDown className="w-4 h-4"/> Descargar
                                </a>
                            ) : (
                                <button disabled className="flex-1 bg-gray-200 text-gray-400 text-sm font-medium py-2 rounded-lg cursor-not-allowed">No disponible</button>
                            )}
                            {user.isAdmin && (
                                <button onClick={() => window.open(`mailto:${cert.correo}?subject=Constancia ITD&body=Adjunto enlace: ${cert.link}`)} 
                                    className="p-2 bg-white border rounded-lg text-gray-500 hover:text-itd-blue hover:border-itd-blue transition-colors">
                                    <Send className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>

      {/* Chat Bot Flotante */}
      <ChatBot context={filtered} />
    </div>
  );
};

const ChatBot = ({ context }) => {
    const [open, setOpen] = useState(false);
    const [msgs, setMsgs] = useState([{role:'bot', text:'Hola, ¿tienes dudas sobre tus constancias?'}]);
    const [txt, setTxt] = useState('');
    const [wait, setWait] = useState(false);

    const send = async () => {
        if(!txt.trim()) return;
        const userTxt = txt;
        setTxt('');
        setMsgs(p => [...p, {role:'user', text:userTxt}]);
        setWait(true);
        const ans = await askGemini(userTxt, context);
        setMsgs(p => [...p, {role:'bot', text:ans}]);
        setWait(false);
    };

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
            {open && (
                <div className="bg-white w-80 h-96 rounded-2xl shadow-2xl border mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                    <div className="bg-itd-blue p-3 text-white flex justify-between items-center">
                        <span className="font-bold text-sm">Asistente Virtual</span>
                        <button onClick={()=>setOpen(false)}><X className="w-4 h-4"/></button>
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto bg-gray-50 space-y-3">
                        {msgs.map((m,i) => (
                            <div key={i} className={`p-2 rounded-xl text-xs max-w-[85%] ${m.role==='user'?'ml-auto bg-itd-blue text-white rounded-br-none':'bg-white border text-gray-700 rounded-bl-none'}`}>
                                {m.text}
                            </div>
                        ))}
                        {wait && <div className="text-xs text-gray-400 p-2">Escribiendo...</div>}
                    </div>
                    <div className="p-2 border-t bg-white flex gap-2">
                        <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} className="flex-1 border rounded-full px-3 text-sm focus:outline-none focus:border-itd-blue" placeholder="Pregunta algo..." />
                        <button onClick={send} className="bg-itd-blue text-white p-2 rounded-full"><Send className="w-3 h-3"/></button>
                    </div>
                </div>
            )}
            <button onClick={()=>setOpen(!open)} className="bg-itd-red hover:bg-red-700 text-white p-4 rounded-full shadow-lg transition-all">
                <Sparkles className="w-6 h-6"/>
            </button>
        </div>
    );
};

// Componente Principal
const App = () => {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={()=>setUser(null)} /> : <Login onLogin={setUser} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);