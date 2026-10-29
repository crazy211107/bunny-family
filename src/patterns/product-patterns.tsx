import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge, BunnyLogo, Button, Card } from "../design/primitives";
export function ProductHeader({
  current,
  onNavigate,
  onAI,
}: {
  current: "home" | "care";
  onNavigate(page: string): void;
  onAI(): void;
}) {
  const [menu, setMenu] = useState(false);
  const links = [
    { id: "home", label: "小窝首页" },
    { id: "care", label: "照顾工作台" },
    { id: "album", label: "回忆相册" },
    { id: "diary", label: "小日子手账" },
  ];
  return (
    <header className="product-header">
      <a
        href="#/home"
        className="product-brand"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("home");
        }}
        aria-label="兔兔小窝首页"
      >
        <BunnyLogo />
        <span>
          <strong>兔兔小窝</strong>
          <small>把照顾记好，把日子留住。</small>
        </span>
      </a>
      <nav className="product-desktop-nav" aria-label="产品主导航">
        {links.map((link) => (
          <a
            key={link.id}
            href={"#/" + link.id}
            aria-current={current === link.id ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(link.id);
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="product-header-actions">
        <Button variant="ghost" size="sm" onClick={onAI}>
          豆伴 AI
        </Button>
        {current === "home" && (
          <Button size="sm" onClick={() => onNavigate("care")}>
            进入工作台
            <ArrowRight />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="product-mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label={menu ? "收起产品导航" : "展开产品导航"}
        >
          {menu ? <X /> : <Menu />}
        </Button>
      </div>
      {menu && (
        <nav className="product-mobile-nav" aria-label="移动端产品导航">
          {links.map((link) => (
            <a
              key={link.id}
              href={"#/" + link.id}
              onClick={(event) => {
                event.preventDefault();
                setMenu(false);
                onNavigate(link.id);
              }}
            >
              {link.label}
              <ChevronRight size={14} />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
export function PageHeader({
  title,
  description,
  action,
  onBack,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  onBack(): void;
}) {
  return (
    <div className="product-page-header">
      <div>
        <button
          className="product-breadcrumb"
          onClick={onBack}
          aria-label="返回首页"
        >
          <ArrowLeft size={14} />
          小窝首页<span>/</span>
          <strong>{title}</strong>
        </button>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function DataTableState({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="product-data-state" role="status">
        <span className="product-skeleton" />
        <span className="product-skeleton" />
        <span className="product-skeleton" />
        <p>正在读取本机记录…</p>
      </div>
    );
  if (error)
    return (
      <div className="product-data-state product-error" role="alert">
        <strong>记录暂未保存</strong>
        <p>{error}</p>
        <p>请保留页面并释放本机空间，避免丢失当前内容。</p>
      </div>
    );
  if (empty)
    return (
      <div className="product-data-state">
        <BunnyLogo />
        <strong>这个筛选下没有事项</strong>
        <p>试试切换兔兔、日期，或清空关键词。</p>
      </div>
    );
  return <>{children}</>;
}
export interface ProofRow {
  id: string;
  label: string;
  count: number;
  total: number;
}
export function ProductProof({
  rows,
  onOpen,
  caption,
}: {
  rows: ProofRow[];
  onOpen(): void;
  caption: string;
}) {
  return (
    <Card className="product-proof">
      <div className="product-proof-bar">
        <span>
          <i />
          本机实时记录
        </span>
        <Badge>今日照顾</Badge>
      </div>
      <div className="product-proof-title">
        <div>
          <small>CARE WORKSPACE</small>
          <h3>一眼看清，今天的小事。</h3>
        </div>
        <span className="product-proof-date">
          {new Date().toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
          })}
        </span>
      </div>
      {rows.map((row) => (
        <div className="product-proof-row" key={row.id}>
          <span className={"product-pet-token product-pet-" + row.id}>
            {row.label.slice(0, 1)}
          </span>
          <strong>{row.label}</strong>
          <div
            className="product-proof-progress"
            role="progressbar"
            aria-label={`${row.label}今日记录`}
            aria-valuenow={row.count}
            aria-valuemin={0}
            aria-valuemax={row.total}
          >
            <span
              style={{
                width: `${row.total ? (row.count / row.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span>
            {row.count}/{row.total}
          </span>
        </div>
      ))}
      {!rows.length && <p className="product-proof-no-data">尚无兔兔档案</p>}
      <div className="product-proof-footer">
        <span>{caption}</span>
        <button onClick={onOpen}>
          打开完整工作台
          <ArrowRight size={13} />
        </button>
      </div>
    </Card>
  );
}
export function FeatureModule({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <section className="product-feature-module">
      <div>
        <span className="product-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}
export function ProductFooter({
  onNavigate,
  onPrivacy,
}: {
  onNavigate(page: string): void;
  onPrivacy(): void;
}) {
  return (
    <footer className="product-footer">
      <div>
        <BunnyLogo small />
        <span>
          兔兔小窝<small>豆米与豆糕的家庭手账</small>
        </span>
      </div>
      <nav aria-label="帮助与信任">
        <a
          href="#/care"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("care");
          }}
        >
          照顾工作台
        </a>
        <button onClick={onPrivacy}>本机资料说明</button>
        <a href="#product-faq">使用说明</a>
      </nav>
      <span>私人家庭项目 · 当前版本无云同步</span>
    </footer>
  );
}
