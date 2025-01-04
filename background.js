// 当后台脚本加载时在控制台打印提示信息
console.log('后台脚本已加载');

// 监听扩展安装事件，当扩展第一次安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  
  // 设置默认的工作和休息时间（单位：分钟）
  chrome.storage.local.set({
    defaultWorkTime: 5,
    defaultBreakTime: 5
  });
});

// 定义计时器的状态对象，用于管理所有计时相关的数据
let timerState = {
  isRunning: false,          // 计时器是否正在运行
  timeLeft: 25 * 60,         // 剩余时间（单位：秒）
  workDuration: 25 * 60,     // 工作时长（单位：秒）
  breakDuration: 5 * 60,     // 休息时长（单位：秒）
  mode: 'work',              // 当前模式：'work'(工作) 或 'break'(休息)
  lastTickTime: null         // 上次更新时间的时间戳
};

// 创建一个每秒触发一次的定时器，用于更新倒计时
chrome.alarms.create('pomodoroTimer', {
  periodInMinutes: 1/60  // 每分钟的 1/60，即每秒触发一次
});

// 监听定时器触发事件
chrome.alarms.onAlarm.addListener((alarm) => {
  // 只处理我们的番茄钟定时器，并且要求计时器正在运行
  if (alarm.name === 'pomodoroTimer' && timerState.isRunning) {
    const now = Date.now();  // 获取当前时间戳
    if (timerState.lastTickTime) {
      // 计算从上次更新到现在经过的秒数
      const elapsedSeconds = Math.floor((now - timerState.lastTickTime) / 1000);
      // 更新剩余时间，确保不会小于0
      timerState.timeLeft = Math.max(0, timerState.timeLeft - elapsedSeconds);
      
      // 尝试向前台发送时间更新消息
      try {
        chrome.runtime.sendMessage({
          type: 'TIME_UPDATE',
          timeLeft: timerState.timeLeft
        }).catch(() => {
          // 如果没有活动的连接，忽略错误
          console.log('No active connections');
        });
      } catch (error) {
        // 如果发送消息失败，忽略错误
        console.log('Failed to send message:', error);
      }
      
      // 如果时间到了，处理计时完成事件
      if (timerState.timeLeft <= 0) {
        handleTimerComplete();
      }
    }
    // 更新最后一次计时的时间戳
    timerState.lastTickTime = now;
    // 保存当前状态
    saveTimerState();
  }
});

// 启动计时器的函数
function startTimer() {
  // 如果已经在运行，直接返回
  if (timerState.isRunning) return;
  
  // 设置运行状态和开始时间
  timerState.isRunning = true;
  timerState.lastTickTime = Date.now();
  // 保存状态
  saveTimerState();
}

// 停止计时器的函数
function stopTimer(reset = false) {
  // 如果没有在运行，直接返回
  if (!timerState.isRunning) return;
  
  // 重置运行状态和时间戳
  timerState.isRunning = false;
  timerState.lastTickTime = null;

  if (reset) {
    // 重置为初始时间
    timerState.timeLeft = timerState.workDuration;
  }
  
  // 保存状态
  saveTimerState();
  
  // 不需要发送消息，由前台处理显示更新
  return true;
}

// 处理计时完成的函数
function handleTimerComplete() {
  // 先停止当前计时
  stopTimer();
  
  // 显示通知提醒用户
  showNotification(timerState.mode);
  
  // 重置为初始状态
  timerState.mode = 'work';
  timerState.timeLeft = timerState.workDuration;
  timerState.isRunning = false;  // 确保停止计时
  timerState.lastTickTime = null;  // 重置时间戳
  
  // 更新显示
  chrome.runtime.sendMessage({
    type: 'TIME_UPDATE',
    timeLeft: timerState.timeLeft,
    isRunning: false  // 通知前台更新按钮状态
  });
  
  // 保存状态
  saveTimerState();
}

// 保存计时器状态到 Chrome 存储
function saveTimerState() {
  chrome.storage.local.set({ timerState });
}

// 从 Chrome 存储恢复计时器状态
function restoreTimerState() {
  chrome.storage.local.get('timerState', (data) => {
    if (data.timerState) {
      // 恢复保存的状态
      timerState = data.timerState;
      // 如果之前是运行状态，继续运行
      if (timerState.isRunning) {
        startTimer();
      }
    }
  });
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('后台收到消息:', message);

  // 处理检查通知权限的请求
  if (message.type === 'CHECK_NOTIFICATION_PERMISSION') {
    chrome.notifications.getPermissionLevel((level) => {
      console.log('通知权限状态:', level);
      sendResponse({ granted: level === 'granted' });
    });
    return true;
  }

  // 处理计时完成的消息
  if (message.type === 'TIMER_COMPLETE') {
    showNotification(message.timerType || 'work');
    sendResponse({ success: true });
    return true;
  }

  // 处理其他类型的消息
  switch (message.type) {
    case 'START_TIMER':
      startTimer();
      sendResponse({ success: true });
      break;
      
    case 'STOP_TIMER':
      stopTimer(message.reset);  // 传入重置标志
      sendResponse({ success: true });
      break;
      
    case 'GET_TIMER_STATE':
      sendResponse(timerState);
      break;
      
    case 'SET_TIMER':
      timerState.timeLeft = message.time;
      if (message.updateWorkDuration) {
        timerState.workDuration = message.time;  // 同时更新工作时长
      }
      saveTimerState();
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

// 监听通知被点击的事件
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('通知被点击:', notificationId);
});

// 监听通知被关闭的事件
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

// 显示系统通知的函数
async function showNotification(timerType) {
  try {
    // 尝试加载自定义通知消息
    const messages = await loadNotificationMessages();
    
    let message;
    if (messages && messages.length > 0) {
      message = getRandomMessage(messages);
    }
    
    // 如果没有找到自定义消息，使用默认消息
    if (!message) {
      message = timerType === 'work' 
        ? '专注时间结束啦！该休息一下了'
        : '休息结束啦！继续开始新的专注吧';
    }

    // 配置通知选项
    const options = {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: '好番茄钟喊你别干活了',
      message: message,
      requireInteraction: true,  // 通知不会自动消失
      priority: 2               // 高优先级
    };

    // 创建系统通知
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

// 初始化：恢复之前保存的状态
restoreTimerState(); 