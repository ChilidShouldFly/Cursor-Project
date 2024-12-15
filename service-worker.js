// 安装事件
self.addEventListener('install', (event) => {
  console.log('Service Worker 已安装');
});

// 激活事件
self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活');
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.type === 'TIMER_COMPLETE') {
    showNotification(message.timerType);
  }
  
  return true;
});

// 显示通知
function showNotification(timerType) {
  const options = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: '番茄钟提醒',
    message: timerType === 'work' ? '专注时间结束啦！该休息一下了' : '休息结束啦！继续开始新的专注吧'
  };

  try {
    chrome.notifications.create('', options, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('通知创建失败:', chrome.runtime.lastError);
      } else {
        console.log('通知创建成功:', notificationId);
      }
    });
  } catch (error) {
    console.error('创建通知时出错:', error);
  }
}

// 初始化设置
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  
  chrome.storage.local.set({
    defaultWorkTime: 5,
    defaultBreakTime: 5
  });
}); 