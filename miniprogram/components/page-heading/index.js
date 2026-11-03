Component({
  properties: {
    eyebrow: { type: String, value: "" },
    title: { type: String, value: "" },
    description: { type: String, value: "" },
    action: { type: String, value: "" },
    busy: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    primary() {
      if (!this.data.busy && !this.data.disabled) this.triggerEvent("primary");
    },
  },
});
