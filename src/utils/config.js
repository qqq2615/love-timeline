// API 基础地址（可通过 VITE_API_BASE 注入）
const fallbackApiBase = import.meta.env && import.meta.env.DEV ? 'http://localhost:3000' : '';
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE?.trim()) || fallbackApiBase;

export default { API_BASE };
