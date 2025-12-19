import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Mail, ArrowRight, FileDown, Send, Search, LogOut, Calendar, Award, Filter, X, MessageCircle, Sparkles } from 'lucide-react';
import { fetchCertificates, notifyAdmin } from './services/dataService.js';
import { askGemini } from './services/geminiService.js';

/**
 * COMPONENTE: LOGIN
 */
const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
        const lowerEmail = email.toLowerCase();
        
        if (!lowerEmail.endsWith('@itdurango.edu.mx') && !lowerEmail.endsWith('@gmail.com')) {
            setError('El acceso está restringido a correos @itdurango.edu.mx o @gmail.com');
            setIsLoading(false);
            return;
        }

        if (lowerEmail.length < 5) {
            setError('Por favor ingresa un correo válido.');
            setIsLoading(false);
            return;
        }

        onLogin({ email: lowerEmail });
        setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <img 
            src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" 
            alt="ITD Logo" 
            className="mx-auto h-24 w-auto mb-6"
        />
        <h2 className="text-3xl font-extrabold text-itd-blue">
          Constancias y reconocimientos
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Coordinación de Actualización Docente
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200 sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue sm:text-sm placeholder-gray-400 transition-colors"
                  placeholder="ejemplo@itdurango.edu.mx"
                />
              </div>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">{error}</h3>
                        </div>
                    </div>
                </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-itd-blue hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-itd-blue transition-all disabled:opacity-70"
              >
                {isLoading ? 'Verificando...' : (
                    <React.Fragment>
                        Ingresar al Portal
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </React.Fragment>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Acceso Seguro
                </span>
              </div>
            </div>
            <div className="mt-6 text-center text-xs text-gray-400">
                Solo usuarios con constancias activas (Estatus ENVIADO) podrán descargar documentos.
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
                INSTITUTO TECNOLOGICO DE DURANGO <br/>
                Derechos reservados Desarrollo Acadèmico 2026
            </p>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENTE: AI CHAT
 */
const AIChat = ({ certificates }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hola, soy tu asistente virtual. ¿Tienes dudas sobre tus constancias?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

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
        <React.Fragment>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform z-50 flex items-center gap-2"
                >
                    <Sparkles className="w-6 h-6" />
                    <span className="font-semibold hidden md:inline">Asistente IA</span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl z-50 border border-gray-200 flex flex-col overflow-hidden" style={{maxHeight: '500px'}}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-bold text-sm">Asistente Virtual</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 h-80">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-800 shadow-sm'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-200 rounded-lg p-3 text-xs text-gray-500 animate-pulse">
                                    Escribiendo...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Pregunta algo..."
                            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={loading}
                            className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

/**
 * COMPONENTE: DASHBOARD
 */
const Dashboard = ({ user, onLogout }) => {
  const [yearFilter, setYearFilter] = useState('2025');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Available Years
  const years = ['2024', '2025', '2026'];

  useEffect(() => {
    notifyAdmin(user.email);
  }, [user.email]);

  // Fetch data when year changes
  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const data = await fetchCertificates(yearFilter === 'TODOS' ? 'ALL' : yearFilter);
        setCertificates(data);
        setLoading(false);
    };
    fetchData();
  }, [yearFilter]);

  // Compute unique types
  const availableTypes = useMemo(() => {
    const types = new Set(certificates.map(c => c.tipo));
    return Array.from(types).sort();
  }, [certificates]);

  // Filter Logic
  const filteredCertificates = useMemo(() => {
    return certificates.filter(cert => {
      // 1. Security Check: Email must match
      if (cert.correo.toLowerCase() !== user.email.toLowerCase()) return false;

      // 2. Status Check
      if (cert.status !== 'ENVIADO') return false;

      // 3. Type Filter
      if (typeFilter !== 'TODOS' && cert.tipo !== typeFilter) return false;

      // 4. Keyword Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
          cert.curso.toLowerCase().includes(searchLower) || 
          cert.nombre.toLowerCase().includes(searchLower) ||
          cert.fecha.includes(searchLower);

      return matchesSearch;
    });
  }, [certificates, user.email, typeFilter, searchTerm]);

  const handleEmailRequest = (cert) => {
    const subject = encodeURIComponent(`Consulta: ${cert.curso}`);
    const body = encodeURIComponent(`Hola, tengo una duda sobre: ${cert.curso} (${cert.year}).`);
    window.location.href = `mailto:admin@itdurango.edu.mx?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-4">
              <img 
                src="https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true" 
                alt="Logo ITD" 
                className="h-12 w-auto object-contain"
              />
              <div className="hidden md:block border-l pl-4 border-gray-300">
                <h1 className="text-lg font-bold text-itd-blue leading-tight">Constancias y reconocimientos</h1>
                <p className="text-xs text-gray-500 font-medium">Coordinación de Actualización Docente</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-700">{user.email}</p>
                  <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    En línea
                  </p>
              </div>
              <button 
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-itd-red hover:bg-red-50 rounded-full transition-all"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Mobile Header Title */}
        <div className="md:hidden mb-6 text-center">
             <h1 className="text-xl font-bold text-itd-blue">Constancias y reconocimientos</h1>
             <p className="text-sm text-gray-500">Coordinación de Actualización Docente</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
            <div className="flex items-center gap-2 mb-4 text-gray-700">
                <Filter className="w-5 h-5 text-itd-blue" />
                <h2 className="font-semibold">Búsqueda Avanzada</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Año</label>
                    <select 
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-itd-blue focus:border-itd-blue sm:text-sm rounded-lg border bg-gray-50"
                    >
                        <option value="2025">2025 (Actual)</option>
                        {years.filter(y => y !== '2025').map(y => <option key={y} value={y}>{y}</option>)}
                        <option value="TODOS">Todos los años</option>
                    </select>
                </div>

                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Tipo de Evento</label>
                    <select 
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-itd-blue focus:border-itd-blue sm:text-sm rounded-lg border bg-gray-50"
                    >
                        <option value="TODOS">Todos los tipos</option>
                        {availableTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-6">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Palabras Clave</label>
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-10 py-2.5 border-gray-300 rounded-lg focus:ring-itd-blue focus:border-itd-blue sm:text-sm border"
                            placeholder="Buscar por nombre del curso..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Results Info */}
        {!loading && (
            <div className="flex justify-between items-center mb-4 px-1">
                <span className="text-sm text-gray-500">
                    Mostrando <strong>{filteredCertificates.length}</strong> documentos
                    {yearFilter !== 'TODOS' && ` del año ${yearFilter}`}
                </span>
            </div>
        )}

        {/* Grid */}
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3,4].map(i => (
                    <div key={i} className="h-56 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between animate-pulse">
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                        <div className="h-10 bg-gray-200 rounded mt-4"></div>
                    </div>
                ))}
            </div>
        ) : filteredCertificates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCertificates.map(cert => (
                    <div key={cert.id} className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden flex flex-col transform hover:-translate-y-1">
                        <div className="relative h-2 bg-itd-blue"></div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-50 text-itd-blue uppercase tracking-wider">
                                    {cert.tipo}
                                </span>
                                <span className="text-xs font-mono text-gray-400 border px-1.5 py-0.5 rounded">
                                    {cert.year}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug group-hover:text-itd-blue transition-colors">
                                {cert.curso}
                            </h3>
                            
                            <div className="mt-auto space-y-2 pt-4">
                                <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                    <Calendar className="w-4 h-4 mr-2 text-itd-red" />
                                    <span>{cert.fecha || 'Sin fecha'}</span>
                                </div>
                                <div className="text-xs text-gray-400 uppercase font-medium truncate">
                                    {cert.nombre}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <a 
                                href={cert.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white shadow-sm transition-colors ${
                                    cert.link !== '#' 
                                    ? 'bg-itd-blue hover:bg-slate-800' 
                                    : 'bg-gray-300 cursor-not-allowed'
                                }`}
                                onClick={(e) => cert.link === '#' && e.preventDefault()}
                            >
                                <FileDown className="w-4 h-4 mr-2" />
                                {cert.link !== '#' ? 'Descargar' : 'No disponible'}
                            </a>
                            <button 
                                onClick={() => handleEmailRequest(cert)}
                                className="p-2 text-gray-500 hover:text-itd-blue hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                title="Reportar problema"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Sin resultados</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-sm">
                    No encontramos constancias con los filtros seleccionados para <strong>{user.email}</strong>.
                </p>
                <button 
                    onClick={() => { setYearFilter('TODOS'); setTypeFilter('TODOS'); setSearchTerm(''); }}
                    className="mt-6 text-itd-blue hover:text-itd-red text-sm font-medium transition-colors"
                >
                    Limpiar filtros
                </button>
            </div>
        )}
      </main>

      <footer className="bg-white border-t mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-gray-900 font-semibold text-sm">
                INSTITUTO TECNOLOGICO DE DURANGO
            </p>
            <p className="text-gray-500 text-xs mt-1">
                Derechos reservados Desarrollo Acadèmico 2026
            </p>
        </div>
      </footer>

      <AIChat certificates={filteredCertificates} />
    </div>
  );
};

/**
 * COMPONENTE: MAIN APP
 */
const App = () => {
  const [user, setUser] = useState(null);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <React.Fragment>
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </React.Fragment>
  );
};

// Mount Application
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);