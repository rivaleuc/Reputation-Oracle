# { "Depends": "py-genlayer:test" }

import json
import dataclasses
from genlayer import *


@allow_storage
@dataclasses.dataclass
class Score:
    value: u256
    github_handle: str
    reasoning: str


def _addr_key(addr: Address) -> str:
    return str(addr)


class ReputationOracle(gl.Contract):
    owner: str
    scores: TreeMap[str, Score]
    identities: TreeMap[str, str]
    sponsor_pool: u256
    total_computes: u256

    def __init__(self):
        self.owner = _addr_key(gl.message.sender_address)
        self.sponsor_pool = u256(0)
        self.total_computes = u256(0)

    @gl.public.write.payable
    def fund_pool(self) -> None:
        self.sponsor_pool += gl.message.value

    @gl.public.write
    def link_identity(self, github_handle: str) -> None:
        key = _addr_key(gl.message.sender_address)
        self.identities[key] = github_handle

    @gl.public.write
    def request_score(self) -> None:
        key = _addr_key(gl.message.sender_address)
        if key not in self.identities:
            raise Exception("identity not linked — call link_identity first")

        github_handle = self.identities[key]
        score_data = self._compute_score(github_handle)

        self.scores[key] = Score(
            value=u256(score_data["value"]),
            github_handle=github_handle,
            reasoning=score_data["reasoning"],
        )
        self.total_computes += u256(1)

    @gl.public.view
    def read_my_score(self) -> dict:
        return self._read(_addr_key(gl.message.sender_address))

    @gl.public.view
    def read_score(self, wallet_hex: str) -> dict:
        return self._read(wallet_hex.lower())

    def _read(self, key: str) -> dict:
        if key not in self.scores:
            return {"exists": False}
        cached = self.scores[key]
        return {
            "exists": True,
            "value": int(cached.value),
            "github_handle": cached.github_handle,
            "reasoning": cached.reasoning,
        }

    @gl.public.view
    def pool_balance(self) -> int:
        return int(self.sponsor_pool)

    @gl.public.view
    def my_identity(self) -> dict:
        key = _addr_key(gl.message.sender_address)
        if key not in self.identities:
            return {"linked": False}
        return {"linked": True, "github_handle": self.identities[key]}

    def _compute_score(self, github_handle: str) -> dict:
        def leader_fn() -> str:
            user_url = f"https://api.github.com/users/{github_handle}"
            user_data = gl.nondet.web.request(user_url, method="GET")

            repos_url = f"https://api.github.com/users/{github_handle}/repos?per_page=10&sort=updated"
            repos_data = gl.nondet.web.request(repos_url, method="GET")

            prompt = f"""You evaluate a developer reputation 0-100 from GitHub data.

USER:
{user_data}

RECENT REPOS:
{repos_data}

Criteria:
- Account age and activity consistency
- Public repos count and quality (stars, forks)
- Followers/following ratio (sybil avoidance)
- Bio completeness

Reply ONLY valid JSON of the form: {{"value": <int 0-100>, "reasoning": "<one sentence>"}}
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
            return text

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                parsed = json.loads(leader_result.calldata)
                v = parsed.get("value")
                if not isinstance(v, int) or v < 0 or v > 100:
                    return False
                return isinstance(parsed.get("reasoning"), str)
            except Exception:
                return False

        result_str = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return json.loads(result_str)
