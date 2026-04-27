# Reputation Oracle

Trustless on chain reputation score (0-100) for any wallet, computed by combining GitHub API data with LLM evaluation through GenLayer's Optimistic Democracy consensus.

Built on [GenLayer](https://genlayer.com)  uses `gl.nondet.web.request` to fetch real GitHub data and `gl.nondet.exec_prompt` to evaluate qualitative criteria, with multiple validators running different LLMs (GPT, Claude, Gemini, Qwen, Llama) reaching consensus on the score.

## Live Deployment

- **Network:** GenLayer Studionet
- **Contract:** [`0x84d17ce5Db73728a372e4f70f3c9DD641fE135f0`](https://explorer-studio.genlayer.com/address/0x84d17ce5Db73728a372e4f70f3c9DD641fE135f0)

## How it works

1. User links their wallet to a GitHub handle via `link_identity(handle)`
2. User calls `request_score()`  contract fetches GitHub user + recent repos data, an LLM evaluates the developer profile, validators reach consensus on a 0-100 score
3. Anyone can read scores via `read_score(wallet_hex)` free, instant, no recompute

## Why GenLayer

A pure-Solidity version of this is impossible fetching arbitrary web data and applying qualitative judgment requires either a centralized oracle or off chain trust. GenLayer's intelligent contracts handle both natively.

## Use cases

- Under collateralized lending (reputation gates collateral ratio)
- DAO voting weight (stake × reputation)
- Airdrop quality filtering (sybil resistance)
- Hiring/bounty access (verified dev gates)
- Trust badges in dApps

## Contract API

| Method | Type | Purpose |
|---|---|---|
| `link_identity(github_handle)` | write | Link sender wallet → GitHub handle |
| `request_score()` | write | Compute score for sender (LLM + GitHub fetch) |
| `read_my_score()` | view | Read sender's cached score (free) |
| `read_score(wallet_hex)` | view | Read any wallet's cached score (free) |
| `my_identity()` | view | Check if sender's wallet is linked |
| `pool_balance()` | view | View sponsor pool balance |
| `fund_pool()` | payable | Owner deposits GEN to subsidize computes |

## Scoring criteria

The LLM evaluates GitHub data on:
- Account age and activity consistency
- Public repos count and quality (stars, forks)
- Followers/following ratio (sybil avoidance)
- Bio completeness

## Verified end-to-end

GitHub handle `rivaleuc` → score **42/100**, reasoning:
> "The developer shows consistent activity and a healthy follower count for a four year old account, though their repositories lack community engagement such as stars and forks."


## Roadmap

- [x] V1: GitHub signal
- [ ] V2: Twitter/X signal (multi source scoring)
- [ ] V3: On chain history signal
- [ ] Frontend (Next.js + genlayer-js)
- [ ] Production deploy on Testnet Bradbury
