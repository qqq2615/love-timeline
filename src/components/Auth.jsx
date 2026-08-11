import { useState } from 'react';
import { register, login } from '../utils/auth';

export default function Auth({ onClose, onAuthenticated, fullScreen = false }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();

    try {
      setError('');

      if (mode === 'register') {
        await register(username, password);
        alert('注册成功，请登录');
        setMode('login');
        return;
      }

      await login(username, password);
      if (onAuthenticated) onAuthenticated();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || '出错了，请稍后再试');
    }
  };

  const content = (
    <div className={fullScreen ? 'auth-card auth-card-full' : 'modal-card auth-card'}>
      <div className="auth-header">
        <div className="setup-heart">💕</div>
        <h1 className="setup-title">{mode === 'login' ? '先登录，再开始记录' : '先注册，再创建你们的时间线'}</h1>
        <p className="setup-desc">
          {mode === 'login'
            ? '登录后就可以继续设置纪念日、上传照片和同步回忆。'
            : '注册一个账号后，再进入纪念日设置和后续的时间线管理。'}
        </p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <input
          className="setup-input"
          placeholder="用户名"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          type="password"
          className="setup-input"
          placeholder="密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="form-error">{error}</p>}

        <button className="setup-btn" type="submit">
          {mode === 'login' ? '登录' : '注册'}
        </button>

        <button
          type="button"
          className="auth-switch-btn"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
        </button>

        {!fullScreen && (
          <button type="button" className="auth-cancel-btn" onClick={onClose}>
            取消
          </button>
        )}
      </form>
    </div>
  );

  if (fullScreen) {
    return <div className="setup-page auth-page">{content}</div>;
  }

  return <div className="modal-backdrop">{content}</div>;
}
