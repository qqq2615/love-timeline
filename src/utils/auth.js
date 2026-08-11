import { API_BASE } from './config';

export async function register(username, password) {
  const res = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!res.ok) throw new Error((await res.json()).error || '注册失败');
  return true;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!res.ok) throw new Error((await res.json()).error || '登录失败');
  const j = await res.json();
  localStorage.setItem('love-timeline-jwt', j.token);
  localStorage.setItem('love-timeline-username', j.username);
  return j;
}

export function logout() {
  localStorage.removeItem('love-timeline-jwt');
  localStorage.removeItem('love-timeline-username');
}

export function getToken() {
  return localStorage.getItem('love-timeline-jwt');
}

export function getUsername() {
  return localStorage.getItem('love-timeline-username');
}

export default { register, login, logout, getToken, getUsername };
