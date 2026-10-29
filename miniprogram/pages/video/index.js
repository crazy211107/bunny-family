const store = require('../../utils/store');
const FILTERS = [
  { name: '奶油', css: 'brightness(1.08) contrast(.94) saturate(.85)', note: '软软的奶油日光' },
  { name: '薄荷', css: 'hue-rotate(15deg) saturate(.8)', note: '清清凉凉的小午后' },
  { name: '樱花', css: 'sepia(.12) saturate(1.15)', note: '给回忆一点粉色心情' },
  { name: '复古', css: 'sepia(.5) contrast(.95)', note: '像翻开旧日的小电影' }
];
Page({
  data: {
    src: '', currentId: '', title: '兔兔的可爱片段', caption: '', filter: '奶油',
    previewFilter: FILTERS[0].css, filterNote: FILTERS[0].note, filters: [],
    drafts: [], busy: false, choosing: false, error: '', durationText: '',
    videoReady: false
  },
  onLoad(options) { this._openId = options && options.id; },
  onShow() {
    this.reload();
    if (this._openId) { const id = this._openId; this._openId = ''; this.openDraft({ currentTarget: { dataset: { id } } }); }
    this.refreshFilters();
  },
  error(error) { store.toast(error && (error.message || error.errMsg) || '这段回忆暂时没有收好，请再试一次'); },
  reload() {
    try {
      const state = store.get();
      this._drafts = Array.isArray(state.videos) ? state.videos : [];
      this.setData({ drafts: this._drafts.map(draft => ({ id: draft.id, title: draft.title, date: draft.date, filter: draft.filter || '奶油' })) });
    } catch (error) { this.error(error); }
  },
  refreshFilters() {
    const chosen = FILTERS.find(filter => filter.name === this.data.filter) || FILTERS[0];
    this.setData({
      filter: chosen.name, previewFilter: chosen.css, filterNote: chosen.note,
      filters: FILTERS.map(filter => ({ name: filter.name, note: filter.note, selected: filter.name === chosen.name }))
    });
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value, error: '' }); },
  selectFilter(event) { this.setData({ filter: event.currentTarget.dataset.name }); this.refreshFilters(); },
  choose() {
    if (this.data.choosing || this.data.busy) return;
    this.setData({ choosing: true, error: '' });
    wx.chooseMedia({
      count: 1, mediaType: ['video'], sourceType: ['album', 'camera'], maxDuration: 60,
      success: result => {
        const file = result.tempFiles && result.tempFiles[0], duration = Number(file && file.duration);
        if (!file || !file.tempFilePath || !Number.isFinite(duration) || duration < 0 || duration > 60) {
          this.setData({ error: '请选择 60 秒以内的视频片段。' }); store.toast('请选择 60 秒以内的可爱片段'); return;
        }
        if (file.size > 100 * 1024 * 1024) { this.setData({ error: '视频请小于 100MB，换一段短一点的回忆吧。' }); return; }
        this._pendingPath = file.tempFilePath;
        this.setData({
          src: file.tempFilePath, currentId: '', videoReady: true,
          durationText: Math.max(1, Math.round(duration)) + ' 秒', error: ''
        });
      },
      fail: error => {
        if (String(error.errMsg || '').indexOf('cancel') < 0) {
          this.setData({ error: '这段视频暂时没有带进来，请重新选择。' }); this.error(error);
        }
      },
      complete: () => this.setData({ choosing: false })
    });
  },
  newDraft() {
    if (this.data.busy || this.data.choosing) return;
    if (this.data.src) {
      wx.showModal({
        title: '开启另一段小电影？', content: '当前未保存的改动会被收起，请先确认已经保存。',
        confirmText: '开启新草稿', cancelText: '继续编辑',
        success: result => { if (result.confirm) this.resetDraft(); }
      });
    } else this.resetDraft();
  },
  resetDraft() {
    this._pendingPath = '';
    this.setData({ src: '', currentId: '', title: '兔兔的可爱片段', caption: '', filter: '奶油', error: '', durationText: '', videoReady: false });
    this.refreshFilters();
  },
  videoError() { this.setData({ videoReady: false, error: '这段视频暂时无法播放，请换一个兼容的视频文件。' }); },
  videoLoaded(event) {
    const duration = Number(event.detail.duration);
    if (Number.isFinite(duration) && duration > 60) {
      this.setData({ videoReady: false, error: '这段视频超过 60 秒，请换一段更短的片段。' });
      return;
    }
    this.setData({ videoReady: true, durationText: Number.isFinite(duration) ? Math.max(1, Math.round(duration)) + ' 秒' : '' });
  },
  async save() {
    if (this.data.busy || this.data.choosing) return;
    if (!this.data.src || !this.data.videoReady) { this.setData({ error: '先选择一段可以播放的视频，再收好草稿。' }); store.toast('先带进一段可以播放的视频吧'); return; }
    if (!this.data.title.trim()) { this.setData({ error: '还差一个片名，写下名字就能保存了。' }); store.toast('给这段回忆起个片名吧'); return; }
    this.setData({ busy: true, error: '' });
    try {
      let src = this.data.src;
      if (this._pendingPath) {
        src = await store.saveFile(this._pendingPath);
        // Keep the durable path when metadata storage fails, so a retry can succeed.
        this._pendingPath = '';
        this.setData({ src });
      }
      const entry = {
        id: this.data.currentId || store.uid(), src, title: this.data.title.trim(),
        caption: this.data.caption.trim(), filter: this.data.filter, date: store.date()
      };
      store.update(state => {
        if (!Array.isArray(state.videos)) state.videos = [];
        state.videos = [entry].concat(state.videos.filter(draft => draft.id !== entry.id));
      });
      this.setData({ currentId: entry.id, title: entry.title, caption: entry.caption });
      this.reload();
      store.toast('视频草稿已经留在本机啦 ♡');
    } catch (error) {
      this.setData({ error: '草稿暂时未能保存，当前编辑已保留，请检查本机空间后重试。' }); this.error(error);
    } finally { this.setData({ busy: false }); }
  },
  openDraft(event) {
    if (this.data.busy || this.data.choosing) return;
    const id = event.currentTarget.dataset.id, draft = (this._drafts || []).find(item => item.id === id);
    if (!draft || !draft.src) { store.toast('这份草稿暂时找不到了'); return; }
    const open = () => {
      this._pendingPath = '';
      this.setData({ currentId: draft.id, src: draft.src, title: draft.title || '', caption: draft.caption || '', filter: draft.filter || '奶油', error: '', durationText: '', videoReady: true });
      this.refreshFilters();
    };
    if (this.data.src && this.data.currentId !== draft.id) {
      wx.showModal({ title: '翻开这份草稿？', content: '当前未保存的改动会被收起，请先确认已经保存。', confirmText: '翻开草稿', cancelText: '继续编辑', success: result => { if (result.confirm) open(); } });
    } else open();
  }
});

