"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0xf47536dB6b715C0F002C48680449029fCc5067b5" as const;

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

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not detected. Install MetaMask to continue.");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned");
  return accounts[0] as `0x${string}`;
}

export function makeClient(account: `0x${string}`) {
  return createClient({ chain: studionet, account });
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
  await client.connect("studionet");
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
  await client.connect("studionet");
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
