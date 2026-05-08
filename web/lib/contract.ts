"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0x524A2e302F2264939B3C56Ec50d12B29c60984F5" as const;

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation/";
export const EXPLORER_URL = "https://explorer-bradbury.genlayer.com";

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
  providers?: InjectedProvider[];
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

const BRADBURY_CHAIN_ID_HEX = `0x${(4221).toString(16)}`;

function pickProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const eth = window.ethereum;
  if (!eth) return null;
  // If multiple wallets are stacked, prefer MetaMask if present, otherwise
  // just take the first injected provider. Bradbury accepts standard EVM
  // signing, so any injected wallet works.
  if (Array.isArray(eth.providers) && eth.providers.length) {
    const mm = eth.providers.find((p) => p.isMetaMask);
    if (mm) return mm;
    return eth.providers[0];
  }
  return eth;
}

const NO_WALLET_MSG =
  "No EVM wallet detected. Install MetaMask, Rabby, Coinbase Wallet, Brave Wallet, or any injected wallet to continue.";

async function ensureBradburyChain(provider: InjectedProvider) {
  const current = await provider.request({ method: "eth_chainId" });
  if (current === BRADBURY_CHAIN_ID_HEX) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRADBURY_CHAIN_ID_HEX,
            chainName: "GenLayer Bradbury Testnet",
            rpcUrls: ["https://rpc-bradbury.genlayer.com"],
            nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: ["https://explorer-bradbury.genlayer.com/"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = pickProvider();
  if (!provider) throw new Error(NO_WALLET_MSG);
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned");
  await ensureBradburyChain(provider);
  return accounts[0] as `0x${string}`;
}

function makeClient(account: `0x${string}`) {
  const provider = pickProvider();
  if (!provider) throw new Error(NO_WALLET_MSG);
  // Pass MetaMask as the provider — genlayer-js will use it for signing
  // without invoking client.connect() (which would otherwise try to install
  // the GenLayer Snap).
  return createClient({
    chain: testnetBradbury,
    account,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: provider as any,
  });
}

// ---------- Read methods ----------
export async function readMyScore(account: `0x${string}`): Promise<Score> {
  return (await makeClient(account).readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_my_score",
    args: [],
  })) as Score;
}

export async function readScore(
  account: `0x${string}`,
  walletHex: string,
): Promise<Score> {
  return (await makeClient(account).readContract({
    address: CONTRACT_ADDRESS,
    functionName: "read_score",
    args: [walletHex.toLowerCase()],
  })) as Score;
}

export async function readMyIdentity(account: `0x${string}`): Promise<Identity> {
  return (await makeClient(account).readContract({
    address: CONTRACT_ADDRESS,
    functionName: "my_identity",
    args: [],
  })) as Identity;
}

export async function readTotalScored(account: `0x${string}`): Promise<number> {
  const n = (await makeClient(account).readContract({
    address: CONTRACT_ADDRESS,
    functionName: "total_scored",
    args: [],
  })) as number | bigint;
  return Number(n);
}

// ---------- Write methods ----------
export async function linkSocials(
  account: `0x${string}`,
  githubHandle: string,
  twitterHandle: string,
): Promise<string> {
  const hash = (await makeClient(account).writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "link_socials",
    args: [githubHandle, twitterHandle],
    value: BigInt(0),
  })) as string;
  return hash;
}

export async function requestScore(account: `0x${string}`): Promise<string> {
  const hash = (await makeClient(account).writeContract({
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
  return await makeClient(account).waitForTransactionReceipt({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hash: hash as any,
    interval: opts.interval ?? 3000,
    retries: opts.retries ?? 80,
  });
}
