const store = require("../../utils/store");
Component({
  properties: { hideDock: { type: Boolean, value: false } },
  data: {
    expanded: false,
    directory: false,
    burst: false,
    showCaption: false,
    safeTop: 64,
    currentChapter: "home",
    chapters: [
      {
        id: "home",
        title: "手账墙",
        caption: "小日子，慢慢放映。",
        photo: "/assets/photos/together-home.jpg",
      },
      {
        id: "pets",
        title: "兔兔档案",
        caption: "今天也要好好照顾你。",
        photo: "/assets/photos/qiuqiu-close.jpg",
      },
      {
        id: "care",
        title: "照顾日程",
        caption: "家人轮流上场，补给心里有数。",
        photo: "/assets/photos/together-sleep.jpg",
      },
      {
        id: "insights",
        title: "照顾周记",
        caption: "认真做过的小事，装订成册。",
        photo: "/assets/photos/together-home.jpg",
      },
      {
        id: "family",
        title: "家庭成员",
        caption: "故事里的每一个你。",
        photo: "/assets/photos/together-sleep.jpg",
      },
      {
        id: "diary",
        title: "小日子信笺",
        caption: "给心情写一句旁白。",
        photo: "/assets/photos/qiuqiu-home.jpg",
      },
      {
        id: "album",
        title: "回忆相册",
        caption: "把可爱片段摊开。",
        photo: "/assets/photos/doudou-close.jpg",
      },
      {
        id: "studio",
        title: "创意工坊",
        caption: "再加一点小心思。",
        photo: "/assets/photos/qiuqiu-front.jpg",
      },
      {
        id: "video",
        title: "小电影草稿",
        caption: "给生活留一段会动的旁白。",
        photo: "/assets/photos/qiuqiu-home.jpg",
      },
    ],
  },
  lifetimes: {
    attached() {
      this.register();
    },
    detached() {
      clearTimeout(this.holdTimer);
      clearTimeout(this.burstTimer);
      if (getApp().globalData.openDirectory === this.openHandler)
        getApp().globalData.openDirectory = null;
    },
  },
  pageLifetimes: {
    show() {
      this.register();
      this.syncCaption();
      this.syncSafeTop();
    },
  },
  methods: {
    syncSafeTop() {
      try {
        const app = getApp();
        this.setData({
          safeTop: (app && app.globalData && app.globalData.safeTop) || 64,
        });
      } catch (error) {
        this.setData({ safeTop: 64 });
      }
    },
    syncCaption() {
      try {
        const pages = getCurrentPages();
        const route = pages.length ? pages[pages.length - 1].route : "";
        this.setData({
          showCaption: route === "pages/home/index",
          currentChapter: route.split("/")[1] || "home",
        });
      } catch (error) {
        this.setData({ showCaption: false });
      }
    },
    register() {
      this.syncSafeTop();
      this.syncCaption();
      this.openHandler = () =>
        this.setData({ directory: true, expanded: false });
      getApp().globalData.openDirectory = this.openHandler;
    },
    stop() {},
    sheetGrabStart(event) {
      this.grabY =
        event.touches && event.touches[0] && event.touches[0].clientY;
    },
    sheetGrabEnd(event) {
      const y =
        event.changedTouches &&
        event.changedTouches[0] &&
        event.changedTouches[0].clientY;
      if (
        Number.isFinite(this.grabY) &&
        Number.isFinite(y) &&
        y - this.grabY > 90
      )
        this.close();
      this.grabY = null;
    },
    toggle() {
      if (this.held) {
        this.held = false;
        return;
      }
      this.setData({ expanded: !this.data.expanded });
    },
    touchStart() {
      this.held = false;
      this.holdTimer = setTimeout(() => {
        this.held = true;
        this.summon();
      }, 800);
    },
    touchEnd() {
      clearTimeout(this.holdTimer);
    },
    close() {
      this.setData({ expanded: false, directory: false });
    },
    chapter(e) {
      this.close();
      wx.reLaunch({ url: `/pages/${e.currentTarget.dataset.id}/index` });
    },
    async photo() {
      this.close();
      try {
        const added = await store.choosePhotos(9);
        if (added.length === 1)
          wx.navigateTo({ url: `/pages/studio/index?id=${added[0].id}` });
        else if (added.length > 1) wx.reLaunch({ url: "/pages/album/index" });
      } catch (error) {
        store.toast(error.errMsg || "照片未能保存，请检查本机空间");
      }
    },
    video() {
      this.close();
      wx.navigateTo({ url: "/pages/video/index" });
    },
    note() {
      this.close();
      wx.navigateTo({ url: "/pages/diary/index?new=1" });
    },
    summon() {
      this.setData({ expanded: false, burst: true });
      store.toast("豆米和豆糕来贴贴啦 ♡");
      wx.vibrateShort({ type: "light", fail() {} });
      clearTimeout(this.burstTimer);
      this.burstTimer = setTimeout(() => this.setData({ burst: false }), 1800);
    },
  },
});
