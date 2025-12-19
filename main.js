import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, Send, Search, LogOut, Calendar, Filter, X, Sparkles, ShieldCheck, Copy } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// ==========================================
// 1. CONFIGURACIÓN Y DATOS
// ==========================================

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSRQV8teF1KNHOAJfmp61EmHt6D0ladQb_A18c3gk9cN4RfrXUPiVw_CXLhAYJhZ9-PTHMcyVhdacI8";

const SHEET_CONFIGS = {
  '2024': { gid: '1692633094', year: '2024' },
  '2025': { gid: '0', year: '2025' },
  '2026': { gid: '123456789', year: '2026' }
};

const GEMINI_API_KEY = ""; 

// LISTA DE ADMINISTRADORES (Estricta)
const ADMIN_EMAILS = [
    'alejandro.calderon@itdurango.edu.mx',
    'coord_actualizaciondocente@itdurango.edu.mx'
];

// ==========================================
// 2. LOGICA Y SERVICIOS
// ==========================================

const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
};

// --- Mock Data ---
const getMockData = (year) => {
  // Datos de prueba por si falla la hoja de cálculo
  const mocks = [
    { id: `${year}-001`, nombre: 'Juan Perez', correo: 'juan.perez@itdurango.edu.mx', curso: 'Curso: React Avanzado', fecha: '15/01/2025', status: 'ENVIADO', link: '#', year: year },
    { id: `${year}-002`, nombre: 'Maria Gonzalez', correo: 'maria@gmail.com', curso: 'Taller de Liderazgo', fecha: '20/01/2025', status: 'PENDIENTE', link: '#', year: year },
  ];
  return mocks;
};

// --- Fetch Logic ---
const fetchSingleYear = async (year) => {
  const config = SHEET_CONFIGS[year];
  if (!config) return []; 

  const url = `${SHEET_BASE_URL}/pub?gid=${config.gid}&single=true&output=csv`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error de red");
    
    const text = await response.text();
    if (text.trim().startsWith('<!DOCTYPE html>')) throw new Error("HTML Response");

    const rows = parseCSV(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const idx = (name) => headers.findIndex(h => h.includes(name));

    // Mapeo de columnas (Inteligente)
    const nameIdx = idx('nombre') > -1 ? idx('nombre') : 0;
    const emailIdx = idx('correo') > -1 ? idx('correo') : idx('email') > -1 ? idx('email') : 1;
    const courseIdx = idx('curso') > -1 ? idx('curso') : idx('concepto') > -1 ? idx('concepto') : 2;
    const statusIdx = idx('status') > -1 ? idx('status') : idx('estatus') > -1 ? idx('estatus') : 4;
    const linkIdx = idx('link') > -1 ? idx('link') : idx('url') > -1 ? idx('url') : idx('pdf') > -1 ? idx('pdf') : 5;
    const dateIdx = idx('fecha') > -1 ? idx('fecha') : 3;

    return rows.slice(1).map((row, i) => {
      const curso = row[courseIdx] || 'Constancia General';
      const rawStatus = row[statusIdx] || 'PENDIENTE';
      // Generamos un "Código" basado en año e índice si no hay columna ID
      const codigo = `${year}-${String(i + 1).padStart(3, '0')}`;
      
      return {
        id: codigo, 
        nombre: row[nameIdx] || 'Sin Nombre',
        correo: (row[emailIdx] || '').trim(),
        curso: curso,
        fecha: row[dateIdx] || '',
        status: rawStatus.toUpperCase().trim(),
        link: row[linkIdx] || '#',
        year: year
      };
    }).filter(cert => cert.nombre !== 'Sin Nombre' && cert.correo.includes('@')); 

  } catch (error) {
    console.warn(`Error fetching ${year}, using mocks.`, error);
    return getMockData(year);
  }
};

const fetchCertificates = async (year) => {
  if (year === 'ALL') {
    const years = Object.keys(SHEET_CONFIGS);
    const promises = years.map(y => fetchSingleYear(y));
    const results = await Promise.all(promises);
    return results.flat();
  }
  return fetchSingleYear(year);
};

// --- Gemini Service ---
const askGemini = async (question, contextData) => {
  const key = GEMINI_API_KEY || (window.process?.env?.API_KEY);
  if (!key) return "La funcionalidad de IA requiere una API Key configurada.";

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const dataSummary = contextData.slice(0, 50).map(c => `- ${c.curso} (${c.year}): ${c.status}.`).join('\n');
    const prompt = `Usuario: "${question}". \nContexto de constancias: \n${dataSummary}`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Error al conectar con el asistente.";
  }
};

// ==========================================
// 3. COMPONENTES DE UI
// ==========================================

// --- Login Component (Estilo Google) ---
const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Google Button, 2: Email Input

  const handleSimulatedGoogleLogin = () => {
     setStep(2);
     setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
        const lowerEmail = email.toLowerCase().trim();
        
        // Verificar Dominio
        const validDomains = ['@itdurango.edu.mx', '@gmail.com'];
        const isValid = validDomains.some(d => lowerEmail.endsWith(d));

        if (!isValid) {
            setError('Solo se permiten cuentas @itdurango.edu.mx o @gmail.com');
            setIsLoading(false);
            return;
        }

        const isAdmin = ADMIN_EMAILS.includes(lowerEmail);
        onLogin({ email: lowerEmail, isAdmin });
        setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="flex justify-center mb-6">
            <img 
                src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" 
                alt="ITD Logo" 
                className="h-24 w-auto drop-shadow-sm"
            />
        </div>
        <h2 className="text-3xl font-extrabold text-itd-blue tracking-tight">
          Portal ITD
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Descarga de Constancias y Reconocimientos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden">
          
          {/* Decorative Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-itd-red to-itd-blue"></div>

          {step === 1 ? (
             <div className="space-y-6 pt-4">
                 <button 
                    onClick={handleSimulatedGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                 >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Iniciar sesión con Google
                 </button>
                 
                 <div className="text-center text-xs text-gray-400">
                    Acceso exclusivo para @itdurango.edu.mx y @gmail.com
                 </div>
             </div>
          ) : (
            <form className="space-y-6 pt-2 animate-in fade-in slide-in-from-right-8 duration-300" onSubmit={handleSubmit}>
                <div className="flex items-center mb-4">
                    <button type="button" onClick={() => setStep(1)} className="text-gray-400 hover:text-itd-blue mr-2">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                    <span className="text-sm font-semibold text-gray-700">Verifica tu identidad</span>
                </div>

                <div>
                <label htmlFor="email" className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Correo Electrónico
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue sm:text-sm transition-colors"
                    placeholder="usuario@itdurango.edu.mx"
                    />
                </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                    <div className="flex">
                        <div className="ml-3">
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    </div>
                    </div>
                )}

                <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-itd-blue transition-all disabled:opacity-70"
                >
                {isLoading ? 'Verificando permisos...' : 'Continuar'}
                </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Dashboard Component ---
const Dashboard = ({ user, onLogout }) => {
  const [yearFilter, setYearFilter] = useState('2025');
  const [searchTerm, setSearchTerm] = useState('');
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar datos
  useEffect(() => {
    const load = async () => {
        setLoading(true);
        const data = await fetchCertificates(yearFilter === 'TODOS' ? 'ALL' : yearFilter);
        setCertificates(data);
        setLoading(false);
    };
    load();
  }, [yearFilter]);

  // Lógica de Filtrado (Admin vs Usuario)
  const filteredData = useMemo(() => {
    return certificates.filter(cert => {
      // 1. Permisos
      const isOwner = cert.correo.toLowerCase() === user.email;
      
      if (!user.isAdmin) {
          // Usuario normal: Solo sus certificados Y que estén ENVIADOS
          if (!isOwner) return false;
          if (cert.status !== 'ENVIADO') return false; 
      }
      
      // 2. Búsqueda Restringida: SOLO Nombre o Código (ID)
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchesName = cert.nombre.toLowerCase().includes(term);
          const matchesCode = cert.id.toLowerCase().includes(term);
          
          if (!matchesName && !matchesCode) return false;
      }
      
      return true;
    });
  }, [certificates, user, searchTerm]);

  // Acciones de Administrador
  const handleAdminMail = (cert) => {
      const subject = `Tu constancia del ITD: ${cert.curso}`;
      const body = `Hola ${cert.nombre},\n\nSe adjunta el enlace para descargar tu constancia del curso "${cert.curso}" (${cert.year}).\n\nDescargar aquí: ${cert.link}\n\nAtentamente,\nCoordinación de Actualización Docente ITD.`;
      window.open(`mailto:${cert.correo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleCopyLink = (link) => {
      navigator.clipboard.writeText(link);
      alert("Enlace copiado al portapapeles");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
               <img src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" className="h-10 w-auto" alt="Logo" />
               <div className="hidden sm:block border-l pl-3 border-gray-300">
                 <h1 className="font-bold text-itd-blue leading-tight text-lg">Portal ITD</h1>
                 {user.isAdmin && <span className="text-[10px] uppercase tracking-wider bg-itd-red text-white px-2 py-0.5 rounded-full font-bold">Modo Admin</span>}
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right hidden sm:block">
                   <p className="text-xs text-gray-500">Sesión iniciada como</p>
                   <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{user.email}</p>
               </div>
               <button onClick={onLogout} className="text-gray-400 hover:text-itd-red p-2 rounded-full hover:bg-red-50 transition-colors" title="Cerrar Sesión">
                   <LogOut className="w-5 h-5"/>
               </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Panel de Control de Búsqueda */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Filtro Año */}
                <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Año</label>
                    <div className="relative">
                        <select 
                            value={yearFilter} 
                            onChange={e => setYearFilter(e.target.value)} 
                            className="block w-full pl-3 pr-8 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-itd-blue focus:border-itd-blue rounded-lg border bg-gray-50"
                        >
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2026">2026</option>
                            {user.isAdmin && <option value="TODOS">Todos (Histórico)</option>}
                        </select>
                    </div>
                </div>

                {/* Filtro Texto (Solo Nombre o Código) */}
                <div className="md:col-span-9">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Buscar por Nombre o Código
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder={user.isAdmin ? "Ej: Juan Perez o 2025-001" : "Buscar en mis documentos..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 text-sm border-gray-300 focus:ring-itd-blue focus:border-itd-blue rounded-lg border"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Resultados Header */}
        <div className="mb-4 px-1 flex justify-between items-end">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Documentos Disponibles</h2>
                <p className="text-sm text-gray-500">Mostrando {filteredData.length} resultados</p>
            </div>
            {user.isAdmin && (
                <div className="hidden md:flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-1 rounded-md border border-yellow-200 text-xs font-medium">
                    <ShieldCheck className="w-4 h-4"/> 
                    Vista de Administrador: Acceso total
                </div>
            )}
        </div>

        {loading ? (
             <div className="flex flex-col items-center py-20 bg-white rounded-xl border border-gray-100">
                 <div className="w-10 h-10 border-4 border-itd-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-gray-500 font-medium">Consultando base de datos...</p>
             </div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map(cert => (
                    <div key={cert.id} className={`bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden group ${cert.status !== 'ENVIADO' && user.isAdmin ? 'border-yellow-300 opacity-90' : 'border-gray-200'}`}>
                        {/* Indicador de Estado (Solo visual para Admin) */}
                        {user.isAdmin && (
                            <div className={`h-1.5 w-full flex`}>
                                <div className={`flex-1 ${cert.status === 'ENVIADO' ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                            </div>
                        )}
                        
                        <div className="p-5 flex-1 flex flex-col relative">
                            <div className="flex justify-between items-start mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600">
                                    {cert.id}
                                </span>
                                <span className="text-xs font-mono text-itd-blue bg-blue-50 px-2 py-1 rounded">{cert.year}</span>
                            </div>

                            <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug group-hover:text-itd-blue transition-colors">
                                {cert.curso}
                            </h3>
                            
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                    {cert.nombre.charAt(0)}
                                </div>
                                <p className="text-sm text-gray-700 font-medium truncate">{cert.nombre}</p>
                            </div>

                            <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
                                <div className="flex items-center text-xs text-gray-500">
                                    <Calendar className="w-3.5 h-3.5 mr-2 text-gray-400" /> 
                                    {cert.fecha || 'Sin fecha'}
                                </div>
                                {user.isAdmin && (
                                    <div className="flex items-center text-xs text-gray-500 truncate" title={cert.correo}>
                                        <Mail className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        {cert.correo}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            {/* Botón Descargar */}
                            {cert.link !== '#' ? (
                                <a 
                                    href={cert.link} 
                                    target="_blank"
                                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-itd-blue hover:bg-slate-800 transition-colors shadow-sm"
                                >
                                    <FileDown className="w-4 h-4 mr-2" />
                                    Descargar
                                </a>
                            ) : (
                                <span className="flex-1 inline-flex justify-center px-3 py-2 text-sm text-gray-400 bg-white border border-gray-200 rounded-md cursor-not-allowed">
                                    No disponible
                                </span>
                            )}

                            {/* Botones Admin */}
                            {user.isAdmin && (
                                <>
                                    <button 
                                        onClick={() => handleAdminMail(cert)}
                                        className="p-2 text-gray-500 hover:text-itd-blue bg-white border border-gray-200 rounded-md hover:shadow-sm"
                                        title="Enviar correo"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleCopyLink(cert.link)}
                                        className="p-2 text-gray-500 hover:text-green-600 bg-white border border-gray-200 rounded-md hover:shadow-sm"
                                        title="Copiar Link"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-900 font-medium text-lg">No se encontraron constancias</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs text-center">
                    Intenta buscar por otro nombre o verifica que el año seleccionado sea correcto.
                </p>
                {user.isAdmin && (
                    <p className="mt-4 text-xs text-yellow-600 bg-yellow-50 px-3 py-1 rounded border border-yellow-100">
                        Como admin, estás viendo registros de todos los usuarios.
                    </p>
                )}
            </div>
        )}
      </main>

      <AIChat certificates={filteredData} />
    </div>
  );
};

// --- Chat Bot Component ---
const AIChat = ({ certificates }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hola, soy el asistente virtual del ITD. ¿En qué te puedo ayudar hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => scrollToBottom(), [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        const response = await askGemini(userMsg, certificates);
        setMessages(prev => [...prev, { role: 'bot', text: response }]);
        setLoading(false);
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-itd-red text-white p-3.5 rounded-full shadow-lg hover:bg-red-700 transition-all z-50 flex items-center gap-2"
                >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-medium pr-1">Asistente</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-xl shadow-2xl z-50 border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200" style={{maxHeight: '500px'}}>
                    <div className="bg-itd-blue p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            <h3 className="font-bold text-sm">Asistente Virtual ITD</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 rounded p-1 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 h-80">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-itd-blue text-white rounded-br-none' : 'bg-white border text-gray-800 shadow-sm rounded-bl-none'}`}>{msg.text}</div>
                            </div>
                        ))}
                        {loading && <div className="text-xs text-gray-400 p-2 italic">Escribiendo...</div>}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 bg-white border-t flex gap-2">
                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Escribe tu duda..." className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-itd-blue focus:border-transparent" />
                        <button onClick={handleSend} disabled={loading} className="bg-itd-blue text-white p-2 rounded-full hover:bg-blue-900 transition-colors disabled:opacity-50"><Send className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
        </>
    );
};

// --- Error Boundary (Para evitar pantalla blanca total) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg">
                <h2 className="text-xl font-bold text-red-600 mb-2">Algo salió mal</h2>
                <p className="text-gray-600 mb-4">Por favor recarga la página. Si el problema persiste, contacta al administrador.</p>
                <code className="block bg-gray-100 p-2 rounded text-xs text-left overflow-auto mb-4">{this.state.error.toString()}</code>
                <button onClick={() => window.location.reload()} className="bg-itd-blue text-white px-4 py-2 rounded">Recargar</button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
