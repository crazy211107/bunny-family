Component({
  data: { top: 64, showBack: false },
  lifetimes: {
    attached() {
      try {
        const info = wx.getWindowInfo
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
        const capsule = wx.getMenuButtonBoundingClientRect();
        const statusBar = info.statusBarHeight || 24;
        const base =
          capsule && capsule.bottom > 0 ? capsule.bottom : statusBar + 44;
        this.setData({ top: Math.round(Math.min(base + 6, statusBar + 46)) });
        this.setData({ showBack: getCurrentPages().length > 1 });
      } catch (error) {
        this.setData({ top: 64 });
      }
    },
  },
  methods: {
    back() {
      wx.navigateBack({
        delta: 1,
        fail() {
          wx.reLaunch({ url: "/pages/home/index" });
        },
      });
    },
    home() {
      wx.reLaunch({ url: "/pages/home/index" });
    },
    directory() {
      getApp().openDirectory();
    },
  },
});
