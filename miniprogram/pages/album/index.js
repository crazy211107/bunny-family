const store = require("../../utils/store");
const list = (value) => (Array.isArray(value) ? value : []);
const petIdsFor = (photo, pets) =>
  Array.isArray(photo.petIds)
    ? photo.petIds
    : pets
        .filter((pet) => photo.tag === pet.name || photo.tag === "一起")
        .map((pet) => pet.id);
Page({
  data: {
    today: "",
    query: "",
    filter: "all",
    filters: [],
    recycle: false,
    sortIndex: 0,
    sortOptions: ["日期 · 从新到旧", "日期 · 从旧到新", "按照片标题"],
    photos: [],
    groups: [],
    activeCount: 0,
    trashCount: 0,
    selecting: false,
    selectedIds: [],
    selectedCount: 0,
    allSelected: false,
    albums: [],
    albumId: "",
    currentAlbum: null,
    albumEditing: false,
    albumDraft: { id: "", title: "" },
    albumPicker: false,
    emptyText: "",
    batchOpen: false,
    batchTag: "",
    batchPets: [],
    batchPetIds: [],
    editing: false,
    draft: {},
    editorPets: [],
    uploading: false,
    theater: false,
    theaterIndex: 0,
    theaterPhoto: null,
    theaterTotal: 0,
    theaterPlaying: true,
  },
  onLoad() {},
  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.reload();
  },
  onHide() {
    this.stopTheater();
  },
  onUnload() {
    this.stopTheater();
  },
  noop() {},
  error(error) {
    const message = (error && error.message) || "暂时没有保存成功，请稍后再试";
    this.setData({ formError: message });
    store.toast(message);
  },
  invalid(message) {
    this.setData({ formError: message });
    store.toast(message);
  },
  reload() {
    try {
      this._state = store.get();
      this.setData({ today: store.date() });
      this.refresh();
    } catch (error) {
      this.error(error);
    }
  },
  refresh() {
    const state = this._state || { pets: [], photos: [] },
      pets = list(state.pets),
      allPhotos = list(state.photos);
    const query = this.data.query.trim().toLowerCase(),
      filter = this.data.filter;
    const activePhotos = allPhotos.filter((photo) => !photo.trashedAt);
    const albums = list(state.albums).map((album) => {
      const members = activePhotos.filter(
        (photo) => list(album.photoIds).indexOf(photo.id) !== -1,
      );
      const cover =
        members.find((photo) => photo.id === album.coverId) || members[0];
      return Object.assign({}, album, {
        count: members.length,
        cover: cover ? store.getPhotoSource(cover) : "",
        active: album.id === this.data.albumId,
      });
    });
    const currentAlbum =
      albums.find((album) => album.id === this.data.albumId) || null;
    const visible = allPhotos
      .filter((photo) => {
        if (!!photo.trashedAt !== this.data.recycle) return false;
        const petIds = petIdsFor(photo, pets);
        const matches =
          filter === "all" ||
          (filter === "liked" && photo.liked) ||
          (filter === "together" &&
            (petIds.length > 1 || photo.tag === "一起")) ||
          (filter === "works" && (photo.tag === "作品" || !!photo.template)) ||
          (filter.indexOf("pet:") === 0 &&
            petIds.indexOf(filter.slice(4)) !== -1);
        const text = [photo.title, photo.tag]
          .concat(
            pets
              .filter((pet) => petIds.indexOf(pet.id) !== -1)
              .map((pet) => pet.name),
          )
          .join(" ")
          .toLowerCase();
        return (
          matches &&
          (!currentAlbum ||
            list(currentAlbum.photoIds).indexOf(photo.id) !== -1) &&
          (!query || text.indexOf(query) !== -1)
        );
      })
      .sort((a, b) => {
        if (this.data.sortIndex === 2)
          return String(a.title || "").localeCompare(
            String(b.title || ""),
            "zh-CN",
          );
        if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
        return this.data.sortIndex === 1
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
    const visibleIds = visible.map((photo) => photo.id),
      selectedIds = this.data.selectedIds.filter(
        (id) => visibleIds.indexOf(id) !== -1,
      );
    this._visibleIds = visibleIds;
    const filters = [
      { id: "all", name: "全部" },
      { id: "together", name: "一起" },
    ].concat(
      pets.map((pet) => ({ id: "pet:" + pet.id, name: pet.name })),
      [
        { id: "liked", name: "喜欢" },
        { id: "works", name: "作品" },
      ],
    );
    const mapped = visible.map((photo, index) =>
      Object.assign({}, photo, {
        src: store.getPhotoSource(photo),
        selected: selectedIds.indexOf(photo.id) !== -1,
        frame: String(index + 1).padStart(2, "0"),
        dateText: photo.date || "日期待补充",
        petText: pets
          .filter((pet) => petIdsFor(photo, pets).indexOf(pet.id) !== -1)
          .map((pet) => pet.name)
          .join(" · "),
      }),
    );
    const groupIndex = {},
      groups = [];
    mapped.forEach((item) => {
      const key = (item.date || "").slice(0, 7) || "undated";
      if (!groupIndex[key]) {
        groupIndex[key] = {
          key,
          label:
            key === "undated"
              ? "还没写日期的片段"
              : key.slice(0, 4) + " 年 " + Number(key.slice(5, 7)) + " 月",
          items: [],
        };
        groups.push(groupIndex[key]);
      }
      groupIndex[key].items.push(item);
    });
    this.setData({
      groups,
      photos: mapped,
      albums,
      currentAlbum,
      albumId: currentAlbum ? currentAlbum.id : "",
      emptyText: this.data.recycle
        ? "这里空空的，可爱的回忆都好好留着。"
        : currentAlbum && !currentAlbum.count
          ? "这一册还在等第一帧。退出主题册后，长按照片就能加入。"
          : "没找到这一帧，换个筛选或添一张新照片吧。",
      filters: filters.map((item) =>
        Object.assign({}, item, { active: item.id === filter }),
      ),
      selectedIds,
      selectedCount: selectedIds.length,
      allSelected: !!visible.length && selectedIds.length === visible.length,
      activeCount: allPhotos.filter((photo) => !photo.trashedAt).length,
      trashCount: allPhotos.filter((photo) => photo.trashedAt).length,
    });
    this.petChoices();
  },
  write(change, message) {
    try {
      store.update(change);
      this.reload();
      if (message) store.toast(message);
      return true;
    } catch (error) {
      this.error(error);
      return false;
    }
  },
  changeView(fields) {
    this.stopTheater();
    this.setData(
      Object.assign(
        { selectedIds: [], batchOpen: false, theater: false },
        fields,
      ),
    );
    this.refresh();
  },
  search(event) {
    this.changeView({ query: event.detail.value });
  },
  resetFilters() {
    this.changeView({ query: "", filter: "all", albumId: "", recycle: false });
  },
  filterPhotos(event) {
    this.changeView({ filter: event.currentTarget.dataset.id });
  },
  switchRoom(event) {
    this.changeView({
      recycle: event.currentTarget.dataset.room === "trash",
      albumId: "",
    });
  },
  selectAlbum(event) {
    this.changeView({
      albumId: event.currentTarget.dataset.id || "",
      recycle: false,
      filter: "all",
      query: "",
    });
  },
  openAlbumEditor(event) {
    const id =
      (event && event.currentTarget && event.currentTarget.dataset.id) || "";
    const album = list(this._state.albums).find((item) => item.id === id);
    this._newAlbumSelection = [];
    this.setData({
      albumEditing: true,
      albumPicker: false,
      formError: "",
      albumDraft: {
        id: album ? album.id : "",
        title: album ? album.title : "",
      },
    });
  },
  newAlbumWithSelected() {
    this._newAlbumSelection = this.data.selectedIds.slice();
    this.setData({
      albumEditing: true,
      albumPicker: false,
      formError: "",
      albumDraft: { id: "", title: "" },
    });
  },
  closeAlbumEditor() {
    this.setData({ albumEditing: false });
  },
  albumTitleInput(event) {
    this.setData({ "albumDraft.title": event.detail.value });
  },
  saveAlbum() {
    const title = this.data.albumDraft.title.trim(),
      id = this.data.albumDraft.id;
    if (!title) {
      this.invalid("给这一册起个名字吧");
      return;
    }
    const selected = list(this._newAlbumSelection).slice(),
      newId = id || store.uid();
    if (
      this.write(
        (state) => {
          if (!Array.isArray(state.albums)) state.albums = [];
          if (id) {
            const album = state.albums.find((item) => item.id === id);
            if (!album) throw new Error("这一册已经找不到了，请重新打开");
            album.title = title;
          } else {
            const valid = store
              .activePhotos(state)
              .filter((photo) => selected.indexOf(photo.id) !== -1)
              .map((photo) => photo.id);
            state.albums.unshift({
              id: newId,
              title,
              photoIds: valid,
              coverId: valid[0] || "",
              createdAt: new Date().toISOString(),
            });
          }
        },
        id
          ? "主题册的名字改好啦"
          : selected.length
            ? "新主题册和回忆一起收好啦 ♡"
            : "新的主题册准备好啦 ♡",
      )
    ) {
      this.setData({
        albumEditing: false,
        selectedIds: [],
        albumId: newId,
        selecting: false,
        query: "",
        filter: "all",
      });
      this.refresh();
    }
  },
  deleteAlbum() {
    const album = this.data.currentAlbum;
    if (!album) return;
    wx.showModal({
      title: "收起「" + album.title + "」？",
      content: "只移除这个主题册，原照片、喜欢和其它主题册都会保留。",
      confirmText: "移除主题册",
      confirmColor: "#a56885",
      success: (result) => {
        if (!result.confirm) return;
        if (
          this.write((state) => {
            state.albums = list(state.albums).filter(
              (item) => item.id !== album.id,
            );
          }, "主题册已移除，照片都还在")
        )
          this.changeView({ albumId: "" });
      },
    });
  },
  openAlbumPicker() {
    if (this.data.selectedCount)
      this.setData({ albumPicker: true, batchOpen: false });
  },
  closeAlbumPicker() {
    this.setData({ albumPicker: false });
  },
  addToAlbum(event) {
    const id = event.currentTarget.dataset.id,
      ids = this.data.selectedIds.slice();
    if (!ids.length) return;
    if (
      this.write((state) => {
        const album = list(state.albums).find((item) => item.id === id);
        if (!album) throw new Error("这一册暂时找不到了");
        const valid = store
          .activePhotos(state)
          .filter((photo) => ids.indexOf(photo.id) !== -1)
          .map((photo) => photo.id);
        album.photoIds = list(album.photoIds)
          .concat(valid)
          .filter((value, index, values) => values.indexOf(value) === index);
        if (!album.coverId) album.coverId = valid[0] || "";
      }, "回忆已经加入主题册，原照片仍在相册里 ♡")
    )
      this.setData({ albumPicker: false });
  },
  removeFromAlbum() {
    const id = this.data.albumId,
      ids = this.data.selectedIds.slice();
    if (!id || !ids.length) return;
    if (
      this.write((state) => {
        const album = list(state.albums).find((item) => item.id === id);
        if (album) {
          album.photoIds = list(album.photoIds).filter(
            (value) => ids.indexOf(value) === -1,
          );
          if (ids.indexOf(album.coverId) !== -1) album.coverId = "";
        }
      }, "已从这一册移出，原照片还好好留着")
    ) {
      this.setData({ selectedIds: [] });
      this.refresh();
    }
  },
  setAlbumCover() {
    const albumId = this.data.albumId,
      photoId = this.data.draft.id;
    if (!albumId || !photoId) return;
    this.write((state) => {
      const album = list(state.albums).find((item) => item.id === albumId);
      if (album && list(album.photoIds).indexOf(photoId) !== -1)
        album.coverId = photoId;
    }, "这一帧成为主题册封面啦 ♡");
  },
  sortPhotos(event) {
    this.setData({ sortIndex: Number(event.detail.value) });
    this.refresh();
  },
  toggleSelection() {
    this.changeView({ selecting: !this.data.selecting });
  },
  selectAll() {
    this.setData({
      selectedIds: this.data.allSelected ? [] : this._visibleIds.slice(),
    });
    this.refresh();
  },
  photoTap(event) {
    const id = event.currentTarget.dataset.id;
    if (this.data.selecting) {
      const ids = this.data.selectedIds.slice(),
        index = ids.indexOf(id);
      if (index < 0) ids.push(id);
      else ids.splice(index, 1);
      this.setData({ selectedIds: ids });
      this.refresh();
      return;
    }
    if (this.data.recycle) {
      this.setData({ selecting: true, selectedIds: [id] });
      this.refresh();
      return;
    }
    const photos = this.data.photos,
      urls = photos.map((photo) => photo.src),
      photo = photos.find((item) => item.id === id);
    if (photo && urls.length)
      wx.previewImage({
        current: photo.src,
        urls,
        fail: () => store.toast("照片暂时无法预览"),
      });
  },
  longPressPhoto(event) {
    if (this.data.selecting || this.data.recycle) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ selecting: true, selectedIds: [id] });
    this.refresh();
    store.toast("长按进入多选，再点其它照片继续挑 ♡");
  },
  toggleLike(event) {
    const id = event.currentTarget.dataset.id;
    this.write((state) => {
      const photo = list(state.photos).find((item) => item.id === id);
      if (photo) photo.liked = !photo.liked;
    }, "这帧回忆的喜欢已更新 ♡");
  },
  likeSelected(event) {
    const ids = this.data.selectedIds.slice(),
      liked = !!event.currentTarget.dataset.liked;
    if (!ids.length) return;
    this.write(
      (state) => {
        list(state.photos).forEach((photo) => {
          if (ids.indexOf(photo.id) !== -1) photo.liked = liked;
        });
      },
      liked ? "所选回忆都喜欢上啦 ♡" : "已取消所选照片的喜欢",
    );
  },
  movePhotos(ids, restore) {
    if (!ids.length) return;
    if (
      this.write(
        (state) => {
          list(state.photos).forEach((photo) => {
            if (ids.indexOf(photo.id) !== -1)
              photo.trashedAt = restore ? null : new Date().toISOString();
          });
        },
        restore ? "回忆已经找回来啦 ♡" : "已收进回收站，随时可以找回",
      )
    ) {
      this.setData({ selectedIds: [], batchOpen: false });
      this.refresh();
    }
  },
  moveOne(event) {
    this.movePhotos(
      [event.currentTarget.dataset.id],
      !!event.currentTarget.dataset.restore,
    );
  },
  moveSelected(event) {
    this.movePhotos(
      this.data.selectedIds.slice(),
      !!event.currentTarget.dataset.restore,
    );
  },
  openBatch() {
    if (!this.data.selectedCount) return;
    this.setData({
      batchOpen: !this.data.batchOpen,
      batchTag: "",
      batchPetIds: [],
    });
    this.petChoices();
  },
  batchInput(event) {
    this.setData({ batchTag: event.detail.value });
  },
  batchPet(event) {
    const id = event.currentTarget.dataset.id,
      ids = this.data.batchPetIds.slice(),
      index = ids.indexOf(id);
    if (index < 0) ids.push(id);
    else ids.splice(index, 1);
    this.setData({ batchPetIds: ids });
    this.petChoices();
  },
  applyBatch() {
    const ids = this.data.selectedIds.slice(),
      tag = this.data.batchTag.trim(),
      petIds = this.data.batchPetIds.slice();
    if (!ids.length) return;
    if (!tag && !petIds.length) {
      store.toast("先写一个标签，或选择一位小主角");
      return;
    }
    if (
      this.write((state) => {
        list(state.photos).forEach((photo) => {
          if (ids.indexOf(photo.id) !== -1) {
            if (tag) photo.tag = tag;
            if (petIds.length) photo.petIds = petIds.slice();
          }
        });
      }, "所选回忆的分类整理好啦")
    )
      this.setData({ batchOpen: false });
  },
  openDetails(event) {
    const photo = list(this._state.photos).find(
      (item) => item.id === event.currentTarget.dataset.id,
    );
    if (!photo) return;
    this.setData({
      editing: true,
      formError: "",
      draft: {
        id: photo.id,
        title: photo.title || "",
        date: photo.date || "",
        tag: photo.tag || "",
        petIds: petIdsFor(photo, list(this._state.pets)).slice(),
        src: store.getPhotoSource(photo),
      },
    });
    this.petChoices();
  },
  closeDetails() {
    this.setData({ editing: false });
  },
  draftInput(event) {
    this.setData({
      ["draft." + event.currentTarget.dataset.field]: event.detail.value,
    });
  },
  draftDate(event) {
    if (event.detail.value > store.date()) {
      store.toast("拍摄日子不能晚于今天");
      return;
    }
    this.setData({ "draft.date": event.detail.value });
  },
  clearDraftDate() {
    this.setData({ "draft.date": "" });
  },
  draftPet(event) {
    const id = event.currentTarget.dataset.id,
      ids = this.data.draft.petIds.slice(),
      index = ids.indexOf(id);
    if (index < 0) ids.push(id);
    else ids.splice(index, 1);
    this.setData({ "draft.petIds": ids });
    this.petChoices();
  },
  petChoices() {
    const pets = list(this._state && this._state.pets),
      draftIds = list(this.data.draft.petIds);
    this.setData({
      batchPets: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        selected: this.data.batchPetIds.indexOf(pet.id) !== -1,
      })),
      editorPets: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        selected: draftIds.indexOf(pet.id) !== -1,
      })),
    });
  },
  saveDetails() {
    const draft = this.data.draft,
      title = draft.title.trim();
    if (!title) {
      this.invalid("给这帧回忆起个名字吧");
      return;
    }
    if (draft.date > store.date()) {
      this.invalid("请选择今天或之前的日期");
      return;
    }
    if (
      this.write((state) => {
        const photo = list(state.photos).find((item) => item.id === draft.id);
        if (!photo) throw new Error("这帧回忆暂时找不到了");
        Object.assign(photo, {
          title,
          date: draft.date,
          tag: draft.tag.trim(),
          petIds: draft.petIds.slice(),
          updatedAt: new Date().toISOString(),
        });
      }, "照片旁白已经收好啦 ♡")
    )
      this.setData({ editing: false });
  },
  openTheater() {
    const photos = this.data.photos;
    if (!photos.length) {
      store.toast("先在相册里添一帧回忆");
      return;
    }
    this.setData({
      theater: true,
      theaterIndex: 0,
      theaterPhoto: photos[0],
      theaterTotal: photos.length,
      theaterPlaying: true,
    });
    this.startTheater();
  },
  startTheater() {
    this.stopTheater();
    if (!this.data.theaterPlaying || this.data.theaterTotal < 2) return;
    this._theaterTimer = setInterval(() => this.theaterStep(1), 3500);
  },
  stopTheater() {
    if (this._theaterTimer) {
      clearInterval(this._theaterTimer);
      this._theaterTimer = null;
    }
  },
  closeTheater() {
    this.stopTheater();
    this.setData({ theater: false });
  },
  toggleTheaterPlay() {
    const playing = !this.data.theaterPlaying;
    this.setData({ theaterPlaying: playing });
    if (playing) this.startTheater();
    else this.stopTheater();
  },
  theaterStep(delta) {
    const total = this.data.theaterTotal;
    if (!total) return;
    const index = (this.data.theaterIndex + delta + total) % total;
    const patch = {
      theaterIndex: index,
      theaterPhoto: this.data.photos[index],
    };
    this.setData(patch);
    if (this.data.theaterPlaying) this.startTheater();
  },
  theaterNext() {
    this.theaterStep(1);
  },
  theaterPrev() {
    this.theaterStep(-1);
  },
  theaterTouchStart(event) {
    this._theaterX = event.touches[0].clientX;
  },
  theaterTouchEnd(event) {
    const dx = event.changedTouches[0].clientX - (this._theaterX || 0);
    if (Math.abs(dx) > 40) this.theaterStep(dx < 0 ? 1 : -1);
  },
  openStudio(event) {
    wx.navigateTo({
      url:
        "/pages/studio/index?id=" +
        encodeURIComponent(event.currentTarget.dataset.id),
      fail: () => store.toast("照片工坊暂时无法打开"),
    });
  },
  async upload() {
    if (this.data.uploading) return;
    this.setData({ uploading: true });
    try {
      const added = await store.choosePhotos(9);
      this.reload();
      if (added.length) store.toast("新带回了 " + added.length + " 帧小美好 ♡");
    } catch (error) {
      this.error(error);
    } finally {
      this.setData({ uploading: false });
    }
  },
});
