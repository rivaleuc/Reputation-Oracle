# { "Depends": "py-genlayer:test" }

import json
import dataclasses
from genlayer import *


@allow_storage
@dataclasses.dataclass
class Identity:
    github_handle: str
    twitter_handle: str


@allow_storage
@dataclasses.dataclass
class Score:
    value: u256
    sources_used: str
    reasoning: str


def _addr_key(addr: Address) -> str:
    return str(addr)


class ReputationOracle(gl.Contract):
    owner: str
    scores: TreeMap[str, Score]
    identities: TreeMap[str, Identity]
    total_computes: u256

    def __init__(self):
        self.owner = _addr_key(gl.message.sender_address)
        self.total_computes = u256(0)

    @gl.public.write
    def link_socials(self, github_handle: str, twitter_handle: str) -> None:
        gh = github_handle.strip().lstrip("@")
        tw = twitter_handle.strip().lstrip("@")
        if not gh and not tw:
            raise Exception("at least one social handle required (github or twitter)")
        key = _addr_key(gl.message.sender_address)
        self.identities[key] = Identity(github_handle=gh, twitter_handle=tw)

    @gl.public.write
    def request_score(self) -> None:
        key = _addr_key(gl.message.sender_address)
        if key not in self.identities:
            raise Exception("no socials linked — call link_socials first")

        identity = self.identities[key]
        score_data = self._compute_score(
            wallet_hex=key,
            github_handle=identity.github_handle,
            twitter_handle=identity.twitter_handle,
        )

        self.scores[key] = Score(
            value=u256(score_data["value"]),
            sources_used=score_data["sources_used"],
            reasoning=score_data["reasoning"],
        )
        self.total_computes += u256(1)

    @gl.public.view
    def read_my_score(self) -> dict:
        return self._read(_addr_key(gl.message.sender_address))

    @gl.public.view
    def read_score(self, wallet_hex: str) -> dict:
        return self._read(wallet_hex.lower())

    @gl.public.view
    def my_identity(self) -> dict:
        key = _addr_key(gl.message.sender_address)
        if key not in self.identities:
            return {"linked": False}
        ident = self.identities[key]
        return {
            "linked": True,
            "github_handle": ident.github_handle,
            "twitter_handle": ident.twitter_handle,
        }

    @gl.public.view
    def total_scored(self) -> int:
        return int(self.total_computes)

    def _read(self, key: str) -> dict:
        if key not in self.scores:
            return {"exists": False}
        cached = self.scores[key]
        return {
            "exists": True,
            "value": int(cached.value),
            "sources_used": cached.sources_used,
            "reasoning": cached.reasoning,
        }

    def _compute_score(self, wallet_hex: str, github_handle: str, twitter_handle: str) -> dict:
        def leader_fn() -> str:
            sections = []
            sources = []

            if github_handle:
                user_url = f"https://api.github.com/users/{github_handle}"
                user_data = gl.nondet.web.request(user_url, method="GET")
                repos_url = f"https://api.github.com/users/{github_handle}/repos?per_page=10&sort=updated"
                repos_data = gl.nondet.web.request(repos_url, method="GET")
                sections.append(f"GITHUB USER (@{github_handle}):\n{user_data}\n\nRECENT REPOS:\n{repos_data}")
                sources.append("github")

            if twitter_handle:
                # Twitter is hard to scrape directly; try a public mirror.
                tw_url = f"https://nitter.net/{twitter_handle}"
                try:
                    tw_data = gl.nondet.web.render(tw_url, mode="html")
                    sections.append(f"TWITTER/X PROFILE (@{twitter_handle}):\n{tw_data[:3000]}")
                    sources.append("twitter")
                except Exception:
                    sections.append(f"TWITTER/X HANDLE PROVIDED: @{twitter_handle} (profile fetch unavailable; trust handle ownership claim)")
                    sources.append("twitter_claimed")

            sources.append("wallet")
            sections.append(f"WALLET ADDRESS: {wallet_hex}")

            data_block = "\n\n---\n\n".join(sections)
            sources_str = ",".join(sources)

            prompt = f"""You evaluate a developer's overall reputation on a 0-100 scale by combining the signals below.

{data_block}

Weighting guidance:
- GitHub: account age, public repos, stars/forks, followers, bio quality, activity consistency
- Twitter/X: follower-to-following ratio, content quality, engagement, verified status, account age
- Wallet: just acknowledge it's the on-chain identity being scored (don't penalize lack of on-chain history on a testnet)

If a source is missing, do NOT penalize — score based on what's available. A user with strong GitHub and no Twitter should still score well.

Reply ONLY valid JSON of the form:
{{"value": <int 0-100>, "reasoning": "<two short sentences explaining the score>"}}

No markdown, no code fences, no extra text.
"""
            raw = gl.nondet.exec_prompt(prompt)
            text = raw if isinstance(raw, str) else json.dumps(raw)
            text = text.strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            parsed = json.loads(text)
            parsed["sources_used"] = sources_str
            return json.dumps(parsed)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                parsed = json.loads(leader_result.calldata)
                v = parsed.get("value")
                if not isinstance(v, int) or v < 0 or v > 100:
                    return False
                return isinstance(parsed.get("reasoning"), str) and isinstance(parsed.get("sources_used"), str)
            except Exception:
                return False

        result_str = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return json.loads(result_str)
