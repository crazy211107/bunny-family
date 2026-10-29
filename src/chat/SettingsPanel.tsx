import { useEffect, useState } from "react";
import { Database, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Button, Modal, SelectControl } from "./ui";
import * as core from "./generated/core";
import type { Settings, Theme } from "./types";
export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  save,
  error,
  theme,
}: {
  open: boolean;
  onOpenChange(value: boolean): void;
  settings: Settings;
  save(value: Settings, secret: string): boolean;
  error: string;
  theme: Theme;
}) {
  const [form, setForm] = useState(settings),
    [secret, setSecret] = useState(""),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(structuredClone(settings));
      setSecret("");
      setVisible(false);
    }
  }, [open, settings]);
  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      theme={theme}
      title="连接与资料"
      description="使用自己的 AI 服务，决定豆伴可以参考哪些资料。"
    >
      <form
        className="chat-settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (save(form, secret)) {
            setSecret("");
            onOpenChange(false);
          }
        }}
      >
        <fieldset className="chat-fieldset">
          <legend>
            <KeyRound size={16} />
            服务连接
          </legend>
          <label className="chat-field">
            连接方式
            <SelectControl
              label="连接方式"
              value={form.mode}
              options={[
                { id: "direct", name: "直连 · DeepSeek / 兼容 API" },
                { id: "relay", name: "自有服务中转" },
              ]}
              onChange={(value) => patch("mode", value as Settings["mode"])}
            />
          </label>
          <label className="chat-field">
            API 地址
            <input
              type="url"
              required
              value={form.baseUrl}
              onChange={(event) => patch("baseUrl", event.target.value)}
              placeholder="https://api.deepseek.com"
              maxLength={300}
            />
            <small>请使用 HTTPS。浏览器直连还需要服务端允许跨域。</small>
          </label>
          <label className="chat-field">
            模型名称
            <input
              required
              value={form.model}
              onChange={(event) => patch("model", event.target.value)}
              maxLength={120}
            />
            <small>
              {form.mode === "relay"
                ? "中转模式实际使用服务端配置的模型。"
                : "以服务商支持的模型名称为准，也可填写自定义名称。"}
            </small>
          </label>
          <label className="chat-field">
            {form.mode === "relay" ? "中转访问令牌" : "API Key"}
            <div className="chat-secret">
              <input
                type={visible ? "text" : "password"}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="已配置时留空沿用；更换服务后须重新填写"
                maxLength={500}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "隐藏密钥" : "显示密钥"}
              >
                {visible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </label>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={form.rememberKey}
              onChange={(event) => patch("rememberKey", event.target.checked)}
            />
            <span>
              在此设备记住密钥
              <small>默认仅保存在运行内存。开启后会以明文写入本机存储。</small>
            </span>
          </label>
        </fieldset>
        <fieldset className="chat-fieldset">
          <legend>
            <Database size={16} />
            家庭资料范围
          </legend>
          <p className="chat-muted">
            每次发送时读取最新记录。照片和视频默认只提供标题、标签等元信息。
          </p>
          <div className="chat-scope-grid">
            {core.SCOPES.map((scope) => (
              <label key={scope.id} className="chat-check chat-scope-check">
                <input
                  type="checkbox"
                  checked={form.scopes[scope.id]}
                  onChange={(event) =>
                    patch("scopes", {
                      ...form.scopes,
                      [scope.id]: event.target.checked,
                    })
                  }
                />
                <span>{scope.label}</span>
              </label>
            ))}
          </div>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={form.includeContacts}
              onChange={(event) =>
                patch("includeContacts", event.target.checked)
              }
            />
            <span>
              交接资料中包含联系方式
              <small>默认关闭。仅在同时选择“照顾交接”时生效。</small>
            </span>
          </label>
        </fieldset>
        <fieldset className="chat-fieldset">
          <legend>
            <ShieldCheck size={16} />
            对话偏好
          </legend>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={form.keepHistory}
              onChange={(event) => patch("keepHistory", event.target.checked)}
            />
            <span>
              在本机保留对话
              <small>关闭后不再保存新消息；已保存的历史需要单独删除。</small>
            </span>
          </label>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={form.visionEnabled}
              onChange={(event) => patch("visionEnabled", event.target.checked)}
            />
            <span>
              允许本次主动附图
              <small>先确认配置的模型支持图片。图片不保存到对话历史。</small>
            </span>
          </label>
          <div className="chat-field-grid">
            <label className="chat-field">
              最大输出 tokens
              <input
                type="number"
                min={form.mode === "relay" ? 512 : 128}
                max={4096}
                required
                value={form.maxTokens}
                onChange={(event) =>
                  patch("maxTokens", Number(event.target.value))
                }
              />
            </label>
            <label className="chat-field">
              资料预算（字符）
              <input
                type="number"
                min={2500}
                max={28000}
                required
                value={form.maxContextChars}
                onChange={(event) =>
                  patch("maxContextChars", Number(event.target.value))
                }
              />
            </label>
          </div>
          <label className="chat-field">
            表达偏好
            <textarea
              rows={3}
              value={form.systemPrompt}
              onChange={(event) => patch("systemPrompt", event.target.value)}
              maxLength={6000}
              placeholder="例如：回答简短一些，优先使用中文表格。"
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="chat-inline-error">
            {error}
          </p>
        )}
        <div className="chat-settings-footer">
          <span>发送可能产生服务商费用。</span>
          <Button type="submit">保存设置</Button>
        </div>
      </form>
    </Modal>
  );
}
