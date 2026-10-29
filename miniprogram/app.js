const store = require('./utils/store');

// 微信右上角胶囊是原生控件，普通 view 永远压在它下面，也点不到。
// 全站统一用「胶囊底部 + 间距」当作安全头高，抽屉与浮层从这里开始排版。
function safeHeaderTop() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBar = (info && info.statusBarHeight) || 24;
    const bottom = capsule && capsule.bottom > 0 ? capsule.bottom : statusBar + 44;
    // 部分设备/模拟器会把胶囊矩形按物理像素返回，直接加会推出去一大截，这里夹一层上限。
    return Math.round(Math.min(bottom + 8, statusBar + 48));
  } catch (error) {
    return 64;
  }
}

App({
  globalData: {
    openDirectory: null,
    openAI: null,
    studioPhotoId: null,
    safeTop: 64
  },
  onLaunch() {
    this.globalData.safeTop = safeHeaderTop();
    try {
      store.get();
    } catch (error) {
      console.error('本地家庭资料加载失败', error);
    }
  },
  openDirectory() {
    if (this.globalData.openDirectory) this.globalData.openDirectory();
  },
  openAI() {
    if (this.globalData.openAI) this.globalData.openAI();
  }
});
