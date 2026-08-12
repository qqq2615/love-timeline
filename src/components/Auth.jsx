import { useState } from 'react';
import { login } from '../utils/auth';

export default function Auth({ onClose, onAuthenticated, fullScreen = false }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();

    try {
      setError('');
      await login(password);
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
        <h1 className="artistic-title">
          <span className="artistic-char">翻</span>
          <span className="artistic-char">开</span>
          <span className="artistic-char">我</span>
          <span className="artistic-char">们</span>
          <span className="artistic-char">的</span>
          <span className="artistic-char">回</span>
          <span className="artistic-char">忆</span>
        </h1>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <input
          type="password"
          className="setup-input"
          placeholder="共享空间密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="form-error">{error}</p>}

        <button className="setup-btn" type="submit">
          进入时间线
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
