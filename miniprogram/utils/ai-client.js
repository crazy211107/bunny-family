function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function utf8ByteLength(value) {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}
function endpoint(settings) {
  const base = String(settings.baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (
    !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:\/[a-z0-9_~!$&'()*+,;=:@%./-]*)?$/i.test(
      base,
    ) ||
    /[\\\s?#]|\/\.\.(?:\/|$)/.test(base)
  )
    throw failure(
      "CONFIG",
      "接口地址需要是有效 HTTPS 地址，不能包含账号、查询参数或片段",
    );
  return /\/chat\/completions$/i.test(base) ? base : base + "/chat/completions";
}
function validateSettings(settings, secret) {
  if (!settings || ["direct", "relay"].indexOf(settings.mode) < 0)
    throw failure("CONFIG", "请先选择直连或中转模式");
  const url = endpoint(settings);
  if (
    settings.mode === "direct" &&
    (!String(settings.model || "").trim() ||
      String(settings.model).length > 120)
  )
    throw failure("CONFIG", "请填写接口提供商支持的模型名称");
  if (typeof secret !== "string" || !/^[\x21-\x7e]{8,500}$/.test(secret))
    throw failure(
      "CONFIG",
      settings.mode === "relay"
        ? "请填写有效的中转访问令牌"
        : "请填写有效的 API Key",
    );
  const minimum = settings.mode === "relay" ? 512 : 128;
  if (
    !Number.isFinite(Number(settings.maxTokens)) ||
    Number(settings.maxTokens) < minimum ||
    Number(settings.maxTokens) > 4096
  )
    throw failure("CONFIG", "输出上限需为 " + minimum + " 到 4096");
  if (
    !Number.isFinite(Number(settings.temperature)) ||
    Number(settings.temperature) < 0 ||
    Number(settings.temperature) > 2
  )
    throw failure("CONFIG", "随机度需在 0 到 2 之间");
  return url;
}
// WeChat JS runtimes do not consistently expose TextDecoder. Keep incomplete UTF-8
// code points between chunks; never decode each ArrayBuffer independently.
function createUtf8Decoder() {
  let pending = [];
  return {
    push(input, final) {
      if (typeof input === "string") return input;
      const view =
        input instanceof Uint8Array
          ? input
          : new Uint8Array(input || new ArrayBuffer(0));
      const bytes = pending.concat(Array.from(view));
      pending = [];
      let result = "",
        index = 0;
      while (index < bytes.length) {
        const head = bytes[index];
        let width =
          head < 0x80
            ? 1
            : head >= 0xc2 && head <= 0xdf
              ? 2
              : head >= 0xe0 && head <= 0xef
                ? 3
                : head >= 0xf0 && head <= 0xf4
                  ? 4
                  : 0;
        if (!width) {
          result += "\ufffd";
          index++;
          continue;
        }
        if (index + width > bytes.length) {
          if (!final) pending = bytes.slice(index);
          else result += "\ufffd";
          break;
        }
        let point = width === 1 ? head : head & (0x7f >> width),
          valid = true;
        for (let step = 1; step < width; step++) {
          const byte = bytes[index + step];
          if ((byte & 0xc0) !== 0x80) {
            valid = false;
            break;
          }
          point = (point << 6) | (byte & 0x3f);
        }
        if (
          !valid ||
          (width === 2 && point < 0x80) ||
          (width === 3 && point < 0x800) ||
          (width === 4 && point < 0x10000) ||
          point > 0x10ffff ||
          (point >= 0xd800 && point <= 0xdfff)
        ) {
          result += "\ufffd";
          index++;
          continue;
        }
        result +=
          point <= 0xffff
            ? String.fromCharCode(point)
            : String.fromCharCode(
                0xd800 + ((point - 0x10000) >> 10),
                0xdc00 + ((point - 0x10000) & 0x3ff),
              );
        index += width;
      }
      return result;
    },
  };
}
function createSseParser(onEvent) {
  const decoder = createUtf8Decoder();
  let buffer = "",
    lines = [];
  function dispatch() {
    if (!lines.length) return;
    const data = lines.join("\n");
    lines = [];
    if (data === "[DONE]") {
      onEvent({ done: true });
      return;
    }
    let event;
    try {
      event = JSON.parse(data);
    } catch (error) {
      throw failure(
        "PROTOCOL",
        "接口返回了无法识别的流数据，请检查兼容接口配置",
      );
    }
    onEvent(event);
  }
  function drain(final) {
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (!line) dispatch();
      else if (line.indexOf("data:") === 0)
        lines.push(line.slice(5).replace(/^ /, ""));
      if (lines.join("").length > 262144)
        throw failure("PROTOCOL", "接口单条响应过大");
    }
    if (buffer.length > 262144) throw failure("PROTOCOL", "接口响应过大");
    if (final) {
      if (buffer.indexOf("data:") === 0)
        lines.push(buffer.slice(5).replace(/^ /, "").replace(/\r$/, ""));
      buffer = "";
      dispatch();
    }
  }
  return {
    push(chunk) {
      buffer += decoder.push(chunk, false);
      drain(false);
    },
    end() {
      buffer += decoder.push(new Uint8Array(0), true);
      drain(true);
    },
  };
}
function statusError(status) {
  const labels = {
    400: "请求参数或模型不兼容，请检查模型名和接口配置",
    401: "密钥或中转访问令牌未通过验证",
    402: "接口账户余额不足，请在服务商后台查看",
    403: "接口拒绝访问，请检查账户权限",
    404: "接口路径或模型不存在，请检查地址",
    413: "发送的资料或图片太大，请缩小范围",
    429: "请求过于频繁或额度受限，请稍后重试",
  };
  return failure(
    "HTTP_" + status,
    labels[status] ||
      (status >= 500
        ? "AI 服务暂时不可用，请稍后重试"
        : "接口未能完成请求，请检查配置"),
  );
}
function requestChat(options) {
  const opt = options || {},
    settings = opt.settings || {},
    url = validateSettings(settings, opt.secret);
  if (!Array.isArray(opt.messages) || !opt.messages.length)
    throw failure("CONFIG", "没有要发送的对话内容");
  const payload = {
    messages: opt.messages,
    stream: true,
    max_tokens: Math.round(Number(settings.maxTokens)),
    temperature: Number(settings.temperature),
  };
  if (settings.mode === "direct") {
    payload.model = settings.model.trim();
    if (/^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(url))
      payload.reasoning_effort = "none";
  }
  if (utf8ByteLength(JSON.stringify(payload)) > 256 * 1024)
    throw failure(
      "PAYLOAD_LIMIT",
      "资料和图片合计偏大，请缩小资料预算、缩短对话或换一张更小的图片",
    );
  let task,
    complete = false,
    streamEnded = false,
    full = "",
    usage = null,
    model = settings.model,
    finishReason = "",
    chunks = 0,
    resolvePromise,
    rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  function reject(error) {
    if (complete) return;
    complete = true;
    rejectPromise(error);
  }
  function resolve() {
    if (complete) return;
    if (!full.trim()) {
      reject(
        failure(
          "EMPTY",
          "模型没有返回正文。可检查模型是否开启思考、增加输出上限或重新提问",
        ),
      );
      return;
    }
    complete = true;
    resolvePromise({ text: full, usage, model, finishReason });
  }
  function event(value) {
    if (complete) return;
    if (value.error) {
      reject(
        failure("UPSTREAM", "AI 接口返回错误，请检查配置、余额与模型权限"),
      );
      return;
    }
    if (value.done) {
      streamEnded = true;
      return;
    }
    if (value.usage) usage = value.usage;
    if (typeof value.model === "string") model = value.model;
    const choice = value.choices && value.choices[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const part =
      (choice.delta && choice.delta.content) ||
      (choice.message && choice.message.content);
    if (typeof part === "string") {
      full += part;
      if (full.length > 16000) {
        reject(
          failure("OUTPUT_LIMIT", "回答较长，已保留收到的部分，请分段继续询问"),
        );
        if (task && task.abort) task.abort();
        return;
      }
      if (opt.onDelta) opt.onDelta(full);
    }
  }
  const parser = createSseParser(event);
  try {
    task = wx.request({
      url,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + opt.secret,
      },
      data: payload,
      enableChunked: true,
      responseType: "text",
      dataType: "text",
      timeout: 60000,
      success(result) {
        if (complete) return;
        const status = Number(result.statusCode);
        if (status < 200 || status >= 300) {
          reject(statusError(status));
          return;
        }
        try {
          if (!chunks) {
            const body = result.data;
            if (
              body &&
              typeof body === "object" &&
              !(body instanceof ArrayBuffer)
            )
              event(body);
            else if (typeof body === "string" && /^\s*\{/.test(body)) {
              let value;
              try {
                value = JSON.parse(body);
              } catch (error) {
                throw failure("PROTOCOL", "接口没有返回有效 JSON");
              }
              event(value);
            } else if (body) parser.push(body);
          }
          parser.end();
          if (
            (chunks ||
              (typeof result.data === "string" &&
                result.data.indexOf("data:") >= 0)) &&
            !streamEnded &&
            !finishReason
          ) {
            reject(
              failure(
                "INCOMPLETE",
                "连接在回答结束前中断，已保留收到的部分，请重试或继续询问",
              ),
            );
            return;
          }
          resolve();
        } catch (error) {
          reject(
            error.code
              ? error
              : failure("PROTOCOL", "接口响应无法解析，请检查兼容协议"),
          );
        }
      },
      fail(error) {
        if (complete) return;
        const detail = (error && error.errMsg) || "";
        reject(
          /timeout/i.test(detail)
            ? failure("TIMEOUT", "等待 AI 超时，已保留收到的部分，可以稍后重试")
            : /url not in domain|domain list/i.test(detail)
              ? failure("DOMAIN", "请在微信后台配置此接口的 request 合法域名")
              : failure(
                  "NETWORK",
                  "无法连接 AI 接口，请检查网络、HTTPS 证书与域名配置",
                ),
        );
      },
    });
    if (task && typeof task.onChunkReceived === "function")
      task.onChunkReceived((result) => {
        if (complete) return;
        try {
          chunks++;
          parser.push(result.data);
        } catch (error) {
          reject(error.code ? error : failure("PROTOCOL", "流式响应无法解析"));
          if (task && task.abort) task.abort();
        }
      });
  } catch (error) {
    reject(failure("NETWORK", "网络请求未能启动，请检查微信基础库和连接配置"));
  }
  return {
    promise,
    abort() {
      if (complete) return;
      reject(failure("ABORTED", "已停止生成，收到的部分仍保留"));
      if (task && task.abort) task.abort();
    },
  };
}
module.exports = {
  endpoint,
  validateSettings,
  createUtf8Decoder,
  createSseParser,
  requestChat,
};
