"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  Score,
  connectWallet,
  linkIdentity,
  readMyIdentity,
  readMyScore,
  readScore,
  requestScore,
  waitForReceipt,
} from "../lib/contract";

type Status = { kind: "idle" } | { kind: "busy"; msg: string } | { kind: "error"; msg: string } | { kind: "ok"; msg: string };

export default function Oracle() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [identity, setIdentity] = useState<{ linked: boolean; github_handle?: string } | null>(null);
  const [myScore, setMyScore] = useState<Score | null>(null);
  const [handleInput, setHandleInput] = useState("");
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
        const id = await readMyIdentity(account);
        setIdentity(id);
        if (id.linked) {
          const s = await readMyScore(account);
          setMyScore(s);
        }
      } catch (e) {
        setStatus({ kind: "error", msg: msg(e) });
      }
    })();
  }, [account]);

  const handleLink = async () => {
    if (!account || !handleInput.trim()) return;
    try {
      setStatus({ kind: "busy", msg: "Linking identity…" });
      const hash = await linkIdentity(account, handleInput.trim());
      await waitForReceipt(account, hash);
      const id = await readMyIdentity(account);
      setIdentity(id);
      setHandleInput("");
      setStatus({ kind: "ok", msg: "Identity linked." });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  const handleRequestScore = async () => {
    if (!account) return;
    try {
      setStatus({ kind: "busy", msg: "Computing score (LLM + GitHub fetch + validator consensus, can take 30s–2min)…" });
      const hash = await requestScore(account);
      await waitForReceipt(account, hash);
      const s = await readMyScore(account);
      setMyScore(s);
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
      setStatus({ kind: "ok", msg: "Lookup complete." });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Reputation Oracle</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Trustless on-chain dev reputation. Validators running diverse LLMs evaluate your GitHub
          activity and reach consensus on a 0–100 score. Built on{" "}
          <a className="underline hover:text-zinc-200" href="https://genlayer.com">GenLayer</a>.
        </p>
        <p className="text-xs text-zinc-500 font-mono">
          Contract: <a className="hover:text-zinc-300" target="_blank" rel="noreferrer"
            href={`https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`}>{CONTRACT_ADDRESS}</a>
        </p>
      </header>

      <Card>
        {!account ? (
          <button onClick={handleConnect}
            className="rounded-md bg-orange-500 hover:bg-orange-400 px-4 py-2 text-sm font-medium text-black transition">
            Connect MetaMask
          </button>
        ) : (
          <div className="text-sm">
            <div className="text-zinc-500">Connected wallet</div>
            <div className="font-mono text-zinc-200">{account}</div>
          </div>
        )}
      </Card>

      {account && (
        <>
          <Card title="Step 1 · Link your GitHub">
            {identity?.linked ? (
              <div className="text-sm">
                <div className="text-zinc-500">Linked GitHub</div>
                <div className="text-zinc-100 font-mono">@{identity.github_handle}</div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="github_handle (e.g. torvalds)"
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
                <button onClick={handleLink} disabled={!handleInput.trim() || status.kind === "busy"}
                  className="rounded-md bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-400 px-4 py-2 text-sm font-medium text-black transition">
                  Link identity
                </button>
              </div>
            )}
          </Card>

          {identity?.linked && (
            <Card title="Step 2 · Compute your score">
              <div className="space-y-4">
                <button onClick={handleRequestScore} disabled={status.kind === "busy"}
                  className="rounded-md bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-400 px-4 py-2 text-sm font-medium text-black transition">
                  {myScore?.exists ? "Recompute score" : "Compute my score"}
                </button>
                {myScore?.exists && <ScoreCard s={myScore} />}
              </div>
            </Card>
          )}

          <Card title="Look up any wallet">
            <div className="space-y-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="0x… wallet address"
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-500"
              />
              <button onClick={handleSearch} disabled={!searchInput.trim() || status.kind === "busy"}
                className="rounded-md border border-zinc-700 hover:border-zinc-500 px-4 py-2 text-sm font-medium text-zinc-200 transition">
                Search
              </button>
              {searchResult && (
                searchResult.exists ? <ScoreCard s={searchResult} /> :
                <div className="text-sm text-zinc-500">No score on record for this wallet.</div>
              )}
            </div>
          </Card>
        </>
      )}

      {status.kind !== "idle" && (
        <div className={[
          "fixed bottom-4 right-4 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg",
          status.kind === "busy" && "bg-zinc-900 border-zinc-700 text-zinc-200",
          status.kind === "error" && "bg-red-950 border-red-800 text-red-200",
          status.kind === "ok" && "bg-emerald-950 border-emerald-800 text-emerald-200",
        ].filter(Boolean).join(" ")}>
          {status.msg}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 space-y-4">
      {title && <h2 className="text-sm uppercase tracking-wider text-zinc-500">{title}</h2>}
      {children}
    </section>
  );
}

function ScoreCard({ s }: { s: Score }) {
  const v = s.value ?? 0;
  const tone = v >= 75 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-orange-400";
  return (
    <div className="rounded-lg bg-zinc-900/70 border border-zinc-800 p-5 space-y-2">
      <div className="flex items-baseline gap-3">
        <div className={`text-5xl font-bold tabular-nums ${tone}`}>{v}</div>
        <div className="text-zinc-500 text-sm">/ 100</div>
        {s.github_handle && (
          <div className="ml-auto text-xs text-zinc-500 font-mono">@{s.github_handle}</div>
        )}
      </div>
      {s.reasoning && (
        <p className="text-sm text-zinc-300 leading-relaxed">{s.reasoning}</p>
      )}
    </div>
  );
}

function short(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function msg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
