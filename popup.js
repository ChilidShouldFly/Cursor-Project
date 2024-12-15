class PomodoroTimer {
  constructor() {
    this.timeLeft = 0;
    this.timerId = null;
    this.isRunning = false;
    this.currentMode = 'work';
    
    // 检查通知权限
    this.checkNotificationPermission();
    
    // DOM 元素
    this.timerDisplay = document.getElementById('timer');
    this.startButton = document.getElementById('startBtn');
    this.stopButton = document.getElementById('stopBtn');
    this.modeToggle = document.getElementById('modeToggle');
    
    // 绑定事件处理器
    this.startButton.addEventListener('click', () => this.startTimer());
    this.stopButton.addEventListener('click', () => this.stopTimer());
    this.modeToggle.addEventListener('click', () => this.toggleMode());
    
    // 初始化
    this.initializeTimer();
    
    // 添加调试按钮
    this.addDebugControls();
  }
  
  async initializeTimer() {
    // 从storage获取默认设置
    const result = await chrome.storage.local.get(['defaultWorkTime', 'defaultBreakTime']);
    this.workDuration = result.defaultWorkTime || 5;
    this.breakDuration = result.defaultBreakTime || 5;
    
    // 设置初始时间
    this.timeLeft = this.workDuration;
    this.updateDisplay();
  }
  
  startTimer() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startButton.disabled = true;
    this.stopButton.disabled = false;
    
    this.timerId = setInterval(() => {
      this.timeLeft--;
      this.updateDisplay();
      
      if (this.timeLeft <= 0) {
        this.handleTimerComplete();
      }
    }, 1000);
  }
  
  stopTimer() {
    if (!this.isRunning) return;
    
    clearInterval(this.timerId);
    this.isRunning = false;
    this.startButton.disabled = false;
    this.stopButton.disabled = true;
  }
  
  toggleMode() {
    this.stopTimer();
    this.currentMode = this.currentMode === 'work' ? 'break' : 'work';
    this.timeLeft = this.currentMode === 'work' 
      ? this.workDuration 
      : this.breakDuration;
    
    // 更新UI
    this.modeToggle.textContent = this.currentMode === 'work' ? '切换到休息' : '切换到工作';
    this.updateDisplay();
  }
  
  handleTimerComplete() {
    this.stopTimer();
    
    console.log('计时结束，准备发送通知');
    // 发送消息给背景脚本
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      timerType: this.currentMode
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送通知消息失败:', chrome.runtime.lastError);
      } else {
        console.log('发送通知消息成功:', response);
      }
    });
    
    // 自动切换模式
    this.toggleMode();
  }
  
  updateDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    this.timerDisplay.textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // 更新标题
    document.title = `${this.timerDisplay.textContent} - 番茄钟`;
  }
  
  // 添加调试控制面板
  addDebugControls() {
    const debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    
    // 添加打开测试页面按钮
    const openTestPageBtn = document.createElement('button');
    openTestPageBtn.textContent = '打开通知测试页面';
    openTestPageBtn.className = 'button debug-button';
    openTestPageBtn.onclick = () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('test-notification.html')
      });
    };
    
    // 添加测试按钮
    const testNotificationBtn = document.createElement('button');
    testNotificationBtn.textContent = '测试通知';
    testNotificationBtn.className = 'button debug-button';
    testNotificationBtn.onclick = () => {
      console.log('测试按钮被点击');
      chrome.runtime.sendMessage({
        type: 'SHOW_NOTIFICATION',
        message: '这是一条测试通知'
      });
    };
    
    // 添加时间设置
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.min = '1';
    timeInput.value = '5';
    timeInput.className = 'debug-input';
    timeInput.onchange = (e) => {
      const newTime = parseInt(e.target.value);
      this.workDuration = newTime;
      this.breakDuration = newTime;
      this.timeLeft = newTime;
      this.updateDisplay();
    };
    
    debugPanel.appendChild(timeInput);
    debugPanel.appendChild(testNotificationBtn);
    debugPanel.appendChild(openTestPageBtn);
    document.querySelector('.container').appendChild(debugPanel);
  }
  
  // 检查通知权限
  async checkNotificationPermission() {
    chrome.runtime.sendMessage({
      type: 'CHECK_NOTIFICATION_PERMISSION'
    }, (response) => {
      if (!response || !response.granted) {
        // 添加权限请求按钮
        const permissionBtn = document.createElement('button');
        permissionBtn.textContent = '请在 Chrome 设置中允许通知';
        permissionBtn.className = 'button';
        permissionBtn.onclick = () => {
          chrome.tabs.create({
            url: 'chrome://settings/content/notifications'
          });
        };
        
        document.querySelector('.controls').insertBefore(
          permissionBtn,
          document.querySelector('.controls').firstChild
        );
      }
    });
  }
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', () => {
  new PomodoroTimer();
}); 