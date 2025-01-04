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

// 添加计时器状态管理
let timerState = {
  isRunning: false,
  timeLeft: 25 * 60,
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  mode: 'work',
  lastTickTime: null
};

// 使用 chrome.alarms 替代 setInterval
chrome.alarms.create('pomodoroTimer', {
  periodInMinutes: 1/60  // 每秒触发一次
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer' && timerState.isRunning) {
    const now = Date.now();
    if (timerState.lastTickTime) {
      const elapsedSeconds = Math.floor((now - timerState.lastTickTime) / 1000);
      timerState.timeLeft = Math.max(0, timerState.timeLeft - elapsedSeconds);
      
      // 添加错误处理的广播
      try {
        chrome.runtime.sendMessage({
          type: 'TIME_UPDATE',
          timeLeft: timerState.timeLeft
        }).catch(() => {
          // 忽略连接错误
          console.log('No active connections');
        });
      } catch (error) {
        // 忽略连接错误
        console.log('Failed to send message:', error);
      }
      
      if (timerState.timeLeft <= 0) {
        handleTimerComplete();
      }
    }
    timerState.lastTickTime = now;
    saveTimerState();
  }
});

function startTimer() {
  if (timerState.isRunning) return;
  
  timerState.isRunning = true;
  timerState.lastTickTime = Date.now();
  saveTimerState();
}

function stopTimer() {
  if (!timerState.isRunning) return;
  
  timerState.isRunning = false;
  timerState.lastTickTime = null;
  saveTimerState();
}

function handleTimerComplete() {
  stopTimer();
  
  // 显示通知
  showNotification(timerState.mode);
  
  // 切换模式
  timerState.mode = timerState.mode === 'work' ? 'break' : 'work';
  timerState.timeLeft = timerState.mode === 'work' ? timerState.workDuration : timerState.breakDuration;
  
  // 自动开始下一个计时
  startTimer();
}

// 保存计时器状态
function saveTimerState() {
  chrome.storage.local.set({ timerState });
}

// 恢复计时器状态
function restoreTimerState() {
  chrome.storage.local.get('timerState', (data) => {
    if (data.timerState) {
      timerState = data.timerState;
      if (timerState.isRunning) {
        startTimer();
      }
    }
  });
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('后台收到消息:', message);

  if (message.type === 'CHECK_NOTIFICATION_PERMISSION') {
    chrome.notifications.getPermissionLevel((level) => {
      console.log('通知权限状态:', level);
      sendResponse({ granted: level === 'granted' });
    });
    return true;
  }

  if (message.type === 'TIMER_COMPLETE') {
    // 使用随机通知内容
    showNotification(message.timerType || 'work');
    sendResponse({ success: true });
    return true;
  }

  switch (message.type) {
    case 'START_TIMER':
      startTimer();
      sendResponse({ success: true });
      break;
      
    case 'STOP_TIMER':
      stopTimer();
      sendResponse({ success: true });
      break;
      
    case 'GET_TIMER_STATE':
      sendResponse(timerState);
      break;
      
    case 'SET_TIMER':
      timerState.timeLeft = message.time;
      timerState.workDuration = message.time;
      saveTimerState();
      sendResponse({ success: true });
      break;
      
    // ... 其他现有的消息处理 ...
  }
  
  return true;
});

// 监听通知点击
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('通知被点击:', notificationId);
});

// 监听通知关闭
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log('通知被关闭:', notificationId, byUser ? '被用户关闭' : '自动关闭');
});

// 添加图片处理消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message.type);

  if (message.type === 'PROCESS_IMAGE') {
    // 创建一个离屏图片元素来处理图片
    const img = new Image();
    
    img.onload = () => {
      try {
        // 创建 canvas 来处理图片
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置合适的尺寸
        const maxSize = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制并压缩图片
        ctx.drawImage(img, 0, 0, width, height);
        const compressedImage = canvas.toDataURL('image/jpeg', 0.8);
        
        sendResponse({ success: true, imageData: compressedImage });
      } catch (error) {
        console.error('图片处理失败:', error);
        sendResponse({ success: false });
      }
    };
    
    img.onerror = () => {
      console.error('图片加载失败');
      sendResponse({ success: false });
    };
    
    img.src = message.imageData;
    return true; // 保持消息通道打开
  }
  
  // ... 其他消息处理代码 ...
});

// 加载通知消息
async function loadNotificationMessages() {
  try {
    const response = await fetch(chrome.runtime.getURL('notification-messages.md'));
    const text = await response.text();
    
    // 解析所有消息
    const messages = text
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2).trim())
      .filter(line => line.length > 0);
    
    return messages;
  } catch (error) {
    console.error('加载通知消息失败:', error);
    return null;
  }
}

// 随机获取消息
function getRandomMessage(messages) {
  if (!messages || messages.length === 0) return null;
  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
}

// 显示通知
async function showNotification(timerType) {
  try {
    // 加载消息
    const messages = await loadNotificationMessages();
    
    let message;
    if (messages && messages.length > 0) {
      message = getRandomMessage(messages);
    }
    
    // 如果没有找到消息，使用默认消息
    if (!message) {
      message = timerType === 'work' 
        ? '专注时间结束啦！该休息一下了'
        : '休息结束啦！继续开始新的专注吧';
    }

    const options = {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: '好番茄钟喊你别干活了',
      message: message,
      requireInteraction: true,
      priority: 2
    };

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

// 初始化时恢复状态
restoreTimerState(); 