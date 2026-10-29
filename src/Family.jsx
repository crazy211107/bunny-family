import React, { useRef, useState } from "react";
import { Button, Icon, PageTitle, Bunny, Empty } from "./ui";
import { birthdayCountdown, localDate, uid } from "./data";
import { imageFile } from "./media";
export default function Family({ state, setState, open, notify }) {
  const drag = useRef(null);
  const move = (id, offset) =>
    setState((s) => {
      const members = [...s.members],
        index = members.findIndex((x) => x.id === id),
        target = index + offset;
      if (target < 0 || target >= members.length) return s;
      [members[index], members[target]] = [members[target], members[index]];
      return { ...s, members };
    });
  return (
    <div className="family-page page-enter">
      <PageTitle title="家里的可爱们" subtitle="有人负责照顾，有人负责可爱。">
        <Button
          icon="UserRoundPlus"
          variant="pink tape-button"
          onClick={() => open({ type: "member" })}
        >
          添一位家人
        </Button>
      </PageTitle>
      <div className="family-intro">
        <span className="handwritten">Our little cast ♡</span>
        <h2>
          一家人，
          <br />
          一起把日子过软。
        </h2>
        <p>
          在我们的电影里，
          <br />
          每一个你，都是不可缺少的主角。
        </p>
        <Bunny size={115} />
      </div>
      <div className="family-timeline">
        {state.members.length ? (
          state.members.map((m, i) => {
            const days = birthdayCountdown(m.birthday);
            return (
              <article
                className={`member-card member-${i % 3}`}
                key={m.id}
                draggable
                onDragStart={() => {
                  drag.current = m.id;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = drag.current;
                  if (!id || id === m.id) return;
                  setState((s) => {
                    const members = s.members.filter((x) => x.id !== id);
                    members.splice(
                      members.findIndex((x) => x.id === m.id),
                      0,
                      s.members.find((x) => x.id === id),
                    );
                    return { ...s, members };
                  });
                  drag.current = null;
                }}
              >
                <span className="timeline-node">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="member-avatar">
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.name} />
                  ) : (
                    <Bunny size={58} />
                  )}
                </div>
                <div className="member-main">
                  <span className="role-sticker">
                    {m.role || "家里的小可爱"}
                  </span>
                  <h3>{m.name}</h3>
                  <p>
                    {days === null
                      ? "生日还没贴上小便签"
                      : days === 0
                        ? "今天是生日，快乐要加倍 ♡"
                        : `距离生日还有 ${days} 天`}
                  </p>
                  {m.relationTo && m.relation && (
                    <small>
                      和
                      {state.members.find((x) => x.id === m.relationTo)?.name ||
                        "家人"}{" "}
                      · {m.relation}
                    </small>
                  )}
                </div>
                <div className="member-actions">
                  <button
                    className="icon-button"
                    aria-label={`编辑家人：${m.name}`}
                    onClick={() => open({ type: "member", id: m.id })}
                  >
                    <Icon name="Pencil" size={19} />
                  </button>
                  <div>
                    <button
                      className="tiny-button"
                      disabled={i === 0}
                      aria-label={`上移家人：${m.name}`}
                      onClick={() => move(m.id, -1)}
                    >
                      <Icon name="ArrowUp" size={16} />
                    </button>
                    <button
                      className="tiny-button"
                      disabled={i === state.members.length - 1}
                      aria-label={`下移家人：${m.name}`}
                      onClick={() => move(m.id, 1)}
                    >
                      <Icon name="ArrowDown" size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <Empty text="把第一位家人请进故事里。" />
        )}
        <div className="family-end">♡ 我们的小故事，还长着呢</div>
      </div>
      <p className="family-footnote">
        “我”和“家人”为可编辑的演示成员。拖动卡片或用上下箭头，排出喜欢的顺序。
      </p>
    </div>
  );
}
export function MemberForm({ member, state, setState, onClose, notify }) {
  const [form, setForm] = useState(
    member || {
      id: uid(),
      name: "",
      role: "",
      birthday: "",
      avatar: "",
      relationTo: "",
      relation: "",
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blob = await imageFile(file, 300);
      const reader = new FileReader();
      const data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      update("avatar", data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = () => {
    setState((s) => ({
      ...s,
      members: s.members
        .filter((x) => x.id !== member.id)
        .map((x) =>
          x.relationTo === member.id
            ? { ...x, relationTo: "", relation: "" }
            : x,
        ),
    }));
    notify("这位家人已从名单移除");
    onClose();
  };
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setState((s) => ({
          ...s,
          members: member
            ? s.members.map((x) =>
                x.id === form.id ? { ...form, name: form.name.trim() } : x,
              )
            : [...s.members, { ...form, name: form.name.trim() }],
        }));
        notify("把家人的可爱收好啦 ♡");
        onClose();
      }}
    >
      <label className="avatar-upload">
        {form.avatar ? (
          <img src={form.avatar} alt="家人头像" />
        ) : (
          <Bunny size={65} />
        )}
        <span>
          {busy ? "正在准备头像…" : "挑一张头像"}
          <Icon name="Camera" size={16} />
        </span>
        <input type="file" accept="image/*" onChange={upload} />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <label>
        昵称
        <input
          required
          maxLength={20}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="我们怎么称呼你？"
        />
      </label>
      <label>
        角色贴纸
        <input
          maxLength={30}
          value={form.role}
          onChange={(e) => update("role", e.target.value)}
          placeholder="铲屎官 / 喂兔专员 / 开心果"
        />
      </label>
      <label>
        生日（选填）
        <input
          type="date"
          max={localDate()}
          value={form.birthday}
          onChange={(e) => update("birthday", e.target.value)}
        />
      </label>
      <div className="form-row">
        <label>
          关系连到谁
          <select
            value={form.relationTo}
            onChange={(e) => update("relationTo", e.target.value)}
          >
            <option value="">先不连线</option>
            {state.members
              .filter((m) => m.id !== form.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          关系批注
          <input
            maxLength={20}
            value={form.relation}
            onChange={(e) => update("relation", e.target.value)}
            placeholder="例如：好搭档"
            disabled={!form.relationTo}
          />
        </label>
      </div>
      <Button
        disabled={busy || !form.name.trim()}
        variant="pink tape-button"
        icon="Heart"
        type="submit"
      >
        保存这个家人
      </Button>
      {member && (
        <button type="button" className="text-button danger" onClick={remove}>
          <Icon name="Trash2" size={16} /> 从家人名单移除
        </button>
      )}
    </form>
  );
}
