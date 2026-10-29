Component({
  properties: {
    value: { type: String, value: "" },
    placeholder: { type: String, value: "搜索小美好…" },
    label: { type: String, value: "搜索" },
  },
  methods: {
    input(event) {
      this.triggerEvent("change", { value: event.detail.value });
    },
    clear() {
      this.triggerEvent("change", { value: "" });
    },
    confirm(event) {
      this.triggerEvent("search", { value: event.detail.value });
    },
  },
});
