// AI 内容始终作为 text 渲染，不执行 HTML、脚本或模型返回的链接。
// 只识别常用段落形态，既便于窄屏阅读，也避免依赖 HTML 渲染器。
function blocks(content) {
  const result = [];
  let code = null;
  String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      if (/^\s*```/.test(line)) {
        if (code) {
          result.push({ type: "code", text: code.join("\n") });
          code = null;
        } else code = [];
        return;
      }
      if (code) {
        code.push(line);
        return;
      }
      if (!line.trim()) {
        if (result.length && result[result.length - 1].type !== "space")
          result.push({ type: "space", text: "" });
        return;
      }
      const heading = line.match(/^\s{0,3}#{1,4}\s+(.+)/);
      const bullet = line.match(/^\s*[-*+]\s+(.+)/);
      const numbered = line.match(/^\s*(\d+[.)、])\s*(.+)/);
      const quote = line.match(/^\s*>\s?(.*)/);
      if (heading) result.push({ type: "heading", text: heading[1] });
      else if (bullet) result.push({ type: "bullet", text: "• " + bullet[1] });
      else if (numbered)
        result.push({ type: "bullet", text: numbered[1] + " " + numbered[2] });
      else if (quote) result.push({ type: "quote", text: quote[1] });
      else result.push({ type: "paragraph", text: line });
    });
  if (code) result.push({ type: "code", text: code.join("\n") });
  // 连续普通行合并，极长列表尾部收为同一文本块，保留全部文字并控制渲染节点数。
  const compact = [];
  result.forEach((item) => {
    const previous = compact[compact.length - 1];
    if (item.type === "paragraph" && previous && previous.type === "paragraph")
      previous.text += "\n" + item.text;
    else compact.push(item);
  });
  if (compact.length > 160)
    compact.splice(160, compact.length - 160, {
      type: "paragraph",
      text: compact
        .slice(160)
        .map((item) => item.text)
        .join("\n"),
    });
  return compact.map((item, index) =>
    Object.assign({ id: index }, item, {
      runs: item.type === "code" ? [] : inline(item.text),
    }),
  );
}

function inline(value) {
  const result = [],
    pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0,
    match;
  while ((match = pattern.exec(value))) {
    if (match.index > last)
      result.push({ text: value.slice(last, match.index), kind: "text" });
    const bold = match[0].slice(0, 2) === "**";
    result.push({
      text: match[0].slice(bold ? 2 : 1, bold ? -2 : -1),
      kind: bold ? "bold" : "code",
    });
    last = pattern.lastIndex;
  }
  if (last < value.length || !result.length)
    result.push({ text: value.slice(last), kind: "text" });
  return result.map((run, index) => Object.assign({ id: index }, run));
}

module.exports = { blocks };
