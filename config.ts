// config.ts

// Chave protegida e ofuscada para ser embutida no código.
// Substitua o valor pela sua chave real codificada em Base64. Ex: btoa("AIza...")
const _obfKey = "QUl6YVN5bFZ5QkV4LWNoYXZlX0tleQ=="; // Placeholder as per instructions

/**
 * A chave de API decodificada do Google Gemini.
 * Esta é a única fonte de verdade para autenticação na aplicação.
 */
export const GEMINI_API_KEY = typeof window !== 'undefined' ? window.atob(_obfKey) : '';
