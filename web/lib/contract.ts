"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0x524A2e302F2264939B3C56Ec50d12B29c60984F5" as const;

export type Score = {
  exists: boolean;
  value?: number;
  sources_used?: string;
  reasoning?: string;
};

export type Identity = {
  linked: boolean;
  github_handle?: string;
  twitter_handle?: string;
};

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isFrame?: boolean;
  isTokenPocket?: boolean;
  isExodus?: boolean;
  providers?: InjectedProvider[];
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

function isOnlyMetaMask(p: InjectedProvider): boolean {
  if (!p.isMetaMask) return false;
  // Other wallets often impersonate MetaMask by setting isMetaMask=true.
  // Reject if any other wallet flag is also set.
  return !(
    p.isCoinbaseWallet ||
    p.isBraveWallet ||
    p.isRabby ||
    p.isPhantom ||
    p.isOkxWallet ||
    p.isTrust ||
    p.isTrustWallet ||
    p.isFrame ||
    p.isTokenPocket ||
    p.isExodus
  );
}

function pickMetaMaskProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const eth = window.ethereum;
  if (!eth) return null;
  // Some setups stack providers: try each.
  if (Array.isArray(eth.providers)) {
    const mm = eth.providers.find(isOnlyMetaMask);
    if (mm) return mm;
  }
  if (isOnlyMetaMask(eth)) return eth;
  return null;
}

const NOT_METAMASK_MSG =
  "This dApp requires MetaMask. GenLayer needs the MetaMask Snap to sign transactions, which is not supported by other wallets (Rabby, Coinbase, Trust, OKX, Phantom, Brave, etc.). Install MetaMask from https://metamask.io to continue.";

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = pickMetaMaskProvider();
  if (!provider) throw new Error(NOT_METAMASK_MSG);
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned");
  return accounts[0] as `0x${string}`;
}

export function makeClient(account: `0x${string}`) {
  return createClient({ chain: testnetBradbury, account });
}

export async function readMyScore(account: `0x${string}`): Promise<Score> {
  const client = makeClient(account);
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_my_score",
    args: [],
  })) as Score;
}

export async function readScore(
  account: `0x${string}`,
  walletHex: string,
): Promise<Score> {
  const client = makeClient(account);
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_score",
    args: [walletHex.toLowerCase()],
  })) as Score;
}

export async function readMyIdentity(account: `0x${string}`): Promise<Identity> {
  const client = makeClient(account);
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "my_identity",
    args: [],
  })) as Identity;
}

export async function readTotalScored(account: `0x${string}`): Promise<number> {
  const client = makeClient(account);
  const n = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "total_scored",
    args: [],
  })) as number | bigint;
  return Number(n);
}

export async function linkSocials(
  account: `0x${string}`,
  githubHandle: string,
  twitterHandle: string,
): Promise<string> {
  const client = makeClient(account);
  await client.connect("testnetBradbury");
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "link_socials",
    args: [githubHandle, twitterHandle],
    value: BigInt(0),
  })) as string;
  return hash;
}

export async function requestScore(account: `0x${string}`): Promise<string> {
  const client = makeClient(account);
  await client.connect("testnetBradbury");
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "request_score",
    args: [],
    value: BigInt(0),
  })) as string;
  return hash;
}

export async function waitForReceipt(
  account: `0x${string}`,
  hash: string,
  opts: { interval?: number; retries?: number } = {},
) {
  const client = makeClient(account);
  return await client.waitForTransactionReceipt({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hash: hash as any,
    interval: opts.interval ?? 3000,
    retries: opts.retries ?? 80, // ~4 minutes — LLM + multi-validator consensus is slow
  });
}
