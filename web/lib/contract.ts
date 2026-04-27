"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0x84d17ce5Db73728a372e4f70f3c9DD641fE135f0" as const;

export type Score = {
  exists: boolean;
  value?: number;
  github_handle?: string;
  reasoning?: string;
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
  const res = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_my_score",
    args: [],
  })) as Score;
  return res;
}

export async function readScore(
  account: `0x${string}`,
  walletHex: string,
): Promise<Score> {
  const client = makeClient(account);
  const res = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_score",
    args: [walletHex.toLowerCase()],
  })) as Score;
  return res;
}

export async function readMyIdentity(
  account: `0x${string}`,
): Promise<{ linked: boolean; github_handle?: string }> {
  const client = makeClient(account);
  const res = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "my_identity",
    args: [],
  })) as { linked: boolean; github_handle?: string };
  return res;
}

export async function linkIdentity(
  account: `0x${string}`,
  githubHandle: string,
): Promise<`0x${string}`> {
  const client = makeClient(account);
  await client.connect("studionet");
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "link_identity",
    args: [githubHandle],
    value: BigInt(0),
  })) as `0x${string}`;
  return hash;
}

export async function requestScore(
  account: `0x${string}`,
): Promise<`0x${string}`> {
  const client = makeClient(account);
  await client.connect("studionet");
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "request_score",
    args: [],
    value: BigInt(0),
  })) as `0x${string}`;
  return hash;
}

export async function waitForReceipt(
  account: `0x${string}`,
  hash: string,
) {
  const client = makeClient(account);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await client.waitForTransactionReceipt({ hash } as any);
}
