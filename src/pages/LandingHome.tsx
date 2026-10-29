import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Images,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { Badge, BunnyLogo, Button } from "../design/primitives";
import {
  FeatureModule,
  ProductFooter,
  ProductHeader,
  ProductProof,
} from "../patterns/product-patterns";
import { localDay, type ProductPageProps } from "./product-types";
export default function LandingHome({ state, go, openAI }: ProductPageProps) {
  const [privacy, setPrivacy] = useState(false);
  const today = localDay();
  const rows = state.pets.map((pet) => ({
    id: pet.id,
    label: pet.name,
    count: ["hay", "water", "clean", "play"].filter(
      (item) => state.checkins[pet.id + ":" + today]?.[item],
    ).length,
    total: 4,
  }));
  const completed = rows.reduce((sum, row) => sum + row.count, 0),
    total = rows.length * 4;
  return (
    <div className="chat-app product-app product-landing">
      <ProductHeader current="home" onNavigate={go} onAI={openAI} />
      <section className="product-hero">
        <div className="product-hero-copy">
          <span className="product-eyebrow">
            <span />
            给两只兔兔，也给认真生活的你
          </span>
          <h1>
            把照顾记好，
            <br />
            <em>让可爱有迹可循。</em>
          </h1>
          <p>
            牧草添了没有，今天又长大了多少。
            <br />
            把豆米和豆糕的小事，收进同一本家庭手账。
          </p>
          <div className="product-hero-actions">
            <Button onClick={() => go("care")}>
              打开照顾工作台
              <ArrowRight />
            </Button>
            <Button variant="ghost" onClick={() => go("album")}>
              翻翻我们的回忆
              <ChevronArrow />
            </Button>
          </div>
          <div className="product-hero-trust">
            <ShieldCheck size={14} />
            <span>本机保存</span>
            <span>·</span>
            <span>真实记录</span>
            <span>·</span>
            <span>每次修改由你决定</span>
          </div>
          <div className="product-hero-today">
            <span>今天的小窝</span>
            <strong>
              {completed}
              <small> / {total} 项已记录</small>
            </strong>
            <span>没有记录，不代表没有照顾。</span>
          </div>
        </div>
        <div className="product-hero-stage">
          <figure className="product-hero-photo">
            <img
              src="/photos/together-home.jpg"
              alt="豆米和豆糕依偎在一起的真实照片"
              loading="eager"
            />
            <figcaption>
              <span>OUR LITTLE HOME</span>
              <strong>一起，就很好。</strong>
              <small>豆米 & 豆糕 · 家庭原始照片</small>
            </figcaption>
            <span className="product-photo-frame" />
          </figure>
          <ProductProof
            rows={rows}
            caption="与工作台使用同一份本机数据"
            onOpen={() => go("care")}
          />
        </div>
      </section>
      <section className="product-friction">
        <div>
          <span className="product-eyebrow">少一点惦记，多一点确定</span>
          <h2>
            从“应该做过了”，
            <br />
            到一份看得见的记录。
          </h2>
        </div>
        <div className="product-before">
          <span>零散记录时</span>
          <p>
            照顾在聊天里、照片在相册里，
            <br />
            想回顾时再到处寻找。
          </p>
        </div>
        <div className="product-after">
          <span>
            <Check size={14} />
            在同一个小窝里
          </span>
          <p>
            按兔兔查看今日事项，
            <br />
            每次打卡留下真实时间，可撤销。
          </p>
          <button onClick={() => go("care")}>
            看看怎么记录
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
      <FeatureModule
        eyebrow="01 / 把日常安排得明明白白"
        title="一页，照顾好今天。"
        description="按兔兔、事项和状态筛选，集中查看记录。不靠颜色猜测，也不用在不同档案间反复翻找。"
        action={
          <Button variant="outline" onClick={() => go("care")}>
            进入照顾工作台
            <ArrowRight />
          </Button>
        }
      >
        <div className="product-feature-care">
          <div>
            <BunnyLogo />
            <div>
              <strong>照顾记录</strong>
              <small>可筛选 · 可撤销 · 历史只读</small>
            </div>
            <Badge>
              {completed}/{total} 已记录
            </Badge>
          </div>
          {["新鲜牧草", "干净饮水", "整洁小窝", "认真陪伴"].map(
            (text, index) => (
              <div key={text}>
                <span className="product-feature-index">0{index + 1}</span>
                <span>{text}</span>
                <span>由你确认完成</span>
              </div>
            ),
          )}
        </div>
      </FeatureModule>
      <FeatureModule
        eyebrow="02 / 留住一起生活的证据"
        title={"记下的每一页，\n都值得再看一遍。"}
        description="照片归进回忆相册，心情写成小日子。想整理时，再请豆伴参考你选中的记录帮个忙。"
        action={
          <div className="product-feature-actions">
            <Button variant="outline" onClick={() => go("diary")}>
              <PencilLine />
              写一页手账
            </Button>
            <Button variant="ghost" onClick={openAI}>
              和豆伴聊聊
              <ArrowRight />
            </Button>
          </div>
        }
      >
        <div className="product-memory-proof">
          <img
            src="/photos/qiuqiu-home.jpg"
            alt="豆米在小窝里的真实照片"
            loading="lazy"
          />
          <div>
            <img
              src="/photos/doudou-close.jpg"
              alt="豆糕的真实近照"
              loading="lazy"
            />
            <span>小日子，一页一页收好。</span>
            <Badge>
              {state.photos.filter((photo) => !photo.trashedAt).length}{" "}
              张本机照片
            </Badge>
          </div>
        </div>
      </FeatureModule>
      <section className="product-workflow">
        <div>
          <span className="product-eyebrow">由你掌控的每一步</span>
          <h2>记录，不替你做决定。</h2>
        </div>
        <ol>
          {[
            { title: "留下记录", text: "选择兔兔和事项，主动确认。" },
            { title: "查看与修改", text: "查看时间，发现记错可以撤销。" },
            { title: "按需整理", text: "可让豆伴参考选定的资料范围。" },
            { title: "由你保存", text: "AI 给出建议，真实变更仍由你操作。" },
          ].map((step, index) => (
            <li key={step.title}>
              <span>0{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="product-trust-section">
        <LockKeyhole size={22} />
        <div>
          <h2>这是你们家的小窝。</h2>
          <p>
            首屏展示的是你的本机记录和提供的原始照片。没有虚构客户、节省时长或自动完成数字。当前版本不提供云同步，AI
            仅在主动发送时访问所选资料。
          </p>
        </div>
        <Button variant="outline" onClick={() => setPrivacy(!privacy)}>
          资料与使用边界
        </Button>
        {privacy && (
          <div className="product-privacy-note" role="status">
            <strong>数据说明</strong>
            <p>
              家庭记录保存在当前浏览器，清理浏览器存储可能丢失。微信端使用独立本机数据。AI
              API
              由你配置，发送前可预览范围；服务商可能按用量收费。没有订阅套餐、自动发布或后台同步。
            </p>
          </div>
        )}
      </section>
      <section className="product-faq" id="product-faq">
        <div>
          <span className="product-eyebrow">使用之前，你可能想知道</span>
          <h2>小窝使用说明</h2>
        </div>
        <div>
          {[
            {
              q: "需要先配置 AI，才能记录照顾吗？",
              a: "不需要。照顾记录、相册和手账均可独立使用。豆伴需要另外填写你自己的 API 服务与密钥。",
            },
            {
              q: "首页的完成数从哪里来？",
              a: "由今天、每只兔兔的喂草、换水、铲屎、陪玩四项本机记录实时计算。只统计明确记录的项目，不推断实际是否照顾。",
            },
            {
              q: "为什么没有定价和客户案例？",
              a: "这是私人家庭项目，当前没有订阅服务或客户案例。API 费用由你选用的服务商决定，本项目不编造收费套餐或使用证据。",
            },
            {
              q: "更换设备后会自动同步吗？",
              a: "当前不会。浏览器和微信各自保留本机数据；清理缓存前请自行备份重要照片与记录。",
            },
          ].map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <ProductFooter
        onNavigate={go}
        onPrivacy={() => {
          setPrivacy(true);
          document.querySelector(".product-trust-section")?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          });
        }}
      />
    </div>
  );
}
function ChevronArrow() {
  return <ArrowRight size={14} />;
}
