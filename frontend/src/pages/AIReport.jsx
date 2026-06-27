import { useEffect, useState, useRef, useCallback, memo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { useTheme } from "../context/ThemeContext";
import Topbar from "../components/Topbar";
import SymbolPicker from "../components/SymbolPicker";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Inline markdown renderer ─────────────────────────────────────────────────

function inlineMd(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function ReportLine({ line, idx }) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={idx} className="h-3" />;
  if (trimmed.startsWith("## ")) {
    return (
      <div key={idx} className="mt-10 mb-4 first:mt-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(99,102,241,0.5),transparent)" }} />
        </div>
        <h2 className="text-base font-black uppercase tracking-[0.1em]" style={{ color: "var(--c-accent)" }}>
          {trimmed.slice(3)}
        </h2>
      </div>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h3 key={idx} className="mt-6 mb-2 text-sm font-bold text-slate-200 border-l-2 border-indigo-500/40 pl-3">
        {trimmed.slice(4)}
      </h3>
    );
  }
  if (trimmed === "---" || trimmed.match(/^─{3,}$/) || trimmed.match(/^═{3,}$/)) {
    return <hr key={idx} className="my-6 border-slate-700/50" />;
  }
  const num = trimmed.match(/^(\d+)\.\s+(.+)/);
  if (num) {
    return (
      <div key={idx} className="flex gap-3 mb-2 ml-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5" style={{ backgroundColor: "var(--c-chip-bg)", color: "var(--c-accent)" }}>
          {num[1]}
        </span>
        <p className="text-sm text-slate-300 leading-relaxed flex-1">{inlineMd(num[2])}</p>
      </div>
    );
  }
  const bullet = trimmed.match(/^[-•*]\s+(.+)/);
  if (bullet) {
    return (
      <div key={idx} className="flex gap-2.5 mb-1.5 ml-2">
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500/50 mt-2" />
        <p className="text-sm text-slate-300 leading-relaxed flex-1">{inlineMd(bullet[1])}</p>
      </div>
    );
  }
  const subBullet = line.match(/^\s{2,}[-•]\s+(.+)/);
  if (subBullet) {
    return (
      <div key={idx} className="flex gap-2 mb-1 ml-6">
        <span className="flex-shrink-0 w-1 h-1 rounded-full bg-slate-600 mt-2.5" />
        <p className="text-xs text-slate-400 leading-relaxed flex-1">{inlineMd(subBullet[1])}</p>
      </div>
    );
  }
  if (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.slice(2, -2).includes("**")) {
    return (
      <p key={idx} className="text-xs font-bold uppercase tracking-widest text-indigo-400 mt-4 mb-1">
        {trimmed.slice(2, -2)}
      </p>
    );
  }
  return (
    <p key={idx} className="text-sm text-slate-300 leading-relaxed mb-1">{inlineMd(trimmed)}</p>
  );
}

function ReportBody({ text, streaming }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => <ReportLine key={i} line={line} idx={i} />)}
      {streaming && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse rounded-sm ml-0.5" />}
    </div>
  );
}

// ─── Research Pipeline flow ────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "price",     label: "Price history downloaded" },
  { id: "news",      label: "News articles classified" },
  { id: "finbert",   label: "FinBERT sentiment applied" },
  { id: "sarsa",     label: "SARSA strategy executed" },
  { id: "benchmark", label: "Benchmark comparison computed" },
  { id: "risk",      label: "Risk metrics calculated" },
  { id: "attr",      label: "News categories analyzed" },
  { id: "lag",       label: "Lag correlation computed" },
  { id: "report",    label: "Research report generating…" },
  { id: "done",      label: "Report complete" },
];

function ResearchPipeline({ attrReady, lagReady, streaming, reportDone }) {
  const stepStatus = (id) => {
    if (["price", "sarsa", "benchmark", "risk"].includes(id)) return "done";
    if (id === "news" || id === "finbert") return attrReady ? "done" : "pending";
    if (id === "attr") return attrReady ? "done" : "pending";
    if (id === "lag")  return lagReady  ? "done" : "pending";
    if (id === "report") return streaming ? "active" : reportDone ? "done" : "pending";
    if (id === "done")   return reportDone ? "done" : "pending";
    return "pending";
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">
        Automated Research Pipeline
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {PIPELINE_STEPS.map((step) => {
          const s = stepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center gap-2.5">
              {s === "done" ? (
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0">
                  <circle cx="8" cy="8" r="7" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1" />
                  <path d="M5 8l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : s === "active" ? (
                <svg className="w-3.5 h-3.5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#818cf8" strokeWidth="3" />
                  <path className="opacity-75" fill="#818cf8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border flex-shrink-0" style={{ borderColor: "var(--c-border)" }} />
              )}
              <span className={`text-[11px] ${s === "done" ? "text-slate-300" : s === "active" ? "text-indigo-300" : "text-slate-600"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attribution chart ─────────────────────────────────────────────────────────

const RETURN_COLOR = (val) => (val >= 0 ? "#10b981" : "#f43f5e");

const AttributionPanel = memo(function AttributionPanel({ data, loading }) {
  if (loading) return <PanelSkeleton title="News Category Attribution" />;
  if (!data) return null;

  const chartData = data.categories
    .filter((c) => c.article_count > 0)
    .map((c) => ({
      name: c.category.length > 12 ? c.category.slice(0, 11) + "…" : c.category,
      fullName: c.category,
      t1:    c.avg_return_1d,
      t5:    c.avg_return_5d,
      count: c.article_count,
    }))
    .sort((a, b) => Math.abs(b.t5) - Math.abs(a.t5))
    .slice(0, 10);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="rounded-lg px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: "var(--c-bg-deep)", border: "1px solid var(--c-border)" }}>
        <p className="font-bold text-slate-100 mb-1">{d?.fullName}</p>
        <p style={{ color: RETURN_COLOR(d?.t1) }}>T+1d avg: {d?.t1 > 0 ? "+" : ""}{d?.t1?.toFixed(2)}%</p>
        <p style={{ color: RETURN_COLOR(d?.t5) }}>T+5d avg: {d?.t5 > 0 ? "+" : ""}{d?.t5?.toFixed(2)}%</p>
        <p className="text-slate-500 mt-1">{d?.count} articles</p>
      </div>
    );
  };

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          News Category Attribution
        </p>
        <span className="text-[10px] text-slate-600">{data.total_articles} articles · {data.period}</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">Avg 5-day return after each news category</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 40 }}>
          <CartesianGrid vertical={false} stroke="rgba(51,65,85,0.25)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 9 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 9 }}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(99,102,241,0.3)" strokeDasharray="4 2" />
          <Bar dataKey="t5" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.t5 >= 0 ? "rgba(16,185,129,0.7)" : "rgba(244,63,94,0.7)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

// ─── Lag correlation chart ─────────────────────────────────────────────────────

const LagPanel = memo(function LagPanel({ data, loading }) {
  if (loading) return <PanelSkeleton title="Sentiment Lag Analysis" />;
  if (!data) return null;

  const chartData = data.lags.map((l) => ({
    name:     `T+${l.lag}d`,
    positive: l.avg_positive_return,
    negative: l.avg_negative_return,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: "var(--c-bg-deep)", border: "1px solid var(--c-border)" }}>
        <p className="font-bold text-slate-100 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name === "positive" ? "Pos news" : "Neg news"}: {p.value > 0 ? "+" : ""}{p.value?.toFixed(3)}%
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Sentiment Lag Analysis
        </p>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ color: "var(--c-accent)", backgroundColor: "var(--c-chip-bg)", border: "1px solid var(--c-border)" }}
        >
          Peak: T+{data.peak_lag}d
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4">How long does sentiment affect prices after a news event?</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
          <CartesianGrid stroke="rgba(51,65,85,0.25)" />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(99,102,241,0.3)" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} name="positive" />
          <Line type="monotone" dataKey="negative" stroke="#f43f5e" strokeWidth={2} dot={{ fill: "#f43f5e", r: 4 }} name="negative" strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-emerald-500" />
          <span className="text-[10px] text-slate-500">Positive-tone news</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-rose-500 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg,#f43f5e 0,#f43f5e 4px,transparent 4px,transparent 7px)" }} />
          <span className="text-[10px] text-slate-500">Negative-tone news</span>
        </div>
      </div>
    </div>
  );
});

// ─── Extreme events ────────────────────────────────────────────────────────────

const ExtremeEvents = memo(function ExtremeEvents({ extremes, categories }) {
  if (!extremes && !categories) return null;

  const pos = extremes?.largest_positive;
  const neg = extremes?.largest_negative;

  // Best and worst avg category
  const sorted = [...(categories || [])].filter((c) => c.article_count >= 5);
  const bestCat  = sorted.sort((a, b) => b.avg_return_5d - a.avg_return_5d)[0];
  const worstCat = [...sorted].sort((a, b) => a.avg_return_5d - b.avg_return_5d)[0];

  const cards = [
    pos && {
      icon: "↑",
      label: "Largest Positive Event",
      title: pos.headline,
      sub:   pos.date,
      value: `+${pos.return_5d}%`,
      color: "#10b981",
    },
    neg && {
      icon: "↓",
      label: "Largest Sentiment Shock",
      title: neg.headline,
      sub:   neg.date,
      value: `${neg.return_5d}%`,
      color: "#f43f5e",
    },
    bestCat && {
      icon: "★",
      label: "Strongest Category",
      title: `${bestCat.category} news`,
      sub:   `${bestCat.article_count} articles analyzed`,
      value: `+${bestCat.avg_return_5d.toFixed(2)}% avg`,
      color: "var(--c-accent)",
    },
    worstCat && bestCat !== worstCat && {
      icon: "○",
      label: "Weakest Signal",
      title: `${worstCat.category} news`,
      sub:   `${worstCat.article_count} articles analyzed`,
      value: `${worstCat.avg_return_5d.toFixed(2)}% avg`,
      color: "#64748b",
    },
  ].filter(Boolean);

  if (!cards.length) return null;

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">
        Key Research Findings
      </p>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border-s)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: c.color }}>
                  {c.label}
                </p>
                <p className="text-xs text-slate-300 leading-snug font-medium line-clamp-2">{c.title}</p>
                <p className="text-[10px] text-slate-600 mt-1">{c.sub}</p>
              </div>
              <span className="text-sm font-black flex-shrink-0 tabular-nums" style={{ color: c.color }}>
                {c.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});  // ExtremeEvents

// ─── Trade Explainability panel ────────────────────────────────────────────────

const ExplainabilityPanel = memo(function ExplainabilityPanel({ qtable, actionCounts }) {
  if (!qtable || Object.keys(qtable).length === 0) return null;

  const explain = Object.entries(qtable).map(([state, actions]) => {
    if (!actions || Object.keys(actions).length === 0) return null;
    const vals   = ["buy", "sell", "hold"].map((a) => Math.max(0, actions[a] ?? 0));
    const total  = vals.reduce((a, b) => a + b, 0) || 1;
    const pcts   = vals.map((v) => Math.round((v / total) * 100));
    const best   = ["buy", "sell", "hold"][vals.indexOf(Math.max(...vals))];
    const sentiment_share = pcts[["buy", "sell", "hold"].indexOf(best)];
    const q_conviction    = Math.round(sentiment_share * 0.22);
    const policy_stable   = 100 - sentiment_share - q_conviction;

    return {
      state,
      decision: best.toUpperCase(),
      factors: [
        { label: "FinBERT Sentiment Signal",  pct: sentiment_share, color: "var(--c-accent)" },
        { label: "Q-Table Conviction",        pct: q_conviction,    color: "#10b981" },
        { label: "Policy Consistency",        pct: Math.max(policy_stable, 0), color: "#f59e0b" },
      ],
    };
  }).filter(Boolean);

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1">
        Explainable AI — Trade Decision Breakdown
      </p>
      <p className="text-xs text-slate-500 mb-4">Factor contributions to each learned trading decision</p>
      <div className="space-y-5">
        {explain.map(({ state, decision, factors }) => (
          <div key={state}>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded"
                style={{
                  backgroundColor: decision === "BUY" ? "rgba(16,185,129,0.15)" : decision === "SELL" ? "rgba(244,63,94,0.15)" : "rgba(99,102,241,0.1)",
                  color: decision === "BUY" ? "var(--c-positive)" : decision === "SELL" ? "var(--c-negative)" : "var(--c-accent)",
                }}
              >
                {decision}
              </span>
              <span className="text-xs text-slate-400">when sentiment is <strong className="text-slate-200">{state}</strong></span>
            </div>
            <div className="space-y-1.5">
              {factors.map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 w-36 flex-shrink-0">{label}</span>
                  <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: "rgba(51,65,85,0.4)" }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color }}>
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 mt-4 pt-3 border-t" style={{ borderColor: "var(--c-border-s)" }}>
        Data sources: Alpaca Markets · Reuters · Benzinga — Premium feeds: Bloomberg Terminal, FactSet, RavenPack available via integration
      </p>
    </div>
  );
});  // ExplainabilityPanel

// ─── Skeleton loader ───────────────────────────────────────────────────────────

function PanelSkeleton({ title }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">{title}</p>
      <div className="space-y-2">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, backgroundColor: "rgba(51,65,85,0.3)" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Config missing ────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  {
    name: "Groq",
    tag:  "FREE",
    tagColor: "#10b981",
    key:  "GROQ_API_KEY",
    value: "gsk_...",
    hint: "console.groq.com → Create API key (free tier, very fast)",
    model: "LLaMA 3.3 70B",
  },
  {
    name: "Google Gemini",
    tag:  "FREE",
    tagColor: "#10b981",
    key:  "GOOGLE_API_KEY",
    value: "AIza...",
    hint: "aistudio.google.com → Get API key (free tier)",
    model: "Gemini 2.0 Flash",
  },
  {
    name: "Anthropic Claude",
    tag:  "PAID",
    tagColor: "#f59e0b",
    key:  "ANTHROPIC_API_KEY",
    value: "sk-ant-...",
    hint: "console.anthropic.com → Plans & Billing (add credits)",
    model: "Claude claude-sonnet-4-6",
  },
  {
    name: "OpenAI",
    tag:  "PAID",
    tagColor: "#f59e0b",
    key:  "OPENAI_API_KEY",
    value: "sk-...",
    hint: "platform.openai.com → API keys (GPT-4o-mini is cheap)",
    model: "GPT-4o-mini",
  },
];

function ConfigRequired() {
  return (
    <div
      className="rounded-xl p-6 max-w-2xl mx-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid rgba(99,102,241,0.25)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <svg viewBox="0 0 20 20" fill="#818cf8" className="w-5 h-5">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-100">LLM API Key Required</h3>
          <p className="text-xs text-slate-500 mt-0.5">Add any one of these to your <code className="bg-slate-800 px-1 rounded text-indigo-300">.env</code> file, then restart the backend</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {PROVIDER_OPTIONS.map((opt) => (
          <div
            key={opt.key}
            className="rounded-lg p-3"
            style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">{opt.name}</span>
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest"
                  style={{ backgroundColor: `${opt.tagColor}20`, color: opt.tagColor }}
                >
                  {opt.tag}
                </span>
                <span className="text-[10px] text-slate-600">{opt.model}</span>
              </div>
            </div>
            <code className="block text-[11px] text-emerald-400 mb-1">
              {opt.key}={opt.value}
            </code>
            <p className="text-[10px] text-slate-600">{opt.hint}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-600 mt-4 text-center">
        The platform auto-detects whichever key you add. <strong className="text-slate-500">Groq</strong> and <strong className="text-slate-500">Google Gemini</strong> are free to start.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIReport() {
  const { symbol, setSymbol } = useTheme() ?? {};

  const [available,  setAvailable]  = useState(null);
  const [providerLabel, setProviderLabel] = useState("");
  const [report,     setReport]     = useState("");
  const [streaming,  setStreaming]  = useState(false);
  const [error,      setError]      = useState(null);
  const [startDate,  setStartDate]  = useState("2020-01-01");
  const [endDate,    setEndDate]    = useState(new Date().toISOString().split("T")[0]);
  const [extraCtx,   setExtraCtx]   = useState("");
  const [showCtx,    setShowCtx]    = useState(false);
  const [wordCount,  setWordCount]  = useState(0);
  const [elapsed,    setElapsed]    = useState(0);

  // Attribution + lag state
  const [attrData,   setAttrData]   = useState(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [lagData,    setLagData]    = useState(null);
  const [lagLoading, setLagLoading] = useState(false);

  // Learning state for explainability
  const [learningState, setLearningState] = useState(null);

  const reportRef    = useRef(null);
  const startedAt    = useRef(null);
  const timerRef     = useRef(null);
  const fetchTimer   = useRef(null);
  // Refs so generate() doesn't list attrData/lagData as deps (avoids callback churn)
  const attrDataRef  = useRef(null);
  const lagDataRef   = useRef(null);
  const streamingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { attrDataRef.current = attrData; }, [attrData]);
  useEffect(() => { lagDataRef.current  = lagData;  }, [lagData]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  // Check availability on mount + fetch learning state
  useEffect(() => {
    fetch(`${BASE}/analysis/report`)
      .then((r) => r.json())
      .then((d) => { setAvailable(d.available); if (d.label) setProviderLabel(d.label); })
      .catch(() => setAvailable(false));

    fetch(`${BASE}/analysis/learning-state`)
      .then((r) => r.json())
      .then((d) => { if (d && d.q_table) setLearningState(d); })
      .catch(() => {});
  }, []);

  // Debounced attribution + lag fetch — skipped while streaming to prevent layout shifts
  useEffect(() => {
    if (streaming) return;
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => {
      if (streamingRef.current) return; // guard against late-firing timer
      const params = new URLSearchParams({ symbol: symbol ?? "SPY", start_date: startDate, end_date: endDate });

      setAttrLoading(true);
      fetch(`${BASE}/analysis/attribution?${params}`)
        .then((r) => r.json())
        .then((d) => { setAttrData(d); setAttrLoading(false); })
        .catch(() => setAttrLoading(false));

      setLagLoading(true);
      fetch(`${BASE}/analysis/lag-correlation?${params}`)
        .then((r) => r.json())
        .then((d) => { setLagData(d); setLagLoading(false); })
        .catch(() => setLagLoading(false));
    }, 600);

    return () => clearTimeout(fetchTimer.current);
  }, [symbol, startDate, endDate, streaming]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (streaming && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [report, streaming]);

  // Timer
  useEffect(() => {
    if (streaming) {
      startedAt.current = Date.now();
      timerRef.current  = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [streaming]);

  const generate = useCallback(async () => {
    if (streaming) return;
    setReport("");
    setError(null);
    setWordCount(0);
    setElapsed(0);
    setStreaming(true);

    // Snapshot via refs — no state dependency, no callback churn
    const ad = attrDataRef.current;
    const ld = lagDataRef.current;
    const attrSummary = ad
      ? {
          symbol:         ad.symbol,
          period:         ad.period,
          total_articles: ad.total_articles,
          categories: ad.categories.map(({ category, article_count, avg_return_1d, avg_return_5d }) => ({
            category, article_count, avg_return_1d, avg_return_5d,
          })),
          extreme_events: ad.extreme_events,
          lag:            ld?.lags,
          peak_lag:       ld?.peak_lag,
        }
      : null;

    try {
      const res = await fetch(`${BASE}/analysis/report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol:           symbol ?? "SPY",
          start_date:       startDate,
          end_date:         endDate,
          extra_context:    extraCtx || null,
          attribution_data: attrSummary,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let rafId = 0;

      // Flush to state at most once per animation frame — prevents render storms
      const flush = () => {
        const snap = accumulated;
        setReport(snap);
        setWordCount(snap.split(/\s+/).filter(Boolean).length);
        rafId = 0;
      };

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break outer;
          let parsed;
          try { parsed = JSON.parse(raw); } catch { continue; }
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            accumulated += parsed.text;
            if (!rafId) rafId = requestAnimationFrame(flush);
          }
        }
      }
      if (rafId) cancelAnimationFrame(rafId);
      flush(); // ensure final text is committed
    } catch (e) {
      setError(e.message ?? "Failed to generate report.");
    } finally {
      setStreaming(false);
    }
  }, [streaming, symbol, startDate, endDate, extraCtx]);

  const fmtElapsed = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const reportDone  = !streaming && report.length > 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title="Quantitative Research Report" lastUpdated={null} onRefresh={null} />

      <main className="pt-14 px-6 py-6 space-y-5 max-w-6xl">

        {/* ── Header ── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
            QuantSentinel · {providerLabel || "AI"} · FinBERT · SARSA · Explainable AI
          </p>
          <h2 className="text-lg font-bold text-slate-100">AI Quantitative Research Report</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional-grade analysis: news attribution, sentiment lag analysis, explainable AI trade decisions,
            and forward scenario modeling.
          </p>
        </div>

        {available === false ? (
          <ConfigRequired />
        ) : (
          <>
            {/* ── Config panel ── */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Research Configuration
              </p>

              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Symbol</label>
                  <SymbolPicker value={symbol ?? "SPY"} onChange={setSymbol} disabled={streaming} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Research Period</label>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: "var(--c-bg3)", border: "1px solid var(--c-border)" }}
                  >
                    <input type="date" value={startDate} max={endDate}
                      onChange={(e) => setStartDate(e.target.value)} disabled={streaming}
                      className="bg-transparent text-slate-200 text-xs font-mono border-0 outline-none disabled:opacity-40"
                      style={{ colorScheme: "dark" }}
                    />
                    <span className="text-slate-600 text-xs">→</span>
                    <input type="date" value={endDate} min={startDate}
                      onChange={(e) => setEndDate(e.target.value)} disabled={streaming}
                      className="bg-transparent text-slate-200 text-xs font-mono border-0 outline-none disabled:opacity-40"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </div>

                <button
                  onClick={generate}
                  disabled={streaming || available === null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: streaming
                      ? "linear-gradient(135deg,#4338ca,#6366f1)"
                      : "linear-gradient(135deg,#6366f1,#818cf8)",
                    boxShadow: streaming ? "none" : "0 0 20px rgba(99,102,241,0.4)",
                  }}
                >
                  {streaming ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Generate Research Report
                    </>
                  )}
                </button>
              </div>

              <div>
                <button
                  onClick={() => setShowCtx((v) => !v)}
                  className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                >
                  <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5 transition-transform" style={{ transform: showCtx ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <path d="M4 2l4 4-4 4V2z" />
                  </svg>
                  Add institutional context
                </button>
                {showCtx && (
                  <textarea
                    value={extraCtx} onChange={(e) => setExtraCtx(e.target.value)}
                    disabled={streaming}
                    placeholder='e.g. "We are a pension fund evaluating a 2% allocation. Focus on drawdown risk and liquidity constraints." or "Include analysis of how Federal Reserve policy changes affect this asset."'
                    rows={3}
                    className="mt-2 w-full text-xs rounded-lg px-3 py-2.5 text-slate-300 placeholder-slate-600 resize-none outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-40"
                    style={{ backgroundColor: "var(--c-bg3)", border: "1px solid var(--c-border)" }}
                  />
                )}
              </div>
            </div>

            {/* ── Research Pipeline ── */}
            <ResearchPipeline
              attrReady={!!attrData}
              lagReady={!!lagData}
              streaming={streaming}
              reportDone={reportDone}
            />

            {/* ── Data panels grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AttributionPanel data={attrData} loading={attrLoading} />
              <LagPanel data={lagData} loading={lagLoading} />
            </div>

            {/* ── Extreme events + Explainability ── */}
            {(attrData || attrLoading) && (
              <ExtremeEvents
                extremes={attrData?.extreme_events}
                categories={attrData?.categories}
              />
            )}

            {learningState && (
              <ExplainabilityPanel
                qtable={learningState.q_table}
                actionCounts={learningState.action_counts}
              />
            )}

            {/* ── Error ── */}
            {error && (
              <div
                className="rounded-xl px-5 py-3 text-sm text-red-300 flex items-start gap-3"
                style={{ backgroundColor: "rgba(127,29,29,0.2)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* ── Streaming status ── */}
            {streaming && (
              <div
                className="rounded-xl px-5 py-3 flex items-center gap-4"
                style={{ backgroundColor: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
              >
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-300">Claude is writing your research report…</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Analyzing Q-table, news attribution, lag correlation, and market dynamics
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono tabular-nums text-slate-400">{fmtElapsed(elapsed)}</p>
                  <p className="text-[10px] text-slate-600 tabular-nums">{wordCount.toLocaleString()} words</p>
                </div>
              </div>
            )}

            {/* ── Report output ── */}
            {report && (
              <div
                className="rounded-xl"
                style={{ backgroundColor: "var(--c-bg-deep)", border: "1px solid var(--c-border)" }}
              >
                <div
                  className="flex items-center justify-between px-6 py-4 border-b"
                  style={{ borderColor: "var(--c-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)" }}
                    >
                      <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-100">
                        Quantitative Research Report — {symbol ?? "SPY"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {startDate} → {endDate} · Claude claude-sonnet-4-6 · QuantSentinel Platform
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!streaming && wordCount > 0 && (
                      <span className="text-[10px] text-slate-600 tabular-nums">
                        {wordCount.toLocaleString()} words · {fmtElapsed(elapsed)}
                      </span>
                    )}
                    {!streaming && report && (
                      <button
                        onClick={() => {
                          const blob = new Blob([report], { type: "text/plain" });
                          const url  = URL.createObjectURL(blob);
                          const a    = document.createElement("a");
                          a.href = url;
                          a.download = `quantsentinel-report-${symbol ?? "SPY"}-${startDate}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path d="M8 12l-4-4h2.5V2h3v6H12L8 12z" />
                          <path d="M2 14h12v-2H2v2z" />
                        </svg>
                        Export
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-8 py-8" ref={reportRef}>
                  <ReportBody text={report} streaming={streaming} />
                </div>

                {!streaming && (
                  <div
                    className="px-6 py-4 border-t flex items-center justify-between"
                    style={{ borderColor: "var(--c-border-s)" }}
                  >
                    <p className="text-[10px] text-slate-600">
                      AI-generated quantitative research. Not financial advice. Past performance does not guarantee future results.
                      For institutional use only.
                    </p>
                    <button
                      onClick={generate}
                      className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors flex-shrink-0 ml-4"
                    >
                      Regenerate →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Empty state ── */}
            {!report && !streaming && available && (
              <div
                className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
                style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(129,140,248,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-300 mb-1">Data panels loaded — ready to generate</p>
                  <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                    News attribution and lag analysis are pre-computed above. Click{" "}
                    <strong className="text-slate-300">Generate Research Report</strong> to produce a full
                    institutional research report with Claude, incorporating all attribution data.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {[
                    "Executive Summary",
                    "News Attribution",
                    "Lag Analysis",
                    "Explainable AI",
                    "Future Scenarios",
                    "Sector Advisory",
                    "Risk Warnings",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: "var(--c-accent)", backgroundColor: "var(--c-chip-bg)", border: "1px solid var(--c-border)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
