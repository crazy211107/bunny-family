const store = require('../../utils/store');

Page({
  data: {
    members: [], drawerVisible: false, drawerTitle: '', editingId: '', today: '', birthdayCount: 0, formError: '',
    form: { name: '', role: '', birthday: '', avatar: '', relationTo: '', relation: '' },
    relationOptions: [], relationIndex: 0, relationName: '先不关联', avatarBusy: false,
  },

  onLoad() { this.setData({ today: store.date() }); this._avatarToken = 0; this._pendingAvatars = []; },
  onShow() { this.setData({ safeTop: getApp().globalData.safeTop || 64 }); this.refresh(); },
  onUnload() { this.discardPendingAvatars(); this._avatarToken++; },

  refresh() {
    const state = store.get();
    const source = Array.isArray(state.members) ? state.members : [];
    const members = source.map((member, index) => {
      const countdown = store.birthdayCountdown(member.birthday);
      const related = source.find((item) => item.id === member.relationTo);
      return {
        id: member.id, name: member.name || '家人', role: member.role || '这个家的小可爱',
        avatar: member.avatar || '', initial: (member.name || '家').slice(0, 1),
        birthday: member.birthday || '',
        birthdayCaption: countdown === null || !Number.isFinite(countdown) ? '生日还没告诉兔兔' : countdown === 0 ? '今天过生日，生日快乐 ♡' : '距离生日还有 ' + countdown + ' 天',
        birthdayToday: countdown === 0,
        relationCaption: related ? '与 ' + related.name + ' · ' + (member.relation || '还没写关系批注') : (member.relation || ''),
        number: String(index + 1).padStart(2, '0'),
        canUp: index > 0, canDown: index < source.length - 1, color: index % 3,
      };
    });
    this.setData({ members, birthdayCount: source.filter((item) => !!item.birthday).length, today: store.date() });
  },

  mutate(fn, message) {
    try { store.update(fn); this.refresh(); if (message) store.toast(message); return true; }
    catch (error) { const message = error.message || '保存失败，请检查本机存储空间'; if (this.data.drawerVisible) this.setData({ formError: message }); store.toast(message); return false; }
  },

  openEditor(event) {
    const id = event.currentTarget.dataset.id || '';
    const members = store.get().members || [];
    const member = members.find((item) => item.id === id);
    if (id && !member) { store.toast('这位家人的资料暂未找到'); return; }
    this.discardPendingAvatars();
    this._avatarToken++;
    const form = {
      name: member ? member.name || '' : '', role: member ? member.role || '' : '',
      birthday: member ? member.birthday || '' : '', avatar: member ? member.avatar || '' : '',
      relationTo: member ? member.relationTo || '' : '', relation: member ? member.relation || '' : '',
    };
    const relationOptions = [{ id: '', name: '先不关联' }].concat(members.filter((item) => item.id !== id).map((item) => ({ id: item.id, name: item.name || '家人' })));
    let relationIndex = relationOptions.findIndex((item) => item.id === form.relationTo);
    if (relationIndex < 0) { relationIndex = 0; form.relationTo = ''; }
    this.setData({ drawerVisible: true, drawerTitle: member ? '续写这位家人的故事' : '请一位家人入镜', formError: '', editingId: id, form, relationOptions, relationIndex, relationName: relationOptions[relationIndex].name, avatarBusy: false });
  },

  formInput(event) {
    const field = event.currentTarget.dataset.field;
    if (['name', 'role', 'relation'].indexOf(field) < 0) return;
    const patch = { formError: '' }; patch['form.' + field] = event.detail.value; this.setData(patch);
  },
  birthdayChange(event) { this.setData({ 'form.birthday': event.detail.value }); },
  clearBirthday() { this.setData({ 'form.birthday': '' }); },
  relationChange(event) {
    const index = Number(event.detail.value);
    const relation = this.data.relationOptions[index];
    if (!relation) return;
    this.setData({ relationIndex: index, relationName: relation.name, 'form.relationTo': relation.id });
  },

  chooseAvatar() {
    if (this.data.avatarBusy) return;
    const token = ++this._avatarToken;
    this.setData({ avatarBusy: true });
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) { this.finishAvatar(token); store.toast('没有读到这张照片，请再试一次'); return; }
        if (token !== this._avatarToken || !this.data.drawerVisible) return;
        wx.saveFile({
          tempFilePath: file.tempFilePath,
          success: (saved) => {
            if (token !== this._avatarToken || !this.data.drawerVisible) {
              this.removeSavedAvatar(saved.savedFilePath); return;
            }
            this._pendingAvatars.push(saved.savedFilePath);
            this.setData({ 'form.avatar': saved.savedFilePath, avatarBusy: false });
            store.toast('头像准备好啦，记得保存这位家人');
          },
          fail: () => { if (token === this._avatarToken) { this.finishAvatar(token); store.toast('头像保存失败，请检查本机空间'); } },
        });
      },
      fail: (error) => {
        if (token !== this._avatarToken) return;
        this.finishAvatar(token);
        if (!error || String(error.errMsg || '').indexOf('cancel') < 0) store.toast('暂时无法选择头像，请检查相册权限');
      },
    });
  },

  finishAvatar(token) { if (token === this._avatarToken) this.setData({ avatarBusy: false }); },
  removeSavedAvatar(filePath) {
    if (!filePath) return;
    wx.removeSavedFile({ filePath, fail() {} });
  },
  discardPendingAvatars(keep) {
    (this._pendingAvatars || []).forEach((filePath) => { if (filePath !== keep) this.removeSavedAvatar(filePath); });
    this._pendingAvatars = [];
  },
  clearAvatar() { this.setData({ 'form.avatar': '' }); },

  saveMember() {
    if (this.data.avatarBusy) { store.toast('头像还在准备中，请稍等'); return; }
    const form = this.data.form;
    const id = this.data.editingId || store.uid();
    if (!form.name.trim()) { this.formFeedback('给这位家人写一个名字吧'); return; }
    if (form.birthday && form.birthday > store.date()) { this.formFeedback('生日不能晚于今天'); return; }
    const details = { id, name: form.name.trim(), role: form.role.trim(), birthday: form.birthday || '', avatar: form.avatar || '', relationTo: form.relationTo || '', relation: form.relation.trim() };
    const editing = !!this.data.editingId;
    const saved = this.mutate((draft) => {
      draft.members = draft.members || [];
      if (details.relationTo && !draft.members.some((item) => item.id === details.relationTo && item.id !== id)) details.relationTo = '';
      const index = draft.members.findIndex((item) => item.id === id);
      if (editing && index < 0) throw new Error('这位家人的资料已被移除');
      if (index >= 0) draft.members[index] = Object.assign({}, draft.members[index], details);
      else draft.members.push(details);
    }, editing ? '家人的故事更新啦 ♡' : '欢迎来到我们的小窝 ♡');
    if (saved) {
      this.discardPendingAvatars(details.avatar);
      this._avatarToken++;
      this.setData({ drawerVisible: false, avatarBusy: false });
    }
  },

  moveMember(event) {
    const id = event.currentTarget.dataset.id;
    const delta = Number(event.currentTarget.dataset.delta);
    if (delta !== -1 && delta !== 1) return;
    this.mutate((draft) => {
      const members = draft.members || [];
      const index = members.findIndex((item) => item.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= members.length) return;
      const other = members[target]; members[target] = members[index]; members[index] = other;
    }, '出场顺序排好啦');
  },

  deleteMember(event) {
    const id = event.currentTarget.dataset.id;
    const member = (store.get().members || []).find((item) => item.id === id);
    if (!member) return;
    wx.showModal({
      title: '收起这位家人的资料？', content: '将删除“' + member.name + '”的成员资料，以及其他成员指向这位家人的关系批注。', confirmText: '删除资料', confirmColor: '#9b6d85',
      success: (result) => {
        if (!result.confirm) return;
        this.mutate((draft) => {
          draft.members = (draft.members || []).filter((item) => item.id !== id).map((item) => item.relationTo === id ? Object.assign({}, item, { relationTo: '', relation: '' }) : item);
        }, '这位家人的资料已收起');
      },
    });
  },

  closeDrawer() {
    this._avatarToken++;
    this.discardPendingAvatars();
    this.setData({ drawerVisible: false, avatarBusy: false, formError: '' });
  },
  formFeedback(message) { this.setData({ formError: message }); store.toast(message); },
  stopTap() {},
});
