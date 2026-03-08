import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
const LOGO_URL = "https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true";
const ADMIN_EMAIL = "alejandro.calderon@itdurango.edu.mx";

// Google Drive folder donde se guardan los PDFs generados
// Reemplaza con el ID real de tu carpeta en Drive
const DRIVE_FOLDER_ID = "1ZSvT7fvVDGZ9Cqyi3ur4sIuumuaLT0zZ";

// Google Apps Script Web App URL para subir PDFs a Drive y enviar correos
// Necesitas crear este Apps Script y pegar la URL aquí
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxtt1oKbMYo5t7X9ZIIDoeZ0RTVDOFuNPacN6cKzQllNVJDqxPP569GKX6jqbDKmvwnRA/exec";

// ==========================================
// ALMACENAMIENTO LOCAL (simula base de datos)
// Admin gestiona usuarios en localStorage
// ==========================================
const STORAGE_KEY_USERS   = "itd_constancias_users";
const STORAGE_KEY_SESSION = "itd_constancias_session";

const getUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
};

const saveUsers = (users) => {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
};

const getSession = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveSession = (user) => {
  sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));
};

const clearSession = () => {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
};

// Genera hash simple para contraseñas (en producción usar bcrypt vía backend)
const simpleHash = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
};

// ==========================================
// GENERADOR DE DATOS QR
// Formato: DA+NombreCompleto+FechaCreacion
// ==========================================

/**
 * Construye el string de datos que se codifica en el QR.
 * Ejemplo: "DA+Juan García López+2026-03-08"
 */
const buildQRData = (nombre, fechaCreacion) => {
  // fechaCreacion en formato ISO YYYY-MM-DD para estandarizar
  const fechaISO = fechaCreacion || new Date().toISOString().split('T')[0];
  return `DA+${nombre}+${fechaISO}`;
};

/**
 * Devuelve la URL de la imagen QR usando la API pública de QR Server.
 * No requiere clave de API. Tamaño 100x100px, sin márgenes.
 */
const getQRImageURL = (nombre, fechaCreacion) => {
  const data = buildQRData(nombre, fechaCreacion);
  const encoded = encodeURIComponent(data);
  // qrserver.com — API pública, sin límite razonable de uso
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=4&data=${encoded}`;
};

// ==========================================
// PLANTILLA DE CONSTANCIA (HTML → PDF)
// Basada en la plantilla del ITD
// ==========================================
const buildConstanciaHTML = ({ nombre, tipo, descripcion, fecha, firmante, cargo, fechaCreacion }) => {
  const qrUrl   = getQRImageURL(nombre, fechaCreacion);
  const qrData  = buildQRData(nombre, fechaCreacion);
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Lato:wght@300;400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:794px; height:1123px;
    font-family:'Lato',sans-serif;
    background:#fff;
    position:relative;
    overflow:hidden;
  }
  .border-outer {
    position:absolute; inset:18px;
    border:3px solid #8B1A2A;
    border-radius:4px;
  }
  .border-inner {
    position:absolute; inset:24px;
    border:1px solid #C49A35;
    border-radius:2px;
  }
  .corner {
    position:absolute; width:40px; height:40px;
    background:linear-gradient(135deg,#8B1A2A,#C49A35);
  }
  .corner.tl { top:14px; left:14px; clip-path:polygon(0 0,100% 0,0 100%); }
  .corner.tr { top:14px; right:14px; clip-path:polygon(100% 0,100% 100%,0 0); }
  .corner.bl { bottom:14px; left:14px; clip-path:polygon(0 0,100% 100%,0 100%); }
  .corner.br { bottom:14px; right:14px; clip-path:polygon(100% 0,100% 100%,0 100%); }
  .content {
    position:relative; z-index:10;
    height:100%; display:flex; flex-direction:column;
    align-items:center; padding:55px 80px 50px;
  }
  .logo-row {
    display:flex; align-items:center; gap:18px;
    margin-bottom:14px;
  }
  .logo-img { width:70px; height:70px; object-fit:contain; }
  .inst-text { text-align:left; }
  .inst-name {
    font-size:13px; font-weight:700; color:#3D0A14;
    letter-spacing:.06em; text-transform:uppercase;
  }
  .inst-sub {
    font-size:10px; color:#888; letter-spacing:.04em;
    text-transform:uppercase; margin-top:2px;
  }
  .divider-gold {
    width:100%; height:2px;
    background:linear-gradient(90deg,transparent,#C49A35,transparent);
    margin:10px 0;
  }
  .doc-type {
    font-size:11px; letter-spacing:.3em; color:#8B1A2A;
    text-transform:uppercase; font-weight:700;
    margin:18px 0 8px;
  }
  .title-word {
    font-family:'Playfair Display',serif;
    font-size:52px; font-weight:700; color:#3D0A14;
    letter-spacing:.02em; line-height:1;
    margin-bottom:22px;
  }
  .body-text {
    text-align:center; font-size:14px; color:#444;
    line-height:1.85; max-width:580px;
  }
  .recipient-name {
    font-family:'Playfair Display',serif;
    font-size:32px; font-weight:700; font-style:italic;
    color:#1B396A; display:block; margin:16px 0 6px;
    border-bottom:1.5px solid #C49A35;
    padding-bottom:8px; width:100%; text-align:center;
  }
  .activity-name {
    font-size:16px; font-weight:700; color:#3D0A14;
    margin:8px 0 4px; text-align:center;
  }
  .description {
    font-size:12.5px; color:#666; text-align:center;
    max-width:520px; line-height:1.7; margin-top:4px;
  }
  .footer-area {
    margin-top:auto; width:100%;
    display:flex; flex-direction:column; align-items:center;
  }
  .fecha-text {
    font-size:12px; color:#777; margin-bottom:28px;
    letter-spacing:.02em;
  }
  .firma-section {
    display:flex; flex-direction:column; align-items:center;
    gap:4px;
  }
  .firma-line {
    width:220px; height:1.5px;
    background:linear-gradient(90deg,transparent,#3D0A14,transparent);
  }
  .firma-name {
    font-weight:700; color:#3D0A14;
    font-size:13px; letter-spacing:.03em; text-align:center;
  }
  .firma-cargo {
    font-size:11px; color:#888; text-align:center;
    letter-spacing:.04em; text-transform:uppercase;
  }
  .watermark {
    position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%) rotate(-35deg);
    font-family:'Playfair Display',serif;
    font-size:90px; color:rgba(139,26,42,.04);
    font-weight:700; pointer-events:none; z-index:1;
    letter-spacing:.1em; white-space:nowrap;
    user-select:none;
  }
  .seal {
    position:absolute; bottom:100px; right:90px;
    width:90px; height:90px; opacity:.12;
    border:3px solid #C49A35; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    flex-direction:column; z-index:2;
  }
  .seal-text {
    font-size:8px; font-weight:700; color:#C49A35;
    text-transform:uppercase; letter-spacing:.08em;
    text-align:center;
  }
  /* ── QR de verificación ── */
  .qr-block {
    position:absolute; bottom:38px; left:58px;
    display:flex; flex-direction:column; align-items:center;
    gap:5px; z-index:10;
  }
  .qr-frame {
    padding:5px; background:#fff;
    border:1.5px solid #C49A35;
    border-radius:6px;
    box-shadow:0 2px 8px rgba(0,0,0,.10);
  }
  .qr-img { width:80px; height:80px; display:block; }
  .qr-label {
    font-size:7.5px; color:#8B1A2A; font-weight:700;
    letter-spacing:.08em; text-transform:uppercase;
    text-align:center; max-width:92px;
  }
  .qr-data {
    font-size:6.5px; color:#aaa; text-align:center;
    max-width:92px; word-break:break-all; line-height:1.4;
  }
</style>
</head>
<body>
<div class="border-outer"></div>
<div class="border-inner"></div>
<div class="corner tl"></div>
<div class="corner tr"></div>
<div class="corner bl"></div>
<div class="corner br"></div>
<div class="watermark">ITD</div>
<div class="seal">
  <div class="seal-text">INSTITUTO<br>TECNOLÓGICO<br>DE DURANGO</div>
</div>

<!-- QR de verificación: DA+nombre+fechaCreacion -->
<div class="qr-block">
  <div class="qr-frame">
    <img class="qr-img"
      src="${qrUrl}"
      alt="QR Verificación"
      onerror="this.parentElement.style.display='none'"
    />
  </div>
  <div class="qr-label">Verificación ITD</div>
  <div class="qr-data">${qrData}</div>
</div>
<div class="content">
  <div class="logo-row">
    <img src="${LOGO_URL}" class="logo-img" alt="ITD" onerror="this.style.display='none'"/>
    <div class="inst-text">
      <div class="inst-name">Instituto Tecnológico de Durango</div>
      <div class="inst-sub">Tecnológico Nacional de México</div>
    </div>
  </div>
  <div class="divider-gold"></div>
  <div class="doc-type">Otorga la presente</div>
  <div class="title-word">${tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'}</div>
  <p class="body-text">
    El Instituto Tecnológico de Durango hace constar que
    <span class="recipient-name">${nombre}</span>
    <span class="activity-name">${descripcion || ''}</span>
  </p>
  <p class="description">${tipo === 'reconocimiento'
    ? 'Por su destacada participación y contribución a las actividades académicas e institucionales.'
    : 'Ha cumplido satisfactoriamente con los requisitos establecidos para el presente reconocimiento.'
  }</p>
  <div class="footer-area">
    <div class="fecha-text">Durango, Dgo. a ${fecha}</div>
    <div class="firma-section">
      <div class="firma-line"></div>
      <div class="firma-name">${firmante || 'Dr. Alejandro Calderón Rentería'}</div>
      <div class="firma-cargo">${cargo || 'Coordinación de Actualización Docente'}</div>
    </div>
  </div>
</div>
</body>
</html>
`;
}; // fin buildConstanciaHTML

// ==========================================
// UTILIDADES PDF
// ==========================================
const printConstancia = (html, nombre) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Permite ventanas emergentes para imprimir.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
};

const downloadPDF = async (html, nombre) => {
  // Usamos html2canvas + jsPDF (cargados vía CDN en el index.html)
  // Si no están disponibles, abrimos ventana para imprimir como PDF
  if (window.html2canvas && window.jspdf) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
    document.body.appendChild(container);
    const el = container.querySelector('body') || container;
    try {
      const canvas = await window.html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
      pdf.addImage(imgData, 'JPEG', 0, 0, 794, 1123);
      pdf.save(`Constancia_${nombre.replace(/\s+/g,'_')}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  } else {
    // Fallback: print dialog
    printConstancia(html, nombre);
  }
};

const emailConstancia = (nombre, tipo, descripcion, fecha) => {
  const subject = `Constancia ITD: ${descripcion}`;
  const body = `Estimado/a ${nombre},\n\nAdjunto encontrará su ${tipo === 'reconocimiento' ? 'reconocimiento' : 'constancia'} correspondiente a:\n\n${descripcion}\n\nExpedido el ${fecha}.\n\nAtentamente,\nCoordinación de Actualización Docente\nInstituto Tecnológico de Durango`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const uploadToDrive = async (htmlContent, nombre, tipo) => {
  // Llama al Apps Script para guardar en Drive
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'savePDF',
        html: htmlContent,
        filename: `Constancia_${nombre.replace(/\s+/g,'_')}_${new Date().getFullYear()}.pdf`,
        folderId: DRIVE_FOLDER_ID,
        tipo
      })
    });
    const data = await resp.json();
    return data.url || null;
  } catch (err) {
    console.warn('Drive upload failed:', err);
    return null;
  }
};

// ==========================================
// LEER EXCEL (xlsx via SheetJS CDN)
// ==========================================
const parseExcelNames = (file) => {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      reject(new Error('La librería XLSX no está disponible. Asegúrate de incluir SheetJS en tu index.html.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        // Detectar columna "nombre" en la primera fila
        const headers = (rows[0] || []).map(h => String(h).toLowerCase().trim());
        const nameIdx = headers.findIndex(h =>
          h.includes('nombre') || h.includes('name') || h.includes('participante') || h.includes('docente')
        );
        const emailIdx = headers.findIndex(h =>
          h.includes('correo') || h.includes('email') || h.includes('mail')
        );
        const names = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const nombre = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : String(row[0] || '').trim();
          const correo = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : '';
          if (nombre) names.push({ nombre, correo });
        }
        resolve(names);
      } catch (err) {
        reject(new Error('No se pudo leer el archivo Excel: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
};

// ==========================================
// COMPONENTES UI BASE
// ==========================================
const ITDLogo = ({ size = 48 }) => {
  const [err, setErr] = useState(false);
  if (err) return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#3D0A14,#6B1A2A)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 1,
      boxShadow: '0 0 0 2px rgba(196,154,53,.5)'
    }}>
      <span style={{ fontSize: size * .18, fontWeight: 900, color: '#F5E4A8', letterSpacing: '.06em' }}>ITD</span>
    </div>
  );
  return (
    <img src={LOGO_URL} alt="ITD" onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%',
        background: '#fff', padding: 4,
        boxShadow: '0 0 0 2px rgba(196,154,53,.5), 0 4px 16px rgba(107,26,42,.2)'
      }}
    />
  );
};

const Spinner = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(26,58,92,.12)',
    borderTop: '3px solid #1B396A',
    animation: 'spin .8s linear infinite',
    margin: '0 auto'
  }}/>
);

const Badge = ({ children, color = '#1B396A' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 10px', borderRadius: 20,
    background: color + '18', color,
    fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', border: `1px solid ${color}28`
  }}>{children}</span>
);

const Btn = ({ children, onClick, variant = 'primary', disabled = false, small = false, style: extra = {} }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: small ? '7px 16px' : '11px 24px',
    borderRadius: 10, fontWeight: 700,
    fontSize: small ? 12 : 14, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', transition: 'all .18s', opacity: disabled ? .55 : 1,
    fontFamily: "'DM Sans','Inter',sans-serif",
    ...extra
  };
  const variants = {
    primary: { background: 'linear-gradient(135deg,#1B396A,#2B5580)', color: '#F5E4A8', boxShadow: '0 4px 14px rgba(26,58,92,.28)' },
    danger:  { background: 'linear-gradient(135deg,#3D0A14,#922438)', color: '#F5E4A8', boxShadow: '0 4px 14px rgba(107,26,42,.28)' },
    ghost:   { background: 'transparent', color: '#555', border: '1.5px solid #e0e0e0' },
    success: { background: 'linear-gradient(135deg,#14532d,#16a34a)', color: '#fff', boxShadow: '0 4px 14px rgba(20,83,45,.2)' },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = 'text', required, style: extra = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: '#444', letterSpacing: '.03em', textTransform: 'uppercase' }}>{label}{required && <span style={{ color: '#e05050' }}> *</span>}</label>}
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      style={{
        padding: '10px 14px', borderRadius: 10, fontSize: 14,
        border: '1.5px solid #e0e0e0', outline: 'none',
        fontFamily: "'DM Sans','Inter',sans-serif",
        transition: 'border-color .15s',
        ...extra
      }}
      onFocus={e => e.target.style.borderColor = '#1B396A'}
      onBlur={e => e.target.style.borderColor = '#e0e0e0'}
    />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: '#444', letterSpacing: '.03em', textTransform: 'uppercase' }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        padding: '10px 14px', borderRadius: 10, fontSize: 14,
        border: '1.5px solid #e0e0e0', outline: 'none', cursor: 'pointer',
        fontFamily: "'DM Sans','Inter',sans-serif", background: '#fff',
      }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Toast = ({ msg, type = 'info', onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, []);
  const colors = { info: '#1B396A', success: '#14532d', error: '#7f1d1d', warn: '#78350f' };
  const bgs    = { info: '#eff6ff', success: '#f0fdf4', error: '#fef2f2', warn: '#fffbeb' };
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bgs[type], color: colors[type],
      padding: '14px 20px', borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,.12)',
      border: `1.5px solid ${colors[type]}28`,
      fontSize: 14, fontWeight: 600, maxWidth: 340,
      animation: 'slideIn .3s cubic-bezier(.22,.68,0,1.2) both',
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
};

// ==========================================
// PANTALLA: LOGIN
// ==========================================
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email || !pass) { setError('Completa todos los campos.'); return; }
    setLoading(true);
    try {
      const emailLow = email.trim().toLowerCase();
      // Admin siempre puede entrar si fue pre-registrado o es el admin principal
      const users = getUsers();
      const hashPass = await simpleHash(pass);
      // Buscar usuario
      const found = users.find(u => u.email === emailLow && u.hash === hashPass && u.active);
      if (found) {
        const session = { email: found.email, name: found.name, isAdmin: found.isAdmin };
        saveSession(session);
        onLogin(session);
      } else {
        setError('Credenciales incorrectas o usuario inactivo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg,#f8f4ec 0%,#efe7d5 45%,#e8f0f8 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem', fontFamily: "'DM Sans','Inter',sans-serif",
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Fondo decorativo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 15% 5%,rgba(107,26,42,.08) 0%,transparent 55%), radial-gradient(ellipse 50% 40% at 85% 95%,rgba(26,58,92,.08) 0%,transparent 50%)'
      }}/>

      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: 14 }}><ITDLogo size={80}/></div>
          <h1 style={{
            fontFamily: "'Playfair Display','Georgia',serif",
            fontSize: 26, fontWeight: 900, color: '#3D0A14',
            margin: '0 0 .3rem', letterSpacing: '-.01em'
          }}>Otras Constancias</h1>
          <p style={{ fontSize: 13, color: '#6B6B7B', margin: 0 }}>
            Instituto Tecnológico de Durango
          </p>
        </div>

        {/* Card de login */}
        <div style={{
          background: '#fff', borderRadius: 22,
          boxShadow: '0 4px 8px rgba(0,0,0,.04), 0 24px 52px rgba(107,26,42,.1)',
          overflow: 'hidden'
        }}>
          <div style={{ height: 5, background: 'linear-gradient(90deg,#3D0A14 0%,#6B1A2A 28%,#C49A35 50%,#6B1A2A 72%,#3D0A14 100%)', backgroundSize: '200% 100%', animation: 'shimmer 4s linear infinite' }}/>
          <div style={{ padding: '1.8rem 2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Correo electrónico" value={email} onChange={setEmail}
                placeholder="usuario@itdurango.edu.mx" type="email" required/>
              <Input label="Contraseña" value={pass} onChange={setPass}
                placeholder="••••••••" type="password" required/>
              {error && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, fontSize: 13, color: '#7f1d1d', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 7 }}>
                  ⚠ {error}
                </div>
              )}
              <Btn onClick={handleSubmit} disabled={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
                {loading ? <Spinner/> : '🔐 Iniciar sesión'}
              </Btn>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 16 }}>
              Acceso restringido — Portal ITD
            </p>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '2rem', fontSize: 11, color: 'rgba(80,65,55,.5)' }}>
        © {new Date().getFullYear()} Dr. Alejandro Calderón Rentería — Coordinación Docente
      </p>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
};

// ==========================================
// PANTALLA: GENERADOR DE CONSTANCIAS
// ==========================================
const GeneradorScreen = ({ user, toast }) => {
  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const [mode, setMode] = useState('manual'); // 'manual' | 'excel'
  const [form, setForm] = useState({
    tipo: 'constancia',
    descripcion: '',
    fecha: today,
    firmante: 'Dr. Alejandro Calderón Rentería',
    cargo: 'Coordinación de Actualización Docente',
  });
  const [nombre, setNombre]   = useState('');
  const [excelList, setExcelList] = useState([]);
  const [excelErr, setExcelErr]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [generated, setGenerated] = useState([]); // [{nombre, correo, html, driveUrl, status}]
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef();

  const buildForm = (n) => ({
    ...form,
    nombre: n
  });

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelErr('');
    try {
      const names = await parseExcelNames(file);
      if (names.length === 0) throw new Error('No se encontraron nombres en el archivo.');
      setExcelList(names);
      toast(`✅ ${names.length} nombres cargados del Excel`, 'success');
    } catch (err) {
      setExcelErr(err.message);
    }
    e.target.value = '';
  };

  const generarConstancias = async () => {
    const nombres = mode === 'manual'
      ? [{ nombre: nombre.trim(), correo: '' }]
      : excelList;

    if (mode === 'manual' && !nombre.trim()) {
      toast('Ingresa un nombre.', 'warn'); return;
    }
    if (mode === 'excel' && excelList.length === 0) {
      toast('Carga un archivo Excel primero.', 'warn'); return;
    }
    if (!form.descripcion.trim()) {
      toast('Ingresa la descripción de la constancia.', 'warn'); return;
    }

    setGenerating(true);
    // Fecha de creación en ISO (YYYY-MM-DD) — se incrusta en el QR
    const fechaCreacion = new Date().toISOString().split('T')[0];
    const results = [];
    for (const item of nombres) {
      const html = buildConstanciaHTML({ nombre: item.nombre, ...form, fechaCreacion });
      let driveUrl = null;
      try {
        driveUrl = await uploadToDrive(html, item.nombre, form.tipo);
      } catch {}
      results.push({ nombre: item.nombre, correo: item.correo, html, driveUrl, status: 'listo', fechaCreacion });
    }
    setGenerated(results);
    setGenerating(false);
    toast(`🎉 ${results.length} constancia(s) generada(s)`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>Generar Constancias</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>Crea constancias en PDF con la plantilla oficial ITD</p>
        </div>
        <Badge color="#1B396A">📄 PDF Oficial</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(280px,420px)', gap: 20, alignItems: 'start' }}>
        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tipo y modo */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#333' }}>⚙️ Configuración</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Select label="Tipo de documento" value={form.tipo}
                onChange={v => setForm(f => ({ ...f, tipo: v }))}
                options={[
                  { value: 'constancia', label: '📜 Constancia' },
                  { value: 'reconocimiento', label: '🏅 Reconocimiento' },
                ]}/>
              <Input label="Descripción / Actividad" value={form.descripcion}
                onChange={v => setForm(f => ({ ...f, descripcion: v }))}
                placeholder="Ej: Participación en el Congreso ITD 2026" required/>
              <Input label="Fecha de expedición" value={form.fecha}
                onChange={v => setForm(f => ({ ...f, fecha: v }))}
                placeholder="Ej: 8 de marzo de 2026"/>
              <Input label="Firmante" value={form.firmante}
                onChange={v => setForm(f => ({ ...f, firmante: v }))}
                placeholder="Nombre del firmante"/>
              <Input label="Cargo del firmante" value={form.cargo}
                onChange={v => setForm(f => ({ ...f, cargo: v }))}
                placeholder="Cargo institucional"/>
            </div>
          </div>

          {/* Modo de nombres */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>👤 Destinatario(s)</h3>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'manual', label: '✍️ Nombre manual' },
                { key: 'excel', label: '📊 Cargar Excel' }
              ].map(t => (
                <button key={t.key} onClick={() => setMode(t.key)} style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', border: 'none',
                  fontFamily: "'DM Sans','Inter',sans-serif",
                  background: mode === t.key ? '#1B396A' : '#f3f4f6',
                  color: mode === t.key ? '#F5E4A8' : '#555',
                  transition: 'all .15s'
                }}>{t.label}</button>
              ))}
            </div>

            {mode === 'manual' ? (
              <Input label="Nombre completo" value={nombre} onChange={setNombre}
                placeholder="Ej: Lic. Juan García López" required/>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                  Sube un archivo <strong>.xlsx</strong> o <strong>.xls</strong>. La primera fila debe tener encabezados; se detecta automáticamente la columna <em>"Nombre"</em> (también acepta "Participante", "Docente"). Opcionalmente incluye columna <em>"Correo"</em>.
                </p>
                <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleExcelUpload} style={{ display: 'none' }}/>
                <Btn onClick={() => fileRef.current?.click()} variant="ghost">
                  📂 Seleccionar archivo Excel
                </Btn>
                {excelErr && <p style={{ margin: 0, fontSize: 12, color: '#c00' }}>⚠ {excelErr}</p>}
                {excelList.length > 0 && (
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', border: '1px solid #86efac' }}>
                    <strong style={{ fontSize: 13, color: '#14532d' }}>✅ {excelList.length} nombre(s) cargados</strong>
                    <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {excelList.slice(0, 8).map((n, i) => (
                        <span key={i} style={{ fontSize: 12, color: '#166534' }}>• {n.nombre}{n.correo ? ` (${n.correo})` : ''}</span>
                      ))}
                      {excelList.length > 8 && <span style={{ fontSize: 11, color: '#888' }}>…y {excelList.length - 8} más</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Btn onClick={generarConstancias} disabled={generating} style={{ justifyContent: 'center' }}>
            {generating ? <><Spinner/> Generando…</> : '🚀 Generar Constancia(s)'}
          </Btn>
        </div>

        {/* Vista previa y resultados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
          {/* Vista previa mínima */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>👁 Vista Previa</h3>
            <div style={{
              background: 'linear-gradient(135deg,#f8f4ec,#efe7d5)',
              borderRadius: 12, padding: 20, textAlign: 'center',
              border: '2px solid #e8d5b0', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, border: '1px solid #C49A3540', borderRadius: 8, pointerEvents: 'none' }}/>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#8B1A2A', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Otorga la presente</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: '#3D0A14', marginBottom: 10 }}>
                {form.tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>a</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 16, color: '#1B396A', fontWeight: 700, borderBottom: '1px solid #C49A35', paddingBottom: 6, marginBottom: 8 }}>
                {(mode === 'manual' ? nombre : excelList[0]?.nombre) || 'Nombre del Destinatario'}
              </div>
              {form.descripcion && <div style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>{form.descripcion}</div>}
              <div style={{ fontSize: 10, color: '#999', marginTop: 10 }}>Durango, Dgo. a {form.fecha}</div>
              <div style={{ marginTop: 14 }}>
                <div style={{ width: 100, height: 1, background: 'linear-gradient(90deg,transparent,#3D0A14,transparent)', margin: '0 auto 4px' }}/>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#3D0A14' }}>{form.firmante}</div>
                <div style={{ fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em' }}>{form.cargo}</div>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#aaa', textAlign: 'center' }}>Vista aproximada — el PDF final incluye bordes decorativos y logo</p>
          </div>

          {/* Resultados generados */}
          {generated.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>✅ Generadas ({generated.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {generated.map((g, i) => (
                  <div key={i} style={{
                    background: '#f8faff', borderRadius: 10, padding: '12px 14px',
                    border: '1px solid #e0e8f5', display: 'flex', flexDirection: 'column', gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Mini QR preview */}
                      <img
                        src={getQRImageURL(g.nombre, g.fechaCreacion)}
                        alt="QR"
                        style={{ width: 48, height: 48, borderRadius: 6, border: '1.5px solid #C49A35', flexShrink: 0, background: '#fff', padding: 2 }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{g.nombre}</div>
                        <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace', marginTop: 2 }}>{buildQRData(g.nombre, g.fechaCreacion)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button onClick={() => downloadPDF(g.html, g.nombre)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#eff6ff', color: '#1B396A', border: '1px solid #bfdbfe'
                      }}>⬇ Descargar PDF</button>
                      <button onClick={() => printConstancia(g.html, g.nombre)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#f0fdf4', color: '#14532d', border: '1px solid #86efac'
                      }}>🖨 Imprimir</button>
                      <button onClick={() => emailConstancia(g.nombre, form.tipo, form.descripcion, form.fecha)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#fefce8', color: '#713f12', border: '1px solid #fde68a'
                      }}>📧 Enviar correo</button>
                      {g.driveUrl && (
                        <a href={g.driveUrl} target="_blank" rel="noopener noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          background: '#fdf4ff', color: '#701a75', border: '1px solid #e879f9',
                          textDecoration: 'none'
                        }}>☁ Ver en Drive</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PANTALLA: ADMINISTRACIÓN DE USUARIOS (Solo Admin)
// ==========================================
const AdminUsersScreen = ({ currentAdmin, toast }) => {
  const [users, setUsers] = useState(getUsers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', isAdmin: false });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => setUsers(getUsers());

  const handleCreate = async () => {
    setFormErr('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormErr('Todos los campos son requeridos.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormErr('Correo inválido.'); return;
    }
    const existing = getUsers();
    if (existing.find(u => u.email === form.email.toLowerCase())) {
      setFormErr('Ya existe un usuario con ese correo.'); return;
    }
    setSaving(true);
    const hash = await simpleHash(form.password);
    const newUser = {
      id: Date.now().toString(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      hash,
      isAdmin: form.isAdmin,
      active: true,
      createdAt: new Date().toISOString()
    };
    const updated = [...existing, newUser];
    saveUsers(updated);
    setUsers(updated);
    setForm({ name: '', email: '', password: '', isAdmin: false });
    setShowForm(false);
    setSaving(false);
    toast(`✅ Usuario ${newUser.email} creado`, 'success');
  };

  const toggleActive = (id) => {
    const updated = getUsers().map(u => u.id === id ? { ...u, active: !u.active } : u);
    saveUsers(updated);
    setUsers(updated);
    toast('Estado del usuario actualizado', 'info');
  };

  const deleteUser = (id) => {
    const u = getUsers().find(x => x.id === id);
    if (!u) return;
    if (!window.confirm(`¿Eliminar usuario ${u.email}? Esta acción no se puede deshacer.`)) return;
    const updated = getUsers().filter(x => x.id !== id);
    saveUsers(updated);
    setUsers(updated);
    toast('Usuario eliminado', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>Gestión de Usuarios</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{users.length} usuario(s) registrado(s)</p>
        </div>
        <Btn onClick={() => setShowForm(v => !v)} variant={showForm ? 'ghost' : 'primary'}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Usuario'}
        </Btn>
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '2px solid #1B396A22' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#1B396A' }}>➕ Crear nuevo usuario</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            <Input label="Nombre completo" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nombre Apellido" required/>
            <Input label="Correo electrónico" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="usuario@itdurango.edu.mx" type="email" required/>
            <Input label="Contraseña inicial" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Mínimo 6 caracteres" type="password" required/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#444', letterSpacing: '.03em', textTransform: 'uppercase' }}>Rol</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14 }}>
                <input type="checkbox" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}/>
                Administrador
              </label>
            </div>
          </div>
          {formErr && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#c00' }}>⚠ {formErr}</p>}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Btn onClick={handleCreate} disabled={saving}>
              {saving ? <Spinner/> : '💾 Crear usuario'}
            </Btn>
            <Btn onClick={() => { setShowForm(false); setForm({ name: '', email: '', password: '', isAdmin: false }); setFormErr(''); }} variant="ghost">
              Cancelar
            </Btn>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {users.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#aaa' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Sin usuarios registrados</div>
            <div style={{ fontSize: 13 }}>Crea el primer usuario con el botón de arriba.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 100px 100px 130px', gap: 8, padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e8ecf0', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <span>Usuario</span><span>Correo</span><span>Rol</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
            </div>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 200px 100px 100px 130px',
                gap: 8, padding: '14px 20px', alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                background: !u.active ? '#fafafa' : '#fff',
                opacity: !u.active ? .65 : 1
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>Creado: {new Date(u.createdAt).toLocaleDateString('es-MX')}</div>
                </div>
                <div style={{ fontSize: 13, color: '#555', wordBreak: 'break-all' }}>{u.email}</div>
                <div><Badge color={u.isAdmin ? '#8B1A2A' : '#1B396A'}>{u.isAdmin ? 'Admin' : 'Usuario'}</Badge></div>
                <div>
                  <button onClick={() => toggleActive(u.id)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: 'none', background: u.active ? '#dcfce7' : '#fee2e2',
                    color: u.active ? '#14532d' : '#7f1d1d'
                  }}>{u.active ? 'Activo' : 'Inactivo'}</button>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {u.email !== currentAdmin.email && (
                    <button onClick={() => deleteUser(u.id)} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca'
                    }}>🗑 Eliminar</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// APP PRINCIPAL (DASHBOARD)
// ==========================================
const OtrasConstanciasApp = ({ user, onLogout }) => {
  const [tab, setTab] = useState('generar');
  const [toastMsg, setToastMsg] = useState(null);

  const toast = (msg, type = 'info') => setToastMsg({ msg, type });

  const tabs = [
    { key: 'generar', label: '📜 Generar Constancias' },
    ...(user.isAdmin ? [{ key: 'usuarios', label: '👥 Usuarios' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fa', fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background:#c0c8d0; border-radius:3px; }
      `}</style>

      {/* Navbar */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #e8ecf2',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 8px rgba(0,0,0,.06)'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: 60, gap: 16 }}>
          <ITDLogo size={38}/>
          <div style={{ width: 1, height: 30, background: '#e0e0e0' }}/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1B396A' }}>Otras Constancias</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>Instituto Tecnológico de Durango</div>
          </div>
          <div style={{ flex: 1 }}/>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: 'none', transition: 'all .15s',
                fontFamily: "'DM Sans','Inter',sans-serif",
                background: tab === t.key ? '#1B396A' : 'transparent',
                color: tab === t.key ? '#F5E4A8' : '#666',
              }}>{t.label}</button>
            ))}
          </div>
          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#1B396A,#2B5580)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5E4A8', fontSize: 14, fontWeight: 700 }}>
              {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{user.name || 'Usuario'}</span>
              {user.isAdmin && <Badge color="#8B1A2A">Admin</Badge>}
            </div>
            <button onClick={onLogout} style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', background: '#fef2f2', color: '#7f1d1d',
              border: '1px solid #fecaca', marginLeft: 4
            }}>Salir</button>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        {tab === 'generar' && <GeneradorScreen user={user} toast={toast}/>}
        {tab === 'usuarios' && user.isAdmin && <AdminUsersScreen currentAdmin={user} toast={toast}/>}
      </main>

      {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)}/>}
    </div>
  );
};

// ==========================================
// ROOT: Manejar sesión
// ==========================================
const OtrasConstanciasRoot = () => {
  const [user, setUser] = useState(() => {
    // Verificar si hay sesión activa
    return getSession();
  });

  // Asegurarse que el admin principal siempre exista en la lista de usuarios
  useEffect(() => {
    const users = getUsers();
    const adminExists = users.find(u => u.email === ADMIN_EMAIL);
    if (!adminExists) {
      // Crear admin con password temporal — debe cambiarla en el panel
      simpleHash('Xela1615').then(hash => {
        const admin = {
          id: 'admin_principal',
          name: 'Dr. Alejandro Calderón Rentería',
          email: ADMIN_EMAIL,
          hash,
          isAdmin: true,
          active: true,
          createdAt: new Date().toISOString()
        };
        saveUsers([...users, admin]);
      });
    }
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { clearSession(); setUser(null); };

  if (!user) return <LoginScreen onLogin={handleLogin}/>;
  return <OtrasConstanciasApp user={user} onLogout={handleLogout}/>;
};

// ==========================================
// TARJETA PARA EL INDEX PRINCIPAL
// Agregar esta tarjeta al grid de tarjetas en el Login de main-4.js
// ==========================================
export const OtrasConstanciasCard = ({ onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 22, overflow: 'hidden', cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(0,0,0,.04), 0 24px 52px rgba(26,58,92,.1), 0 0 0 1px rgba(196,154,53,.12)',
    display: 'flex', flexDirection: 'column', transition: 'transform .2s, box-shadow .2s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 16px rgba(0,0,0,.07), 0 32px 64px rgba(26,58,92,.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 8px rgba(0,0,0,.04), 0 24px 52px rgba(26,58,92,.1)'; }}
  >
    <div style={{ height: 5, backgroundSize: '200% 100%', animation: 'shimmer 4s linear infinite', background: 'linear-gradient(90deg,#1B396A 0%,#2B5580 35%,#C49A35 55%,#2B5580 75%,#1B396A 100%)' }}/>
    <div style={{ padding: '1.7rem 1.9rem', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem', marginBottom: '.9rem' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg,#1B396A,#2B5580)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 14px rgba(26,58,92,.25)', fontSize: 22
        }}>📋</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.02rem', color: '#1A1720', lineHeight: 1.2 }}>Otras Constancias</div>
          <div style={{ fontSize: '.74rem', color: '#6B6B7B', marginTop: '.08rem' }}>Generar documentos PDF</div>
        </div>
      </div>
      <p style={{ fontSize: '.82rem', color: '#5A5A6A', lineHeight: 1.62, margin: '0 0 1.2rem' }}>
        Genera constancias y reconocimientos personalizados. Carga nombres desde Excel o ingrésalos manualmente. Descarga en PDF, imprime o envía por correo.
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
        padding: '.85rem 1rem', borderRadius: 12,
        background: 'linear-gradient(135deg,#1B396A,#2B5580)',
        color: '#F5E4A8', fontWeight: 700, fontSize: '.84rem',
        boxShadow: '0 4px 18px rgba(26,58,92,.3)'
      }}>
        📜 Acceder
      </div>
    </div>
  </div>
);

// ==========================================
// PUNTO DE ENTRADA
// ==========================================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<OtrasConstanciasRoot />);

export default OtrasConstanciasRoot;
