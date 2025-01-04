class PomodoroTimer {
  constructor() {
    // 默认时间设置（25分钟）
    this.DEFAULT_TIME = 25 * 60;  // 25分钟
    this.timeLeft = 0;
    this.timerId = null;
    this.isRunning = false;
    
    // DOM 元素
    this.timerDisplay = document.getElementById('timer');
    this.toggleBtn = document.getElementById('toggleBtn');
    this.bgImageSelect = document.getElementById('bgImage');
    
    // 绑定事件处理器
    this.toggleBtn.addEventListener('click', () => this.toggleTimer());
    this.bgImageSelect.addEventListener('change', () => this.updateBackground());
    
    // 初始化
    this.initializeTimer();
    this.loadBackgroundImages();
    this.loadBackgroundSettings();
    
    // 添加调试按钮
    this.addDebugControls();
    
    // 调试面板切换
    this.debugPanel = document.getElementById('debugPanel');
    this.toggleDebugBtn = document.getElementById('toggleDebugBtn');
    this.toggleDebugBtn.addEventListener('click', () => this.toggleDebugPanel());
  }
  
  async initializeTimer() {
    this.workDuration = this.DEFAULT_TIME;
    this.timeLeft = this.workDuration;
    this.updateDisplay();
  }
  
  // 加载背景设置
  async loadBackgroundSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'backgroundImage',
        'debugPanelCollapsed'
      ]);
      
      if (settings.backgroundImage) {
        this.bgImageSelect.value = settings.backgroundImage;
      }
      
      // 恢复调试面板状态
      if (settings.debugPanelCollapsed) {
        this.debugPanel.classList.add('collapsed');
      }
      
      this.updateBackground();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }
  
  // 更新背景
  updateBackground() {
    try {
      const selectedImage = this.bgImageSelect.value;
      
      console.log('选中的背景图片:', selectedImage);
      
      if (!selectedImage) {
        this.setGradientBackground();
        return;
      }
      
      // 使用完整的扩展 URL
      const imageUrl = chrome.runtime.getURL(`images/${selectedImage}`);
      console.log('Loading image:', imageUrl);
      
      // 先创建一个 Image 对象来验证图片是否可以加载
      const img = new Image();
      
      // 设置跨域属性
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        document.body.style.backgroundImage = `url('${imageUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        // 分析背景图片颜色并调整文字颜色
        this.adjustTimerColor(img);
      };
      
      img.onerror = (error) => {
        console.error('背景图片加载失败:', selectedImage);
        this.setGradientBackground();
      };
      
      img.src = imageUrl;
      
      // 保存设置
      chrome.storage.local.set({
        backgroundImage: selectedImage
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存背景设置失败:', chrome.runtime.lastError);
        }
      });
    } catch (error) {
      console.error('更新背景失败:', error);
      this.setGradientBackground();
    }
  }
  
  // 分析图片颜色并调整文字颜色
  adjustTimerColor(img) {
    try {
      // 创建 canvas 来分析图片
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 设置 canvas 大小
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 绘制图片
      ctx.drawImage(img, 0, 0);
      
      // 获取中心区域的像素数据
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const radius = 50; // 分析区域半径
      
      const imageData = ctx.getImageData(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
      ).data;
      
      // 计算平均颜色
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
      }
      
      const pixelCount = imageData.length / 4;
      r = Math.floor(r / pixelCount);
      g = Math.floor(g / pixelCount);
      b = Math.floor(b / pixelCount);
      
      // 计算亮度
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      // 获取切换按钮图标
      const toggleIcon = document.querySelector('.toggle-debug-btn .toggle-icon');
      
      // 根据亮度选择文字和图标颜色
      if (brightness > 128) {
        // 深色背景上使用深色文字
        this.timerDisplay.style.color = '#2d3436';  // 深色文字
        this.timerDisplay.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        // 调试面板文字颜色
        const debugLabels = document.querySelectorAll('.time-setting label');
        debugLabels.forEach(label => {
          label.style.color = '#2d3436';
        });
        if (toggleIcon) {
          toggleIcon.style.borderTopColor = 'rgba(0, 0, 0, 0.8)';
          toggleIcon.style.borderRightColor = 'rgba(0, 0, 0, 0.8)';
        }
      } else {
        // 浅色背景上使用白色文字
        this.timerDisplay.style.color = '#ffffff';  // 白色文字
        this.timerDisplay.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        // 调试面板文字颜色
        const debugLabels = document.querySelectorAll('.time-setting label');
        debugLabels.forEach(label => {
          label.style.color = '#ffffff';
        });
        if (toggleIcon) {
          toggleIcon.style.borderTopColor = 'rgba(255, 255, 255, 0.8)';
          toggleIcon.style.borderRightColor = 'rgba(255, 255, 255, 0.8)';
        }
      }
    } catch (error) {
      console.error('调整文字颜色失败:', error);
      // 使用默认颜色
      this.timerDisplay.style.color = '#2d3436';
      // 调试面板使用默认颜色
      const debugLabels = document.querySelectorAll('.time-setting label');
      debugLabels.forEach(label => {
        label.style.color = '#2d3436';
      });
      const toggleIcon = document.querySelector('.toggle-debug-btn .toggle-icon');
      if (toggleIcon) {
        toggleIcon.style.borderTopColor = 'rgba(255, 255, 255, 0.8)';
        toggleIcon.style.borderRightColor = 'rgba(255, 255, 255, 0.8)';
      }
    }
  }
  
  toggleTimer() {
    if (this.isRunning) {
      this.stopTimer();
      // 恢复到当前模式的初始时间
      this.timeLeft = this.workDuration;
      this.updateDisplay();
    } else {
      this.startTimer();
    }
  }
  
  startTimer() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.toggleBtn.textContent = '结束';
    this.toggleBtn.classList.replace('primary', 'danger');
    
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
    this.toggleBtn.textContent = '开始';
    this.toggleBtn.classList.replace('danger', 'primary');
  }
  
  handleTimerComplete() {
    this.stopTimer();
    
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      message: '专注时间结束啦！'
    });
    
    // 重置为初始时间
    this.timeLeft = this.workDuration;
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
    // 获取调试面板元素
    const timeInput = document.getElementById('timeInput');
    const testNotificationBtn = document.getElementById('testNotificationBtn');
    const notificationSettingsBtn = document.getElementById('notificationSettingsBtn');

    // 绑定时间输入事件
    timeInput.onchange = (e) => {
      const newTime = parseInt(e.target.value) * 60; // 转换为秒
      this.workDuration = newTime;
      if (!this.isRunning) {
        this.timeLeft = this.workDuration;
        this.updateDisplay();
      }
    };

    // 绑定测试通知按钮事件
    testNotificationBtn.onclick = () => {
      // 随机测试工作或休息知
      const testType = Math.random() > 0.5 ? 'work' : 'break';
      console.log('发送测试通知:', testType);
      chrome.runtime.sendMessage({
        type: 'TIMER_COMPLETE',
        timerType: testType
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('测试通知发送失败:', chrome.runtime.lastError);
        } else {
          console.log('测试通知发送成功:', response);
        }
      });
    };

    // 绑定通知设置按钮事件
    notificationSettingsBtn.onclick = () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('test-notification.html')
      });
    };
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
  
  // 获取 images 目录下的图片文件
  async getImageFiles() {
    try {
      // 直接检查可能的图片文件
      const extensions = ['.jpg', '.jpeg', '.png', '.gif'];
      const maxImages = 100; // 最大检查数量
      
      const imageFiles = [];
      
      // 遍历可能的图片文件
      for (let i = 1; i <= maxImages; i++) {
        for (const ext of extensions) {
          const fileName = `好东西${i}${ext}`;
          try {
            const imageUrl = chrome.runtime.getURL(`images/${fileName}`);
            const response = await fetch(imageUrl, { method: 'HEAD' });
            if (response.ok) {
              imageFiles.push(fileName);
            }
          } catch (error) {
            // 忽略不存在的文件错误
            continue;
          }
        }
      }
      
      console.log('找到的图片文件:', imageFiles);
      
      // 按文件名排序
      imageFiles.sort((a, b) => {
        // 从文件名中提取数字
        const numA = parseInt(a.match(/好东西(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/好东西(\d+)/)?.[1] || '0');
        if (numA !== numB) return numA - numB;
        // 如果数字相同或没有数字，按字母顺序排序
        return a.localeCompare(b);
      });
      
      return imageFiles;
    } catch (error) {
      console.error('获取图片文件列表失败:', error);
      return [];
    }
  }
  
  // 加载背景图片列表
  async loadBackgroundImages() {
    try {
      // 获取扩展根目录的 URL
      const extensionUrl = chrome.runtime.getURL('images/');
      console.log('扩展目录:', extensionUrl);

      // 尝试加载 images 目录下的图片
      const imageFiles = await this.getImageFiles();
      console.log('找到的图片文件:', imageFiles);

      if (imageFiles.length > 0) {
        // 获取当前选中的值
        const currentValue = this.bgImageSelect.value;
        
        // 显示选择器
        this.bgImageSelect.style.display = 'block';
        
        // 更新选项列表，只示图片选项
        this.bgImageSelect.innerHTML = imageFiles.map(fileName => 
          `<option value="${fileName}">${fileName}</option>`
        ).join('');
        
        // 如果有之前选中的值且仍然存在，则保持选中
        if (currentValue && imageFiles.includes(currentValue)) {
          this.bgImageSelect.value = currentValue;
        } else {
          // 否则选择第一张片
          this.bgImageSelect.value = imageFiles[0];
        }
        
        // 设置背景
        this.updateBackground();
      } else {
        // 如果没有图片，隐藏选择器并设置渐变背景
        this.bgImageSelect.style.display = 'none';
        this.setGradientBackground();
      }
    } catch (error) {
      console.error('加载背景图片列表失败:', error);
      // 出错时设置渐变背景
      this.bgImageSelect.style.display = 'none';
      this.setGradientBackground();
    }
  }
  
  // 添加新方法
  toggleDebugPanel() {
    this.debugPanel.classList.toggle('collapsed');
    // 保存状态到 storage
    chrome.storage.local.set({
      debugPanelCollapsed: this.debugPanel.classList.contains('collapsed')
    });
  }
  
  // 设置渐变背景
  setGradientBackground() {
    // 使用高级灰渐变背景
    document.body.style.backgroundImage = 'linear-gradient(45deg, #E0E0E0, #F5F5F5)';
    document.body.style.backgroundColor = '#E0E0E0';
    // 重置文字颜色
    this.timerDisplay.style.color = '#333333';
    // 调试面板文字颜色
    const debugLabels = document.querySelectorAll('.time-setting label');
    debugLabels.forEach(label => {
      label.style.color = '#333333';
    });
    // 重置图标颜色
    const toggleIcon = document.querySelector('.toggle-debug-btn .toggle-icon');
    if (toggleIcon) {
      toggleIcon.style.borderTopColor = 'rgba(0, 0, 0, 0.8)';
      toggleIcon.style.borderRightColor = 'rgba(0, 0, 0, 0.8)';
    }
  }
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', () => {
  new PomodoroTimer();
}); 