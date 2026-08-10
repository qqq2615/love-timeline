import TimelineItem from './TimelineItem';

export default function Timeline({
  memories,
  anniversary,
  onMediaClick,
  onEdit,
  onDelete,
}) {
  if (!memories || memories.length === 0) {
    return (
      <div className="timeline-empty">
        <div className="empty-icon">📷</div>
        <h3>还没有记录</h3>
        <p>点击右下角的 <strong>+</strong> 按钮<br />添加你们的第一个回忆吧 💕</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {/* 垂直时间轴线 */}
      <div className="timeline-line" />

      <div className="timeline-list">
        {memories.map((memory, index) => (
          <TimelineItem
            key={memory.id}
            memory={memory}
            index={index}
            onMediaClick={onMediaClick}
            onEdit={onEdit}
            onDelete={onDelete}
            anniversary={anniversary}
          />
        ))}
      </div>

      {/* 底部提醒 */}
      <div className="timeline-footer">
        <p>💕 你们的每一天都值得被铭记 💕</p>
      </div>
    </div>
  );
}
