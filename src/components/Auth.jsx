import { useState } from 'react';
import { register, login } from '../utils/auth';

export default function Auth({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'register') {
        await register(username, password);
        alert('注册成功，请登录');
        setMode('login');
        return;
      }
      await login(username, password);
      setError('');
      onAuthenticated && onAuthenticated();
      onClose && onClose();
    } catch (err) {
      setError(err.message || '出错了');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{mode === 'login' ? '登录' : '注册'}</h3>
        <form onSubmit={submit}>
          <input className="setup-input" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="setup-input" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="form-error">{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="setup-btn" type="submit">{mode === 'login' ? '登录' : '注册'}</button>
            <button type="button" className="setup-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '去注册' : '去登录'}</button>
            <button type="button" className="setup-btn" onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
