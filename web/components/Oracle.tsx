"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  Identity,
  Score,
  connectWallet,
  linkSocials,
  readMyIdentity,
  readMyScore,
  readScore,
  readTotalScored,
  requestScore,
  waitForReceipt,
} from "../lib/contract";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "error"; msg: string }
  | { kind: "ok"; msg: string };

export default function Oracle() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [myScore, setMyScore] = useState<Score | null>(null);
  const [totalScored, setTotalScored] = useState<number | null>(null);

  const [githubInput, setGithubInput] = useState("");
  const [twitterInput, setTwitterInput] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<Score | null>(null);

  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleConnect = async () => {
    try {
      setStatus({ kind: "busy", msg: "Connecting wallet…" });
      const addr = await connectWallet();
      setAccount(addr);
      setStatus({ kind: "ok", msg: `Connected: ${short(addr)}` });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  useEffect(() => {
    if (!account) return;
    (async () => {
      try {
        const [id, total] = await Promise.all([
          readMyIdentity(account),
          readTotalScored(account).catch(() => 0),
        ]);
        setIdentity(id);
        setTotalScored(total);
        if (id.github_handle) setGithubInput(id.github_handle);
        if (id.twitter_handle) setTwitterInput(id.twitter_handle);
        if (id.linked) {
          const s = await readMyScore(account).catch(() => null);
          if (s) setMyScore(s);
        }
      } catch (e) {
        setStatus({ kind: "error", msg: msg(e) });
      }
    })();
  }, [account]);

  const canScore =
    identity?.linked || githubInput.trim().length > 0 || twitterInput.trim().length > 0;

  const handleScore = async () => {
    if (!account) return;
    const gh = githubInput.trim().replace(/^@/, "");
    const tw = twitterInput.trim().replace(/^@/, "");
    if (!gh && !tw) {
      setStatus({ kind: "error", msg: "Provide at least one social handle (GitHub or Twitter)." });
      return;
    }
    try {
      const needsLink =
        !identity?.linked ||
        identity.github_handle !== gh ||
        identity.twitter_handle !== tw;

      if (needsLink) {
        setStatus({ kind: "busy", msg: "Linking socials to your wallet…" });
        const linkHash = await linkSocials(account, gh, tw);
        await waitForReceipt(account, linkHash);
      }

      setStatus({
        kind: "busy",
        msg: "Computing reputation (LLM + web fetch + validator consensus, 30s–2min)…",
      });
      const hash = await requestScore(account);
      await waitForReceipt(account, hash);

      const [s, id, total] = await Promise.all([
        readMyScore(account),
        readMyIdentity(account),
        readTotalScored(account).catch(() => totalScored ?? 0),
      ]);
      setMyScore(s);
      setIdentity(id);
      setTotalScored(total);
      setStatus({ kind: "ok", msg: "Score computed." });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  const handleSearch = async () => {
    if (!account || !searchInput.trim()) return;
    try {
      setStatus({ kind: "busy", msg: "Searching…" });
      const s = await readScore(account, searchInput.trim());
      setSearchResult(s);
      setStatus({ kind: "ok", msg: s.exists ? "Found." : "No score on record." });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BgGrid />

      <div className="relative mx-auto max-w-3xl px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Live on GenLayer Bradbury Testnet
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            Reputation Oracle
          </h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl">
            Trustless on chain dev reputation. Combine your wallet with any of GitHub or X  validators
            running diverse LLMs reach consensus on a 0–100 score.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <a
              className="font-mono hover:text-zinc-300 transition"
              target="_blank"
              rel="noreferrer"
              href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`}
            >
              Contract: {short(CONTRACT_ADDRESS)}
            </a>
            {totalScored !== null && (
              <span className="text-zinc-600">·</span>
            )}
            {totalScored !== null && (
              <span className="text-zinc-400">
                <span className="font-semibold text-zinc-200">{totalScored.toLocaleString()}</span> scores computed
              </span>
            )}
          </div>
        </header>

        {!account ? (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Connect MetaMask to begin</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  GenLayer requires the MetaMask Snap to sign transactions, so other wallets
                  (Rabby, Coinbase, Trust, OKX, Phantom, Brave) are not supported.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="shrink-0 rounded-md bg-orange-500 hover:bg-orange-400 px-5 py-2.5 text-sm font-semibold text-black transition"
              >
                Connect MetaMask
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Wallet</div>
                <div className="font-mono text-zinc-200 mt-0.5">{account}</div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>Status</div>
                <div className="text-emerald-400 font-medium">Connected</div>
              </div>
            </div>
          </Card>
        )}

        {account && (
          <Card title="Your reputation">
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="GitHub handle"
                  prefix="github.com/"
                  placeholder="rivaleuc"
                  value={githubInput}
                  onChange={setGithubInput}
                />
                <Field
                  label="X / Twitter handle"
                  prefix="@"
                  placeholder="vitalikbuterin"
                  value={twitterInput}
                  onChange={setTwitterInput}
                />
              </div>
              <p className="text-xs text-zinc-500 -mt-2">
                At least one handle is required. Both is best. Wallet is always part of your identity.
              </p>
              <button
                onClick={handleScore}
                disabled={!canScore || status.kind === "busy"}
                className="w-full rounded-md bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-500 px-5 py-3 text-sm font-semibold text-black transition"
              >
                {myScore?.exists ? "Recompute my score" : "Compute my score"}
              </button>

              {myScore?.exists && <ScoreCard s={myScore} />}
            </div>
          </Card>
        )}

        {account && (
          <Card title="Look up any wallet">
            <div className="space-y-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="0x… wallet address"
                className="w-full rounded-md bg-zinc-900/60 border border-zinc-800 focus:border-orange-500 px-3 py-2.5 text-sm font-mono outline-none transition"
              />
              <button
                onClick={handleSearch}
                disabled={!searchInput.trim() || status.kind === "busy"}
                className="rounded-md border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-200 transition"
              >
                Search
              </button>
              {searchResult &&
                (searchResult.exists ? (
                  <ScoreCard s={searchResult} />
                ) : (
                  <div className="text-sm text-zinc-500 py-2">No score on record. Owner must compute it first.</div>
                ))}
            </div>
          </Card>
        )}

        <footer className="pt-8 border-t border-zinc-900 text-xs text-zinc-600 flex flex-wrap items-center justify-between gap-2">
          <div>
            Built on{" "}
            <a className="hover:text-zinc-400" href="https://genlayer.com">GenLayer</a>
            {" · "}
            <a className="hover:text-zinc-400" href="https://github.com/rivaleuc/Reputation-Oracle">Source</a>
          </div>
          <div className="font-mono">
            <a
              className="hover:text-zinc-400"
              target="_blank"
              rel="noreferrer"
              href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`}
            >
              {short(CONTRACT_ADDRESS)}
            </a>
          </div>
        </footer>
      </div>

      {status.kind !== "idle" && (
        <div
          className={[
            "fixed bottom-4 right-4 max-w-sm rounded-md border px-4 py-3 text-sm shadow-2xl backdrop-blur",
            status.kind === "busy" && "bg-zinc-900/90 border-zinc-700 text-zinc-200",
            status.kind === "error" && "bg-red-950/90 border-red-800 text-red-200",
            status.kind === "ok" && "bg-emerald-950/90 border-emerald-800 text-emerald-200",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-start gap-2">
            {status.kind === "busy" && (
              <svg className="h-4 w-4 animate-spin mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <div>{status.msg}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur p-6 space-y-4 shadow-xl shadow-black/40">
      {title && (
        <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-500 font-medium">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  prefix,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-500 mb-1.5 font-medium">{label}</div>
      <div className="flex rounded-md bg-zinc-900/60 border border-zinc-800 focus-within:border-orange-500 transition overflow-hidden">
        <span className="px-3 py-2.5 text-zinc-500 text-sm border-r border-zinc-800 select-none">
          {prefix}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}

function ScoreCard({ s }: { s: Score }) {
  const v = s.value ?? 0;
  const tone =
    v >= 75 ? "text-emerald-400 from-emerald-400/20" :
    v >= 50 ? "text-amber-400 from-amber-400/20" :
    "text-orange-400 from-orange-400/20";
  const sources = (s.sources_used ?? "").split(",").filter(Boolean);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-3">
      <div className={`absolute -top-20 -right-10 h-40 w-40 rounded-full blur-3xl bg-gradient-to-br ${tone}`} />
      <div className="relative flex items-end gap-3">
        <ScoreRing value={v} />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Reputation</div>
          <div className={`text-6xl font-bold tabular-nums leading-none ${tone.split(" ")[0]}`}>
            {v}
          </div>
          <div className="text-xs text-zinc-500 mt-1">/ 100</div>
        </div>
      </div>
      {sources.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {sources.map((src) => (
            <span
              key={src}
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400"
            >
              {src.replace("_", " ")}
            </span>
          ))}
        </div>
      )}
      {s.reasoning && (
        <p className="relative text-sm text-zinc-300 leading-relaxed">{s.reasoning}</p>
      )}
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const stroke =
    value >= 75 ? "#34d399" : value >= 50 ? "#fbbf24" : "#fb923c";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} stroke="#27272a" strokeWidth="6" fill="none" />
      <circle
        cx="36"
        cy="36"
        r={r}
        stroke={stroke}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
      />
    </svg>
  );
}

function BgGrid() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.12),transparent_50%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </>
  );
}

function short(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function msg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.shortMessage === "string") return obj.shortMessage;
    if (typeof obj.reason === "string") return obj.reason;
    try {
      return JSON.stringify(e, null, 2);
    } catch {
      return "Unknown error";
    }
  }
  return String(e);
}
