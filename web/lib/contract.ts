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

const BRADBURY_CHAIN_ID_HEX = `0x${(4221).toString(16)}`;

function isOnlyMetaMask(p: InjectedProvider): boolean {
  if (!p.isMetaMask) return false;
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
  if (Array.isArray(eth.providers)) {
    const mm = eth.providers.find(isOnlyMetaMask);
    if (mm) return mm;
  }
  if (isOnlyMetaMask(eth)) return eth;
  return null;
}

const NOT_METAMASK_MSG =
  "This dApp requires MetaMask. Other wallets (Rabby, Coinbase, Trust, OKX, Phantom, Brave) cannot sign GenLayer transactions. Install MetaMask from https://metamask.io to continue.";

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
  const provider = pickMetaMaskProvider();
  if (!provider) throw new Error(NOT_METAMASK_MSG);
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned");
  await ensureBradburyChain(provider);
  return accounts[0] as `0x${string}`;
}

function makeClient(account: `0x${string}`) {
  const provider = pickMetaMaskProvider();
  if (!provider) throw new Error(NOT_METAMASK_MSG);
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
