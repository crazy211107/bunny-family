module.exports = {
  content: ['./src/{chat,design,pages,patterns}/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  important: '.chat-app',
  theme: { extend: { colors: {
    background: 'var(--chat-bg)', foreground: 'var(--chat-fg)', muted: 'var(--chat-muted)',
    border: 'var(--chat-border)', primary: 'var(--chat-accent)', 'primary-foreground': 'var(--chat-on-accent)',
  } } },
};
