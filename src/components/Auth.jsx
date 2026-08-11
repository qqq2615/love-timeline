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
        <h1 className="setup-title">先登录，再开始记录</h1>
        <p className="setup-desc">
          这个站点现在使用共享空间模式。
          输入你们约定好的空间密码后，就可以继续设置纪念日、上传照片和同步数据。
        </p>
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
