<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Otras Constancias — ITD</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet"/>
  <!-- SheetJS para leer Excel -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <!-- html2canvas + jsPDF para generar PDF -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #f4f6fa; }
    @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes spin     { to { transform: rotate(360deg); } }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: #c0c8d0; border-radius: 3px; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback } = React;

    // ── CONFIG ──────────────────────────────────────────────
    const LOGO_URL       = "https://github.com/DA-itd/web/blob/main/logo_itdurango.png?raw=true";
    const ADMIN_EMAIL    = "alejandro.calderon@itdurango.edu.mx";
    const DRIVE_FOLDER_ID= "1ZSvT7fvVDGZ9Cqyi3ur4sIuumuaLT0zZ";
    const APPS_SCRIPT_URL= "https://script.google.com/macros/s/AKfycbxtt1oKbMYo5t7X9ZIIDoeZ0RTVDOFuNPacN6cKzQllNVJDqxPP569GKX6jqbDKmvwnRA/exec";

    // ── STORAGE ──────────────────────────────────────────────
    const SK_USERS   = "itd_oc_users";
    const SK_SESSION = "itd_oc_session";

    const getUsers   = () => { try { return JSON.parse(localStorage.getItem(SK_USERS) || '[]'); } catch { return []; } };
    const saveUsers  = (u) => localStorage.setItem(SK_USERS, JSON.stringify(u));
    const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SK_SESSION)); } catch { return null; } };
    const saveSession= (u) => sessionStorage.setItem(SK_SESSION, JSON.stringify(u));
    const clearSession=()  => sessionStorage.removeItem(SK_SESSION);

    const simpleHash = async (str) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    };

    // ── QR ───────────────────────────────────────────────────
    const buildQRData   = (nombre, fc) => `DA+${nombre}+${fc || new Date().toISOString().split('T')[0]}`;
    const getQRImageURL = (nombre, fc) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=4&data=${encodeURIComponent(buildQRData(nombre, fc))}`;

    // ── PLANTILLA HTML DE CONSTANCIA ─────────────────────────
    const buildConstanciaHTML = ({ nombre, tipo, descripcion, fecha, firmante, cargo, fechaCreacion }) => {
      const qrUrl  = getQRImageURL(nombre, fechaCreacion);
      const qrData = buildQRData(nombre, fechaCreacion);
      return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Lato:wght@300;400;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:794px;height:1123px;font-family:'Lato',sans-serif;background:#fff;position:relative;overflow:hidden}
  .bo{position:absolute;inset:18px;border:3px solid #8B1A2A;border-radius:4px}
  .bi{position:absolute;inset:24px;border:1px solid #C49A35;border-radius:2px}
  .corner{position:absolute;width:40px;height:40px;background:linear-gradient(135deg,#8B1A2A,#C49A35)}
  .tl{top:14px;left:14px;clip-path:polygon(0 0,100% 0,0 100%)}
  .tr{top:14px;right:14px;clip-path:polygon(100% 0,100% 100%,0 0)}
  .bl{bottom:14px;left:14px;clip-path:polygon(0 0,100% 100%,0 100%)}
  .br{bottom:14px;right:14px;clip-path:polygon(100% 0,100% 100%,0 100%)}
  .wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
      font-family:'Playfair Display',serif;font-size:90px;color:rgba(139,26,42,.04);
      font-weight:700;pointer-events:none;z-index:1;letter-spacing:.1em;white-space:nowrap}
  .seal{position:absolute;bottom:100px;right:90px;width:90px;height:90px;opacity:.12;
        border:3px solid #C49A35;border-radius:50%;display:flex;align-items:center;
        justify-content:center;flex-direction:column;z-index:2}
  .seal span{font-size:8px;font-weight:700;color:#C49A35;text-transform:uppercase;
             letter-spacing:.08em;text-align:center}
  .qr-block{position:absolute;bottom:38px;left:58px;display:flex;flex-direction:column;
            align-items:center;gap:5px;z-index:10}
  .qr-frame{padding:5px;background:#fff;border:1.5px solid #C49A35;border-radius:6px;
            box-shadow:0 2px 8px rgba(0,0,0,.10)}
  .qr-frame img{width:80px;height:80px;display:block}
  .qr-label{font-size:7.5px;color:#8B1A2A;font-weight:700;letter-spacing:.08em;
            text-transform:uppercase;text-align:center;max-width:92px}
  .qr-data{font-size:6.5px;color:#aaa;text-align:center;max-width:92px;
           word-break:break-all;line-height:1.4}
  .content{position:relative;z-index:10;height:100%;display:flex;flex-direction:column;
           align-items:center;padding:55px 80px 50px}
  .logo-row{display:flex;align-items:center;gap:18px;margin-bottom:14px}
  .logo-img{width:70px;height:70px;object-fit:contain}
  .inst-name{font-size:13px;font-weight:700;color:#3D0A14;letter-spacing:.06em;text-transform:uppercase}
  .inst-sub{font-size:10px;color:#888;letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
  .divider{width:100%;height:2px;background:linear-gradient(90deg,transparent,#C49A35,transparent);margin:10px 0}
  .doc-type{font-size:11px;letter-spacing:.3em;color:#8B1A2A;text-transform:uppercase;font-weight:700;margin:18px 0 8px}
  .title-word{font-family:'Playfair Display',serif;font-size:52px;font-weight:700;color:#3D0A14;
              letter-spacing:.02em;line-height:1;margin-bottom:22px}
  .body-text{text-align:center;font-size:14px;color:#444;line-height:1.85;max-width:580px}
  .rname{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;font-style:italic;
         color:#1B396A;display:block;margin:16px 0 6px;border-bottom:1.5px solid #C49A35;
         padding-bottom:8px;width:100%;text-align:center}
  .aname{font-size:16px;font-weight:700;color:#3D0A14;margin:8px 0 4px;text-align:center}
  .desc{font-size:12.5px;color:#666;text-align:center;max-width:520px;line-height:1.7;margin-top:4px}
  .footer-area{margin-top:auto;width:100%;display:flex;flex-direction:column;align-items:center}
  .fecha-text{font-size:12px;color:#777;margin-bottom:28px;letter-spacing:.02em}
  .firma-section{display:flex;flex-direction:column;align-items:center;gap:4px}
  .firma-line{width:220px;height:1.5px;background:linear-gradient(90deg,transparent,#3D0A14,transparent)}
  .firma-name{font-weight:700;color:#3D0A14;font-size:13px;letter-spacing:.03em;text-align:center}
  .firma-cargo{font-size:11px;color:#888;text-align:center;letter-spacing:.04em;text-transform:uppercase}
</style></head>
<body>
  <div class="bo"></div><div class="bi"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="wm">ITD</div>
  <div class="seal"><span>INSTITUTO<br>TECNOLÓGICO<br>DE DURANGO</span></div>
  <div class="qr-block">
    <div class="qr-frame">
      <img src="${qrUrl}" alt="QR" onerror="this.parentElement.style.display='none'"/>
    </div>
    <div class="qr-label">Verificación ITD</div>
    <div class="qr-data">${qrData}</div>
  </div>
  <div class="content">
    <div class="logo-row">
      <img src="${LOGO_URL}" class="logo-img" alt="ITD" onerror="this.style.display='none'"/>
      <div>
        <div class="inst-name">Instituto Tecnológico de Durango</div>
        <div class="inst-sub">Tecnológico Nacional de México</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="doc-type">Otorga la presente</div>
    <div class="title-word">${tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'}</div>
    <p class="body-text">
      El Instituto Tecnológico de Durango hace constar que
      <span class="rname">${nombre}</span>
      <span class="aname">${descripcion || ''}</span>
    </p>
    <p class="desc">${tipo === 'reconocimiento'
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
</body></html>`;
    };

    // ── UTILIDADES PDF / PRINT / EMAIL / DRIVE ────────────────
    const printConstancia = (html) => {
      const win = window.open('', '_blank', 'width=900,height=750');
      if (!win) { alert('Permite ventanas emergentes para imprimir.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 700);
    };

    const downloadPDF = async (html, nombre) => {
      if (window.html2canvas && window.jspdf) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;z-index:-1';
        document.body.appendChild(iframe);
        try {
          iframe.contentDocument.open();
          iframe.contentDocument.write(html);
          iframe.contentDocument.close();
          await new Promise(r => setTimeout(r, 800));
          const canvas = await window.html2canvas(iframe.contentDocument.body, {
            scale: 2, useCORS: true, allowTaint: true,
            width: 794, height: 1123
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
          pdf.addImage(imgData, 'JPEG', 0, 0, 794, 1123);
          pdf.save(`Constancia_${nombre.replace(/\s+/g,'_')}.pdf`);
        } finally {
          document.body.removeChild(iframe);
        }
      } else {
        printConstancia(html);
      }
    };

    const emailConstancia = (nombre, tipo, descripcion, fecha) => {
      const subject = `Constancia ITD: ${descripcion}`;
      const body = `Estimado/a ${nombre},\n\nAdjunto encontrará su ${tipo === 'reconocimiento' ? 'reconocimiento' : 'constancia'} correspondiente a:\n\n${descripcion}\n\nExpedido el ${fecha}.\n\nAtentamente,\nCoordinación de Actualización Docente\nInstituto Tecnológico de Durango`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const uploadToDrive = async (htmlContent, nombre, tipo) => {
      try {
        const resp = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'savePDF', html: htmlContent,
            filename: `Constancia_${nombre.replace(/\s+/g,'_')}_${new Date().getFullYear()}.pdf`,
            folderId: DRIVE_FOLDER_ID, tipo
          })
        });
        const data = await resp.json();
        return data.url || null;
      } catch { return null; }
    };

    // ── LEER EXCEL ────────────────────────────────────────────
    const parseExcelNames = (file) => new Promise((resolve, reject) => {
      if (!window.XLSX) { reject(new Error('SheetJS no disponible.')); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
          const headers = (rows[0] || []).map(h => String(h).toLowerCase().trim());
          const nameIdx = headers.findIndex(h => ['nombre','name','participante','docente','alumno'].some(k => h.includes(k)));
          const emailIdx= headers.findIndex(h => ['correo','email','mail'].some(k => h.includes(k)));
          const names = rows.slice(1).reduce((acc, row) => {
            if (!row || !row.length) return acc;
            const nombre = String(row[nameIdx >= 0 ? nameIdx : 0] || '').trim();
            const correo = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : '';
            if (nombre) acc.push({ nombre, correo });
            return acc;
          }, []);
          if (!names.length) throw new Error('No se encontraron nombres en el archivo.');
          resolve(names);
        } catch (err) { reject(new Error('Error leyendo Excel: ' + err.message)); }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      reader.readAsArrayBuffer(file);
    });

    // ── COMPONENTES BASE ──────────────────────────────────────
    const ITDLogo = ({ size = 48 }) => {
      const [err, setErr] = useState(false);
      return err
        ? <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#3D0A14,#6B1A2A)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 2px rgba(196,154,53,.5)' }}>
            <span style={{ fontSize:size*.18, fontWeight:900, color:'#F5E4A8', letterSpacing:'.06em' }}>ITD</span>
          </div>
        : <img src={LOGO_URL} alt="ITD" onError={() => setErr(true)}
            style={{ width:size, height:size, objectFit:'contain', borderRadius:'50%', background:'#fff', padding:4, boxShadow:'0 0 0 2px rgba(196,154,53,.5), 0 4px 16px rgba(107,26,42,.2)' }}
          />;
    };

    const Spinner = ({ small }) => (
      <div style={{ width:small?18:28, height:small?18:28, borderRadius:'50%', border:'3px solid rgba(26,58,92,.15)', borderTop:'3px solid #1B396A', animation:'spin .7s linear infinite', flexShrink:0 }}/>
    );

    const Badge = ({ children, color='#1B396A' }) => (
      <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 10px', borderRadius:20, background:color+'18', color, fontSize:11, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase', border:`1px solid ${color}28` }}>{children}</span>
    );

    const Btn = ({ children, onClick, variant='primary', disabled=false, small=false, full=false, style:ex={} }) => {
      const styles = {
        primary: { background:'linear-gradient(135deg,#1B396A,#2B5580)', color:'#F5E4A8', boxShadow:'0 4px 14px rgba(26,58,92,.28)' },
        danger:  { background:'linear-gradient(135deg,#3D0A14,#922438)', color:'#F5E4A8', boxShadow:'0 4px 14px rgba(107,26,42,.28)' },
        ghost:   { background:'transparent', color:'#555', border:'1.5px solid #d0d0d0' },
        success: { background:'linear-gradient(135deg,#14532d,#16a34a)', color:'#fff', boxShadow:'0 4px 14px rgba(20,83,45,.2)' },
      };
      return <button disabled={disabled} onClick={onClick} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:small?'7px 14px':'11px 22px', borderRadius:10, fontWeight:700, fontSize:small?12:14, cursor:disabled?'not-allowed':'pointer', border:'none', transition:'all .15s', opacity:disabled?.55:1, fontFamily:"'DM Sans',sans-serif", width:full?'100%':'auto', ...styles[variant], ...ex }}>{children}</button>;
    };

    const Field = ({ label, value, onChange, placeholder, type='text', required }) => (
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {label && <label style={{ fontSize:11, fontWeight:700, color:'#555', letterSpacing:'.04em', textTransform:'uppercase' }}>{label}{required&&<span style={{color:'#e05050'}}> *</span>}</label>}
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ padding:'10px 14px', borderRadius:10, fontSize:14, border:'1.5px solid #e0e0e0', outline:'none', fontFamily:"'DM Sans',sans-serif", background:'#fff' }}
          onFocus={e=>e.target.style.borderColor='#1B396A'}
          onBlur={e=>e.target.style.borderColor='#e0e0e0'}
        />
      </div>
    );

    const SelectField = ({ label, value, onChange, options }) => (
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {label && <label style={{ fontSize:11, fontWeight:700, color:'#555', letterSpacing:'.04em', textTransform:'uppercase' }}>{label}</label>}
        <select value={value} onChange={e=>onChange(e.target.value)}
          style={{ padding:'10px 14px', borderRadius:10, fontSize:14, border:'1.5px solid #e0e0e0', outline:'none', fontFamily:"'DM Sans',sans-serif", background:'#fff', cursor:'pointer' }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );

    const Toast = ({ msg, type='info', onClose }) => {
      useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, []);
      const palette = { info:{bg:'#eff6ff',c:'#1B396A'}, success:{bg:'#f0fdf4',c:'#14532d'}, error:{bg:'#fef2f2',c:'#7f1d1d'}, warn:{bg:'#fffbeb',c:'#78350f'} };
      const p = palette[type] || palette.info;
      return (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:p.bg, color:p.c, padding:'13px 18px', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,.12)', border:`1.5px solid ${p.c}22`, fontSize:14, fontWeight:600, maxWidth:340, animation:'slideIn .3s ease both', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{flex:1}}>{msg}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:18, lineHeight:1 }}>×</button>
        </div>
      );
    };

    // ── LOGIN ─────────────────────────────────────────────────
    const LoginScreen = ({ onLogin }) => {
      const [email, setEmail]   = useState('');
      const [pass,  setPass]    = useState('');
      const [error, setError]   = useState('');
      const [loading, setLoading] = useState(false);

      const handleSubmit = async () => {
        setError('');
        if (!email.trim() || !pass.trim()) { setError('Completa todos los campos.'); return; }
        setLoading(true);
        try {
          const emailLow = email.trim().toLowerCase();
          const hashPass = await simpleHash(pass);
          const found = getUsers().find(u => u.email === emailLow && u.hash === hashPass && u.active);
          if (found) {
            const session = { email: found.email, name: found.name, isAdmin: found.isAdmin };
            saveSession(session);
            onLogin(session);
          } else {
            setError('Credenciales incorrectas o usuario inactivo.');
          }
        } finally { setLoading(false); }
      };

      return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(150deg,#f8f4ec 0%,#efe7d5 45%,#e8f0f8 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 70% 50% at 15% 5%,rgba(107,26,42,.08) 0%,transparent 55%), radial-gradient(ellipse 50% 40% at 85% 95%,rgba(26,58,92,.08) 0%,transparent 50%)' }}/>
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

          <div style={{ position:'relative', width:'100%', maxWidth:400, animation:'fadeUp .5s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <div style={{ marginBottom:14, display:'flex', justifyContent:'center' }}><ITDLogo size={84}/></div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:900, color:'#3D0A14', marginBottom:4 }}>Otras Constancias</h1>
              <p style={{ fontSize:13, color:'#888' }}>Instituto Tecnológico de Durango</p>
            </div>

            <div style={{ background:'#fff', borderRadius:22, overflow:'hidden', boxShadow:'0 4px 8px rgba(0,0,0,.04), 0 24px 52px rgba(107,26,42,.1)' }}>
              <div style={{ height:5, background:'linear-gradient(90deg,#3D0A14,#6B1A2A,#C49A35,#6B1A2A,#3D0A14)', backgroundSize:'200% 100%', animation:'shimmer 4s linear infinite' }}/>
              <div style={{ padding:'1.8rem 2rem', display:'flex', flexDirection:'column', gap:14 }}>
                <Field label="Correo electrónico" value={email} onChange={setEmail} placeholder="usuario@itdurango.edu.mx" type="email" required/>
                <Field label="Contraseña" value={pass} onChange={setPass} placeholder="••••••••" type="password" required/>
                {error && <div style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:10, fontSize:13, color:'#7f1d1d', border:'1px solid #fecaca' }}>⚠ {error}</div>}
                <Btn onClick={handleSubmit} disabled={loading} full>
                  {loading ? <><Spinner small/> Verificando…</> : '🔐 Iniciar sesión'}
                </Btn>
                <p style={{ textAlign:'center', fontSize:11, color:'#bbb', marginTop:2 }}>Acceso restringido — Portal ITD</p>
              </div>
            </div>
          </div>

          <p style={{ marginTop:'2rem', fontSize:11, color:'rgba(80,65,55,.45)', position:'relative' }}>
            © {new Date().getFullYear()} Dr. Alejandro Calderón Rentería — Coordinación Docente
          </p>
        </div>
      );
    };

    // ── GENERADOR ─────────────────────────────────────────────
    const GeneradorScreen = ({ user, toast }) => {
      const today = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
      const [mode, setMode]     = useState('manual');
      const [form, setForm]     = useState({ tipo:'constancia', descripcion:'', fecha:today, firmante:'Dr. Alejandro Calderón Rentería', cargo:'Coordinación de Actualización Docente' });
      const [nombre, setNombre] = useState('');
      const [excelList, setExcelList] = useState([]);
      const [excelErr, setExcelErr]   = useState('');
      const [generated, setGenerated] = useState([]);
      const [generating, setGenerating] = useState(false);
      const [activeResult, setActiveResult] = useState(null);
      const fileRef = useRef();

      const sf = (key) => (v) => setForm(f => ({ ...f, [key]: v }));

      const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setExcelErr('');
        try {
          const names = await parseExcelNames(file);
          setExcelList(names);
          toast(`✅ ${names.length} nombre(s) cargados`, 'success');
        } catch (err) { setExcelErr(err.message); }
        e.target.value = '';
      };

      const generarConstancias = async () => {
        const nombres = mode === 'manual' ? [{ nombre: nombre.trim(), correo: '' }] : excelList;
        if (mode === 'manual' && !nombre.trim())     { toast('Ingresa un nombre.', 'warn'); return; }
        if (mode === 'excel' && !excelList.length)   { toast('Carga un archivo Excel primero.', 'warn'); return; }
        if (!form.descripcion.trim())                { toast('Ingresa la descripción.', 'warn'); return; }

        setGenerating(true);
        const fechaCreacion = new Date().toISOString().split('T')[0];
        const results = [];
        for (const item of nombres) {
          const html = buildConstanciaHTML({ nombre: item.nombre, ...form, fechaCreacion });
          let driveUrl = null;
          try { driveUrl = await uploadToDrive(html, item.nombre, form.tipo); } catch {}
          results.push({ nombre: item.nombre, correo: item.correo, html, driveUrl, fechaCreacion });
        }
        setGenerated(results);
        setActiveResult(0);
        setGenerating(false);
        toast(`🎉 ${results.length} constancia(s) generada(s)`, 'success');
      };

      // Vista previa
      const previewNombre = mode === 'manual' ? nombre : (excelList[0]?.nombre || '');

      return (
        <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
          {/* Header */}
          <div style={{ background:'#fff', borderRadius:16, padding:'18px 22px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1a1a2e' }}>Generar Constancias</h2>
              <p style={{ margin:'2px 0 0', fontSize:13, color:'#999' }}>Plantilla oficial ITD · QR de verificación incluido</p>
            </div>
            <Badge color="#1B396A">📄 PDF + QR</Badge>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,1fr) minmax(260px,400px)', gap:18, alignItems:'start' }}>
            {/* Columna izquierda: formulario */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Configuración */}
              <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#333' }}>⚙️ Configuración del documento</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <SelectField label="Tipo" value={form.tipo} onChange={sf('tipo')} options={[
                    { value:'constancia',    label:'📜 Constancia' },
                    { value:'reconocimiento',label:'🏅 Reconocimiento' },
                  ]}/>
                  <Field label="Descripción / Actividad *" value={form.descripcion} onChange={sf('descripcion')} placeholder="Ej: Participación en Congreso ITD 2026" required/>
                  <Field label="Fecha de expedición" value={form.fecha} onChange={sf('fecha')} placeholder="Ej: 8 de marzo de 2026"/>
                  <Field label="Firmante" value={form.firmante} onChange={sf('firmante')} placeholder="Nombre del firmante"/>
                  <Field label="Cargo" value={form.cargo} onChange={sf('cargo')} placeholder="Cargo institucional"/>
                </div>
              </div>

              {/* Destinatario(s) */}
              <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700, color:'#333' }}>👤 Destinatario(s)</h3>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  {[{k:'manual',l:'✍️ Manual'},{k:'excel',l:'📊 Excel'}].map(t => (
                    <button key={t.k} onClick={() => setMode(t.k)} style={{ flex:1, padding:'9px 10px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:'none', fontFamily:"'DM Sans',sans-serif", background:mode===t.k?'#1B396A':'#f3f4f6', color:mode===t.k?'#F5E4A8':'#555', transition:'all .15s' }}>{t.l}</button>
                  ))}
                </div>

                {mode === 'manual'
                  ? <Field label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Ej: Dra. María García López" required/>
                  : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <p style={{ fontSize:13, color:'#666', lineHeight:1.6, margin:0 }}>
                        Archivo <strong>.xlsx/.xls</strong>. Primera fila = encabezados.<br/>
                        Columna detectada automáticamente: <em>Nombre</em>, Participante, Docente, Alumno.<br/>
                        Columna opcional: <em>Correo</em>.
                      </p>
                      <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleExcelUpload} style={{ display:'none' }}/>
                      <Btn onClick={() => fileRef.current?.click()} variant="ghost">📂 Seleccionar archivo Excel</Btn>
                      {excelErr && <p style={{ margin:0, fontSize:12, color:'#c00' }}>⚠ {excelErr}</p>}
                      {excelList.length > 0 && (
                        <div style={{ background:'#f0fdf4', borderRadius:10, padding:'10px 14px', border:'1px solid #86efac' }}>
                          <strong style={{ fontSize:13, color:'#14532d' }}>✅ {excelList.length} nombre(s) cargados</strong>
                          <div style={{ maxHeight:100, overflowY:'auto', marginTop:6, display:'flex', flexDirection:'column', gap:2 }}>
                            {excelList.slice(0,6).map((n,i) => <span key={i} style={{ fontSize:12, color:'#166534' }}>• {n.nombre}{n.correo?` — ${n.correo}`:''}</span>)}
                            {excelList.length>6 && <span style={{ fontSize:11, color:'#888' }}>…y {excelList.length-6} más</span>}
                          </div>
                        </div>
                      )}
                    </div>
                }
              </div>

              <Btn onClick={generarConstancias} disabled={generating} full>
                {generating ? <><Spinner small/> Generando constancias…</> : '🚀 Generar Constancia(s)'}
              </Btn>
            </div>

            {/* Columna derecha: preview + resultados */}
            <div style={{ display:'flex', flexDirection:'column', gap:14, position:'sticky', top:72 }}>

              {/* Vista previa */}
              <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700, color:'#333' }}>👁 Vista previa</h3>
                <div style={{ background:'linear-gradient(135deg,#f8f4ec,#efe7d5)', borderRadius:12, padding:'20px 22px', textAlign:'center', border:'2px solid #e8d5b0', position:'relative' }}>
                  <div style={{ position:'absolute', top:7, left:7, right:7, bottom:7, border:'1px solid #C49A3530', borderRadius:8, pointerEvents:'none' }}/>

                  {/* QR mini en preview */}
                  {previewNombre && (
                    <div style={{ position:'absolute', bottom:10, left:12, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <div style={{ padding:3, background:'#fff', border:'1px solid #C49A35', borderRadius:4 }}>
                        <img src={getQRImageURL(previewNombre, new Date().toISOString().split('T')[0])} style={{ width:36, height:36, display:'block' }} alt="QR"/>
                      </div>
                      <span style={{ fontSize:6, color:'#8B1A2A', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase' }}>Verif. ITD</span>
                    </div>
                  )}

                  <div style={{ fontSize:9, letterSpacing:'.2em', color:'#8B1A2A', textTransform:'uppercase', fontWeight:700, marginBottom:5 }}>Otorga la presente</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:'#3D0A14', marginBottom:8 }}>
                    {form.tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'}
                  </div>
                  <div style={{ fontSize:10, color:'#777', marginBottom:5 }}>a</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:15, color:'#1B396A', fontWeight:700, borderBottom:'1px solid #C49A35', paddingBottom:6, marginBottom:8 }}>
                    {previewNombre || 'Nombre del destinatario'}
                  </div>
                  {form.descripcion && <div style={{ fontSize:10, color:'#555', fontWeight:700, marginBottom:6 }}>{form.descripcion}</div>}
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:12 }}>Durango, Dgo. a {form.fecha}</div>
                  <div style={{ width:80, height:1, background:'linear-gradient(90deg,transparent,#3D0A14,transparent)', margin:'0 auto 3px' }}/>
                  <div style={{ fontSize:8, fontWeight:700, color:'#3D0A14' }}>{form.firmante}</div>
                  <div style={{ fontSize:7, color:'#aaa', textTransform:'uppercase', letterSpacing:'.03em' }}>{form.cargo}</div>
                </div>
                <p style={{ margin:'8px 0 0', fontSize:10, color:'#bbb', textAlign:'center' }}>El PDF incluye bordes, sello y QR de verificación</p>
              </div>

              {/* Resultados */}
              {generated.length > 0 && (
                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                  <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700, color:'#333' }}>✅ Generadas ({generated.length})</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {generated.map((g, i) => (
                      <div key={i} style={{ background:'#f8faff', borderRadius:10, padding:'12px 14px', border:'1px solid #e0e8f5' }}>
                        {/* Nombre + QR data */}
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                          <img src={getQRImageURL(g.nombre, g.fechaCreacion)} alt="QR"
                            style={{ width:44, height:44, borderRadius:6, border:'1.5px solid #C49A35', flexShrink:0, background:'#fff', padding:2 }}
                          />
                          <div>
                            <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{g.nombre}</div>
                            <div style={{ fontSize:9, color:'#bbb', fontFamily:'monospace', marginTop:2 }}>{buildQRData(g.nombre, g.fechaCreacion)}</div>
                          </div>
                        </div>
                        {/* Acciones */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          <button onClick={() => downloadPDF(g.html, g.nombre)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#eff6ff', color:'#1B396A', border:'1px solid #bfdbfe' }}>⬇ PDF</button>
                          <button onClick={() => printConstancia(g.html)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#f0fdf4', color:'#14532d', border:'1px solid #86efac' }}>🖨 Imprimir</button>
                          <button onClick={() => emailConstancia(g.nombre, form.tipo, form.descripcion, form.fecha)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#fefce8', color:'#713f12', border:'1px solid #fde68a' }}>📧 Correo</button>
                          {g.driveUrl && (
                            <a href={g.driveUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#fdf4ff', color:'#701a75', border:'1px solid #e879f9', textDecoration:'none' }}>☁ Drive</a>
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

    // ── ADMIN USUARIOS ────────────────────────────────────────
    const AdminUsersScreen = ({ currentAdmin, toast }) => {
      const [users, setUsers]   = useState(getUsers);
      const [showForm, setShowForm] = useState(false);
      const [form, setForm]     = useState({ name:'', email:'', password:'', isAdmin:false });
      const [formErr, setFormErr]   = useState('');
      const [saving, setSaving] = useState(false);
      const sf = k => v => setForm(f => ({ ...f, [k]: v }));

      const handleCreate = async () => {
        setFormErr('');
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setFormErr('Todos los campos son requeridos.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormErr('Correo inválido.'); return; }
        const existing = getUsers();
        if (existing.find(u => u.email === form.email.toLowerCase())) { setFormErr('Ya existe ese correo.'); return; }
        setSaving(true);
        const hash = await simpleHash(form.password);
        const nu = { id: Date.now().toString(), name: form.name.trim(), email: form.email.trim().toLowerCase(), hash, isAdmin: form.isAdmin, active: true, createdAt: new Date().toISOString() };
        const updated = [...existing, nu];
        saveUsers(updated); setUsers(updated);
        setForm({ name:'', email:'', password:'', isAdmin:false }); setShowForm(false); setSaving(false);
        toast(`✅ Usuario ${nu.email} creado`, 'success');
      };

      const toggleActive = (id) => {
        const updated = getUsers().map(u => u.id === id ? { ...u, active: !u.active } : u);
        saveUsers(updated); setUsers(updated); toast('Estado actualizado', 'info');
      };

      const deleteUser = (id) => {
        const u = getUsers().find(x => x.id === id);
        if (!u || !confirm(`¿Eliminar usuario ${u.email}?`)) return;
        const updated = getUsers().filter(x => x.id !== id);
        saveUsers(updated); setUsers(updated); toast('Usuario eliminado', 'info');
      };

      return (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'18px 22px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1a1a2e' }}>Gestión de Usuarios</h2>
              <p style={{ margin:'2px 0 0', fontSize:13, color:'#999' }}>{users.length} usuario(s) registrado(s)</p>
            </div>
            <Btn onClick={() => setShowForm(v => !v)} variant={showForm?'ghost':'primary'}>
              {showForm ? '✕ Cancelar' : '+ Nuevo usuario'}
            </Btn>
          </div>

          {showForm && (
            <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'2px solid #1B396A18' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1B396A' }}>➕ Crear usuario</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                <Field label="Nombre completo" value={form.name} onChange={sf('name')} placeholder="Nombre Apellido" required/>
                <Field label="Correo" value={form.email} onChange={sf('email')} placeholder="usuario@itdurango.edu.mx" type="email" required/>
                <Field label="Contraseña inicial" value={form.password} onChange={sf('password')} placeholder="Min. 6 caracteres" type="password" required/>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#555', letterSpacing:'.04em', textTransform:'uppercase' }}>Rol</label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e0e0e0', fontSize:14 }}>
                    <input type="checkbox" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}/>
                    Administrador
                  </label>
                </div>
              </div>
              {formErr && <p style={{ margin:'10px 0 0', fontSize:13, color:'#c00' }}>⚠ {formErr}</p>}
              <div style={{ marginTop:14, display:'flex', gap:8 }}>
                <Btn onClick={handleCreate} disabled={saving}>{saving ? <><Spinner small/> Guardando…</> : '💾 Crear usuario'}</Btn>
                <Btn onClick={() => { setShowForm(false); setFormErr(''); }} variant="ghost">Cancelar</Btn>
              </div>
            </div>
          )}

          <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
            {users.length === 0
              ? <div style={{ padding:'40px 24px', textAlign:'center', color:'#aaa' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>👤</div>
                  <div style={{ fontWeight:700 }}>Sin usuarios — crea el primero</div>
                </div>
              : <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 90px 90px 110px', gap:8, padding:'10px 18px', background:'#f8fafc', borderBottom:'1px solid #eee', fontSize:10, fontWeight:700, color:'#999', textTransform:'uppercase', letterSpacing:'.05em' }}>
                    <span>Nombre</span><span>Correo</span><span>Rol</span><span>Estado</span><span style={{textAlign:'right'}}>Acciones</span>
                  </div>
                  {users.map(u => (
                    <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 90px 90px 110px', gap:8, padding:'12px 18px', alignItems:'center', borderBottom:'1px solid #f5f5f5', background: u.active ? '#fff' : '#fafafa', opacity: u.active ? 1 : .65 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{u.name}</div>
                        <div style={{ fontSize:10, color:'#bbb' }}>{new Date(u.createdAt).toLocaleDateString('es-MX')}</div>
                      </div>
                      <div style={{ fontSize:12, color:'#666', wordBreak:'break-all' }}>{u.email}</div>
                      <div><Badge color={u.isAdmin?'#8B1A2A':'#1B396A'}>{u.isAdmin?'Admin':'Usuario'}</Badge></div>
                      <div>
                        <button onClick={() => toggleActive(u.id)} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:u.active?'#dcfce7':'#fee2e2', color:u.active?'#14532d':'#7f1d1d' }}>
                          {u.active?'Activo':'Inactivo'}
                        </button>
                      </div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        {u.email !== currentAdmin.email && (
                          <button onClick={() => deleteUser(u.id)} style={{ padding:'5px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#fef2f2', color:'#7f1d1d', border:'1px solid #fecaca' }}>🗑</button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
            }
          </div>
        </div>
      );
    };

    // ── DASHBOARD ─────────────────────────────────────────────
    const Dashboard = ({ user, onLogout }) => {
      const [tab, setTab]       = useState('generar');
      const [toastMsg, setToastMsg] = useState(null);
      const toast = (msg, type='info') => setToastMsg({ msg, type });
      const tabs = [
        { key:'generar',   label:'📜 Generar' },
        ...(user.isAdmin ? [{ key:'usuarios', label:'👥 Usuarios' }] : []),
      ];

      return (
        <div style={{ minHeight:'100vh', background:'#f4f6fa', fontFamily:"'DM Sans',sans-serif" }}>
          {/* Navbar */}
          <nav style={{ background:'#fff', borderBottom:'1px solid #e8ecf2', position:'sticky', top:0, zIndex:50, boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', height:60, gap:14 }}>
              <ITDLogo size={36}/>
              <div style={{ width:1, height:28, background:'#e5e5e5' }}/>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#1B396A', lineHeight:1.2 }}>Otras Constancias</div>
                <div style={{ fontSize:10, color:'#bbb' }}>Instituto Tecnológico de Durango</div>
              </div>
              <div style={{ flex:1 }}/>
              {/* Tabs */}
              <div style={{ display:'flex', gap:4 }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:'none', fontFamily:"'DM Sans',sans-serif", background:tab===t.key?'#1B396A':'transparent', color:tab===t.key?'#F5E4A8':'#666', transition:'all .15s' }}>{t.label}</button>
                ))}
              </div>
              {/* Usuario */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1B396A,#2B5580)', display:'flex', alignItems:'center', justifyContent:'center', color:'#F5E4A8', fontSize:13, fontWeight:700 }}>
                  {(user.name||user.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ display:'flex', flexDirection:'column', lineHeight:1.3 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#333' }}>{user.name||'Usuario'}</span>
                  {user.isAdmin && <Badge color="#8B1A2A">Admin</Badge>}
                </div>
                <button onClick={onLogout} style={{ padding:'6px 12px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', background:'#fef2f2', color:'#7f1d1d', border:'1px solid #fecaca', marginLeft:4 }}>Salir</button>
              </div>
            </div>
          </nav>

          <main style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>
            {tab==='generar'  && <GeneradorScreen user={user} toast={toast}/>}
            {tab==='usuarios' && user.isAdmin && <AdminUsersScreen currentAdmin={user} toast={toast}/>}
          </main>

          {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)}/>}
        </div>
      );
    };

    // ── ROOT ──────────────────────────────────────────────────
    const App = () => {
      const [user, setUser] = useState(() => getSession());

      // Crear admin principal si no existe
      useEffect(() => {
        const users = getUsers();
        if (!users.find(u => u.email === ADMIN_EMAIL)) {
          simpleHash('Xela1615').then(hash => {
            saveUsers([...getUsers(), {
              id: 'admin_principal',
              name: 'Dr. Alejandro Calderón Rentería',
              email: ADMIN_EMAIL, hash,
              isAdmin: true, active: true,
              createdAt: new Date().toISOString()
            }]);
          });
        }
      }, []);

      const handleLogin  = (u) => setUser(u);
      const handleLogout = () => { clearSession(); setUser(null); };

      if (!user) return <LoginScreen onLogin={handleLogin}/>;
      return <Dashboard user={user} onLogout={handleLogout}/>;
    };

    // ── RENDER ────────────────────────────────────────────────
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App/>);
  </script>
</body>
</html>
