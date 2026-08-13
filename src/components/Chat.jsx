import { useState } from 'react';

// 固定的两人头像：💙 = 'a'（左），💗 = 'b'（右）
const CHAT_SENDERS = [
  { id: 'a', emoji: '💙' },
  { id: 'b', emoji: '💗' },
];

function senderEmoji(id) {
  return CHAT_SENDERS.find((s) => s.id === id)?.emoji || CHAT_SENDERS[0].emoji;
}

// 只读展示：按 sender 分左右气泡
export function ChatBubbles({ messages }) {
  if (!messages || messages.length === 0) return null;

  return (
    <div className="chat-thread">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`chat-msg ${msg.sender === 'b' ? 'right' : 'left'}`}
        >
          <span className="chat-avatar">{senderEmoji(msg.sender)}</span>
          <div className="chat-bubble">{msg.text}</div>
        </div>
      ))}
    </div>
  );
}

// 可编辑：留言列表 + 底部输入行
export function ChatComposer({ messages = [], onChange }) {
  const [text, setText] = useState('');
  const [sender, setSender] = useState('a');

  const addMessage = () => {
    const value = text.trim();
    if (!value) return;
    onChange([...(messages || []), { sender, text: value }]);
    setText('');
  };

  const removeMessage = (index) => {
    onChange((messages || []).filter((_, i) => i !== index));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addMessage();
    }
  };

  return (
    <div className="chat-composer">
      <div className="chat-thread chat-thread-editable">
        {(messages || []).map((msg, index) => (
          <div
            key={index}
            className={`chat-msg ${msg.sender === 'b' ? 'right' : 'left'}`}
          >
            <span className="chat-avatar">{senderEmoji(msg.sender)}</span>
            <div className="chat-bubble">
              <span className="chat-text">{msg.text}</span>
              <button
                type="button"
                className="chat-remove"
                title="删除这条留言"
                onClick={() => removeMessage(index)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {(messages || []).length === 0 && (
          <p className="chat-empty">还没有留言，在下方输入第一条 💬</p>
        )}
      </div>

      <div className="chat-input-row">
        <div className="chat-sender-toggle">
          {CHAT_SENDERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chat-sender-btn ${sender === s.id ? 'active' : ''}`}
              onClick={() => setSender(s.id)}
            >
              {s.emoji}
            </button>
          ))}
        </div>
        <input
          className="chat-input"
          value={text}
          placeholder="说点什么..."
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="chat-send"
          onClick={addMessage}
          disabled={!text.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
}
