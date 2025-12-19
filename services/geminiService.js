import { GoogleGenAI } from "@google/genai";

// NOTA: En un repositorio público de GitHub Pages, cualquier clave API expuesta aquí será pública.
// Se recomienda usar este servicio solo con fines demostrativos o con claves restringidas por dominio.
// Si no hay clave, el servicio fallará elegantemente.

// Intenta leer una clave global si el usuario la define en index.html o aquí mismo.
const API_KEY = ""; // <--- COLOCA TU API KEY AQUÍ SI LA DESEAS FIJA

export const askGemini = async (question, contextData) => {
    // Verificamos si hay clave
    const key = API_KEY || (window.process && window.process.env && window.process.env.API_KEY);

    if (!key) {
        return "Para usar el asistente IA, se requiere configurar la API Key en el código.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        
        // Prepare context from certificates
        const dataSummary = contextData.map(c => 
            `- ${c.curso} (${c.year}): Estado ${c.status}. Link: ${c.link !== '#' ? 'Disponible' : 'No disponible'}`
        ).join('\n');

        const prompt = `
        Eres un asistente útil para el Portal de Constancias del IT Durango.
        El usuario pregunta: "${question}"
        
        Aquí tienes la lista de sus constancias disponibles:
        ${dataSummary}
        
        Si la lista está vacía, dile amablemente que no se encontraron registros con los filtros actuales.
        Responde de manera breve, cordial y profesional en Español.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite-latest',
            contents: prompt,
        });

        return response.text || "Lo siento, no pude procesar tu solicitud en este momento.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Hubo un error al conectar con el asistente inteligente.";
    }
};