Component({
  options: { addGlobalClass: true },
  properties: {
    text: { type: String, value: '' },
    sub: { type: String, value: '' },
    symbol: { type: String, value: 'ᕱ⑅ᕱ' },
    action: { type: String, value: '' }
  },
  methods: {
    onAction() {
      this.triggerEvent('action');
    }
  }
});
