import { useState } from 'react';

// 密码来自环境变量，没有配置则用默认值
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'iloveyou';

export default function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      localStorage.setItem('love-timeline-unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-heart">💕</div>
        <h1 className="setup-title">恋爱时光轴</h1>
        <p className="setup-desc">这是属于我们的私密空间<br />请输入密码进入</p>

        <form className="setup-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="setup-input"
            placeholder="输入访问密码"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            autoFocus
          />
          {error && (
            <p className="form-error">密码不对哦～再试一次</p>
          )}
          <button
            type="submit"
            className="setup-btn"
            disabled={!input}
          >
            进入 💝
          </button>
        </form>
      </div>
    </div>
  );
}
