/**
 * 计算两个日期之间的天数差
 * @param {string|Date} date1 - 较早的日期
 * @param {string|Date} date2 - 较晚的日期，默认为今天
 * @returns {number} 天数差
 */
export function daysBetween(date1, date2 = new Date()) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  // 重置时间为当天 0 点，确保整天计算
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为中文展示格式
 */
export function formatDateCN(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[d.getDay()];
  return `${year}年${month}月${day}日 周${weekDay}`;
}

/**
 * 格式化日期为简短中文
 */
export function formatDateShort(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

/**
 * 获取某日期的年份
 */
export function getYear(date) {
  return new Date(date).getFullYear();
}

/**
 * 计算纪念日天数文案
 */
export function getAnniversaryText(days) {
  if (days === 0) return '就是今天 💕';
  if (days < 0) return `还有 ${Math.abs(days)} 天`;
  return `${days} 天`;
}

/**
 * 生成唯一 ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
