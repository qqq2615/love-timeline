/**
 * 媒体处理工具
 * - 照片压缩 (Canvas)
 * - 视频缩略图 (Canvas 截帧)
 * - EXIF 日期提取
 */

/**
 * 压缩图片到指定宽度，返回 Blob
 */
export function compressImage(file, maxWidth = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('压缩失败'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 创建缩略图 Blob (最大宽度 400px)
 */
export function createThumbnail(file, maxWidth = 400) {
  return compressImage(file, maxWidth, 0.7);
}

/**
 * 从视频文件截取第 N 秒的帧作为缩略图
 */
export function captureVideoFrame(file, seekTime = 1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // 跳到 seekTime 秒
      video.currentTime = Math.min(seekTime, video.duration || 1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth, 400);
      canvas.height = Math.round(
        (video.videoHeight / video.videoWidth) * canvas.width
      );

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve({
              blob,
              duration: Math.round(video.duration || 0),
            });
          } else {
            reject(new Error('截帧失败'));
          }
        },
        'image/jpeg',
        0.75
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('视频加载失败'));
    };

    video.src = url;
    video.load();
  });
}

/**
 * 从文件中提取 EXIF 拍摄日期
 */
export async function extractPhotoDate(file) {
  try {
    const exifr = await import('exifr');
    const exifData = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    if (exifData?.DateTimeOriginal) {
      const d = exifData.DateTimeOriginal;
      if (d instanceof Date) return formatDateStr(d);
      return formatDateStr(String(d).replace(/:/g, '-').replace(' ', 'T').slice(0, 19));
    }
    if (exifData?.CreateDate) {
      const d = exifData.CreateDate;
      if (d instanceof Date) return formatDateStr(d);
      return formatDateStr(String(d).replace(/:/g, '-').replace(' ', 'T').slice(0, 19));
    }
  } catch (e) {
    console.log('EXIF 解析失败:', e);
  }
  // 降级：用文件修改时间
  return formatDateStr(new Date(file.lastModified || Date.now()));
}

function formatDateStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化视频时长 mm:ss
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
