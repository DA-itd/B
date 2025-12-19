// The base URL for the published sheet provided by the user
export const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSRQV8teF1KNHOAJfmp61EmHt6D0ladQb_A18c3gk9cN4RfrXUPiVw_CXLhAYJhZ9-PTHMcyVhdacI8";

// Mapping for your specific Google Sheet Tabs
// IMPORTANTE: Los GID (Group IDs) determinan qué pestaña se descarga.
export const SHEET_CONFIGS = {
  '2024': {
    gid: '1692633094', 
    year: '2024'
  },
  '2025': {
    gid: '0', 
    year: '2025'
  },
  '2026': {
    gid: '123456789', 
    year: '2026'
  }
};