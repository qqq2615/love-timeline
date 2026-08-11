import { API_BASE } from './config';

const TOKEN_KEY = 'love-timeline-jwt';
const USERNAME_KEY = 'love-timeline-username';
const SPACE_ID_KEY = 'love-timeline-space-id';
const SPACE_LABEL_KEY = 'love-timeline-space-label';
const LOGIN_PASSWORD_KEY = 'love-timeline-login-password';

export async function register() {
  throw new Error('当前站点已改为共享空间模式，不再支持单独注册账号');
}

export async function login(usernameOrPassword, maybePassword) {
  const password = typeof maybePassword === 'string' ? maybePassword : usernameOrPassword;

  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw new Error((await res.json()).error || '登录失败');
  }

  const payload = await res.json();
  localStorage.setItem(TOKEN_KEY, payload.token);
  localStorage.setItem(USERNAME_KEY, payload.username || payload.spaceLabel || '');

  if (payload.spaceId) {
    localStorage.setItem(SPACE_ID_KEY, payload.spaceId);
  }

  if (payload.spaceLabel || payload.username) {
    localStorage.setItem(SPACE_LABEL_KEY, payload.spaceLabel || payload.username);
  }

  if (password) {
    sessionStorage.setItem(LOGIN_PASSWORD_KEY, password);
  }

  return payload;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(SPACE_ID_KEY);
  localStorage.removeItem(SPACE_LABEL_KEY);
  sessionStorage.removeItem(LOGIN_PASSWORD_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || localStorage.getItem(SPACE_LABEL_KEY);
}

export function getSpaceId() {
  return localStorage.getItem(SPACE_ID_KEY);
}

export function getSpaceLabel() {
  return localStorage.getItem(SPACE_LABEL_KEY) || localStorage.getItem(USERNAME_KEY);
}

export function getLoginPassword() {
  return sessionStorage.getItem(LOGIN_PASSWORD_KEY) || '';
}

export default {
  register,
  login,
  logout,
  getToken,
  getUsername,
  getSpaceId,
  getSpaceLabel,
  getLoginPassword,
};
