class PomodoroTimer {
  constructor() {
    // 默认时间设置（25分钟）
    this.DEFAULT_WORK_TIME = 25 * 60;  // 25分钟
    this.DEFAULT_BREAK_TIME = 5 * 60;  // 5分钟
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
    this.bgColorInput = document.getElementById('bgColor');
    this.bgColor2Input = document.getElementById('bgColor2');
    this.gradientTypeSelect = document.getElementById('gradientType');
    this.bgImageSelect = document.getElementById('bgImage');
    
    // 绑定事件处理器
    this.startButton.addEventListener('click', () => this.startTimer());
    this.stopButton.addEventListener('click', () => this.stopTimer());
    this.modeToggle.addEventListener('click', () => this.toggleMode());
    this.bgColorInput.addEventListener('change', () => this.updateBackground());
    this.bgColor2Input.addEventListener('change', () => this.updateBackground());
    this.gradientTypeSelect.addEventListener('change', () => this.updateBackground());
    this.bgImageSelect.addEventListener('change', () => this.updateBackground());
    
    // 初始化
    this.initializeTimer();
    this.loadBackgroundSettings();
    
    // 添加调试按钮
    this.addDebugControls();
  }
  
  async initializeTimer() {
    // 从storage获取默认设置
    const result = await chrome.storage.local.get(['defaultWorkTime', 'defaultBreakTime']);
    this.workDuration = this.DEFAULT_WORK_TIME;
    this.breakDuration = this.DEFAULT_BREAK_TIME;
    
    // 设置初始时间
    this.timeLeft = this.workDuration;
    this.updateDisplay();
  }
  
  // 加载背景设置
  async loadBackgroundSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'backgroundColor',
        'backgroundColor2',
        'gradientType',
        'backgroundImage'
      ]);
      
      if (settings.backgroundColor) {
        this.bgColorInput.value = settings.backgroundColor;
      }
      if (settings.backgroundColor2) {
        this.bgColor2Input.value = settings.backgroundColor2;
      }
      if (settings.gradientType) {
        this.gradientTypeSelect.value = settings.gradientType;
      }
      if (settings.backgroundImage) {
        this.bgImageSelect.value = settings.backgroundImage;
      }
      
      this.updateBackground();
    } catch (error) {
      console.error('加载背景设置失败:', error);
    }
  }
  
  // 更新背景
  updateBackground() {
    try {
      const color1 = this.bgColorInput.value;
      const color2 = this.bgColor2Input.value;
      const gradientType = this.gradientTypeSelect.value;
      const selectedImage = this.bgImageSelect.value;
      
      let background = '';
      if (selectedImage) {
        const imageUrl = chrome.runtime.getURL(`images/${selectedImage}`);
        background = `url('${imageUrl}')`;
        document.body.style.backgroundSize = 'cover';
      } else {
        let gradient;
        if (gradientType === 'linear') {
          gradient = `linear-gradient(45deg, ${color1}, ${color2})`;
        } else {
          gradient = `radial-gradient(circle, ${color1}, ${color2})`;
        }
        background = gradient;
      }
      
      document.body.style.background = background;
      
      // 保存设置
      chrome.storage.local.set({
        backgroundColor: color1,
        backgroundColor2: color2,
        gradientType: gradientType,
        backgroundImage: selectedImage
      });
    } catch (error) {
      console.error('更新背景失败:', error);
    }
  }
  
  startTimer() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startButton.disabled = true;
    this.stopButton.disabled = false;
    
    this.timerId = setInterval(() => {
      this.timeLeft--;
      this.updateDisplay();
      
      console.log('当前剩余时间:', this.timeLeft);
      
      if (this.timeLeft <= 0) {
        console.log('时间到，即将调用 handleTimerComplete');
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
      message: this.currentMode === 'work' 
        ? '专注时间结束啦！该休息一下了' 
        : '休息结束啦！继续开始新的专注吧'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('通知发送失败:', chrome.runtime.lastError);
      } else {
        console.log('通知发送成功');
      }
    });
    
    // 自动切换模式并重置为默认时间
    this.toggleMode();
    this.timeLeft = this.currentMode === 'work' ? this.DEFAULT_WORK_TIME : this.DEFAULT_BREAK_TIME;
    this.updateDisplay();
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
    timeInput.value = Math.floor(this.DEFAULT_WORK_TIME / 60);
    timeInput.className = 'debug-input';
    timeInput.onchange = (e) => {
      const newTime = parseInt(e.target.value) * 60; // 转换为秒
      this.workDuration = newTime;
      this.breakDuration = Math.floor(newTime / 5); // 休息时间设为工作时间的1/5
      if (!this.isRunning) {
        this.timeLeft = this.currentMode === 'work' ? this.workDuration : this.breakDuration;
        this.updateDisplay();
      }
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