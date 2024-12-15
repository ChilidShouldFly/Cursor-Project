function updateStatus(message) {
  document.getElementById('status').innerHTML += message + '<br>';
}

function requestPermission() {
  chrome.tabs.create({
    url: 'chrome://settings/content/notifications'
  });
}

function testNotification() {
  chrome.runtime.sendMessage({
    type: 'SHOW_NOTIFICATION',
    message: '这是一条测试通知'
  }, (response) => {
    if (chrome.runtime.lastError) {
      updateStatus('❌ 通知发送失败: ' + chrome.runtime.lastError.message);
    } else {
      updateStatus('✅ 通知发送成功');
    }
  });
}

// 绑定事件监听
document.getElementById('requestPermissionBtn').addEventListener('click', requestPermission);
document.getElementById('testNotificationBtn').addEventListener('click', testNotification);

// 初始状态检查
chrome.runtime.sendMessage({
  type: 'CHECK_NOTIFICATION_PERMISSION'
}, (response) => {
  if (response && response.granted) {
    updateStatus('✅ 已获得通知权限');
  } else {
    updateStatus('❌ 未获得通知权限，请点击"打开通知设置"按钮进行设置');
  }
}); 