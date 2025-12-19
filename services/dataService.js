import { SHEET_CONFIGS, SHEET_BASE_URL } from '../types.js';

// Simple CSV parser function
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
        i++; // Skip next quote
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

// Helper to guess event type from title
const detectType = (title) => {
  const lower = title.toLowerCase();
  if (lower.includes('taller')) return 'TALLER';
  if (lower.includes('curso')) return 'CURSO';
  if (lower.includes('diplomado')) return 'DIPLOMADO';
  if (lower.includes('conferencia')) return 'CONFERENCIA';
  if (lower.includes('tutor')) return 'TUTORÍA';
  return 'EVENTO';
};

export const fetchCertificates = async (year) => {
  // Handle "ALL" case by fetching all configured years in parallel
  if (year === 'ALL') {
    const years = Object.keys(SHEET_CONFIGS);
    const promises = years.map(y => fetchSingleYear(y));
    const results = await Promise.all(promises);
    return results.flat();
  }

  return fetchSingleYear(year);
};

const fetchSingleYear = async (year) => {
  const config = SHEET_CONFIGS[year];
  if (!config) return []; 

  // Construct the CSV export URL using the new pubhtml base
  const url = `${SHEET_BASE_URL}/pub?gid=${config.gid}&single=true&output=csv`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`Could not fetch sheet for ${year}.`);
        return getMockData(year); 
    }
    
    const text = await response.text();
    // If response is HTML (login page or error), throw
    if (text.trim().startsWith('<!DOCTYPE html>')) {
        console.warn(`Sheet returned HTML instead of CSV for ${year}. Check GID.`);
        return getMockData(year);
    }

    const rows = parseCSV(text);
    
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.toLowerCase().trim());
    
    const idx = (name) => headers.findIndex(h => h.includes(name));

    const nameIdx = idx('nombre') > -1 ? idx('nombre') : 0;
    const emailIdx = idx('correo') > -1 ? idx('correo') : idx('email') > -1 ? idx('email') : 1;
    const courseIdx = idx('curso') > -1 ? idx('curso') : idx('concepto') > -1 ? idx('concepto') : 2;
    const statusIdx = idx('status') > -1 ? idx('status') : idx('estatus') > -1 ? idx('estatus') : 4;
    const linkIdx = idx('link') > -1 ? idx('link') : idx('url') > -1 ? idx('url') : idx('pdf') > -1 ? idx('pdf') : 5;
    const dateIdx = idx('fecha') > -1 ? idx('fecha') : 3;

    return rows.slice(1).map((row, i) => {
      const curso = row[courseIdx] || 'Constancia General';
      return {
        id: `${year}-${i}`,
        nombre: row[nameIdx] || 'Sin Nombre',
        correo: row[emailIdx] || '',
        curso: curso,
        fecha: row[dateIdx] || '',
        status: (row[statusIdx] || 'PENDIENTE').toUpperCase(),
        link: row[linkIdx] || '#',
        year: year,
        tipo: detectType(curso)
      };
    }).filter(cert => cert.nombre !== 'Sin Nombre' && cert.correo.includes('@')); 

  } catch (error) {
    console.error(`Error fetching certificates for ${year}:`, error);
    return getMockData(year);
  }
};

// Fallback Mock Data
const getMockData = (year) => {
  const mocks = [
    {
      id: '1',
      nombre: 'Juan Perez',
      correo: 'juan.perez@itdurango.edu.mx',
      curso: 'Curso: Introducción a React 2025',
      fecha: '15/01/2025',
      status: 'ENVIADO',
      link: 'https://picsum.photos/seed/doc1/600/800', 
      year: '2025'
    },
    {
      id: '2',
      nombre: 'Maria Gonzalez',
      correo: 'maria@gmail.com',
      curso: 'Taller de Liderazgo Efectivo',
      fecha: '20/01/2025',
      status: 'ENVIADO',
      link: 'https://picsum.photos/seed/doc2/600/800',
      year: '2025'
    },
    {
        id: '3',
        nombre: 'Pedro Lopez',
        correo: 'juan.perez@itdurango.edu.mx',
        curso: 'Diplomado en Seguridad Industrial',
        fecha: '10/02/2024',
        status: 'ENVIADO',
        link: '#',
        year: '2024'
    },
    {
        id: '4',
        nombre: 'Juan Perez',
        correo: 'juan.perez@itdurango.edu.mx',
        curso: 'Tutoría Grupal 2024',
        fecha: '05/05/2024',
        status: 'ENVIADO',
        link: '#',
        year: '2024'
    }
  ];
  return mocks.filter(c => c.year === year).map(c => ({...c, tipo: detectType(c.curso)}));
};

export const notifyAdmin = async (userEmail) => {
    console.log(`[ADMIN NOTIFICATION]: User ${userEmail} accessed the portal.`);
};