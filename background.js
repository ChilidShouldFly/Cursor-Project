console.log('后台脚本已加载');

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  
  // 设置默认配置
  chrome.storage.local.set({
    defaultWorkTime: 5,
    defaultBreakTime: 5
  });
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '发送者:', sender);
  
  switch (message.type) {
    case 'SHOW_NOTIFICATION':
      console.log('准备创建通知, 完整信息:', {
        message,
        currentTime: new Date().toISOString(),
        sender
      });

      // 先检查通知权限
      chrome.notifications.getPermissionLevel((level) => {
        console.log('当前通知权限级别:', level);
        if (level === 'granted') {
          // 创建通知
          chrome.notifications.create(
            'pomodoroTimer_' + Date.now(),
            {
              type: 'basic',
              iconUrl: '/icon.png',
              title: '番茄钟提醒',
              message: message.message || '时间到！',
              requireInteraction: true,
              priority: 2
            },
            (notificationId) => {
              if (chrome.runtime.lastError) {
                console.error('通知创建失败:', chrome.runtime.lastError);
                console.error('错误详情:', {
                  message: chrome.runtime.lastError.message,
                  stack: new Error().stack
                });
                sendResponse({ success: false, error: chrome.runtime.lastError });
              } else {
                console.log('通知创建成功, ID:', notificationId);
                sendResponse({ success: true, notificationId });
              }
            }
          );
        } else {
          console.error('通知权限未获得:', level);
          sendResponse({ success: false, error: '通知权限未获得' });
        }
      });
      return true;
      
    case 'CHECK_NOTIFICATION_PERMISSION':
      chrome.notifications.getPermissionLevel((level) => {
        console.log('通知权限状态:', level);
        sendResponse({ granted: level === 'granted' });
      });
      return true;
      
    case 'TIMER_COMPLETE':
      showNotification(message.timerType);
      sendResponse({ success: true });
      return true;
  }
});

// 显示通知
function showNotification(timerType) {
  const options = {
    type: 'basic',
    iconUrl: '/icon.png',
    title: '番茄钟提醒',
    message: timerType === 'work' ? '专注时间结束啦！该休息一下了' : '休息结束啦！继续开始新的专注吧',
    requireInteraction: true,
    priority: 2
  };

  try {
    chrome.notifications.create('pomodoroTimer_' + Date.now(), options, (notificationId) => {
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

// 监听通知点击
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('通知被点击:', notificationId);
});

// 监听通知关闭
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log('通知被关闭:', notificationId, byUser ? '被用户关闭' : '自动关闭');
}); 