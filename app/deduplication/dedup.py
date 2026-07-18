"""Deduplication by exact email or exact phone match only.

This used to also merge leads on fuzzy name similarity, but a QA audit
proved that's unsound: percentage-based fuzzy ratios cannot reliably tell
"same person, typo'd name" apart from "different people, coincidentally
similar name" --

    fuzz.ratio("jon li", "jan li")            == 83.3
    fuzz.ratio("mohammed ali", "muhammad ali") == 83.3

Same score, opposite ground truth -- no threshold separates them. Adding
a "corroborating signal" (same email domain, same phone prefix) doesn't
fix it either: realistic bulk data routinely has many different people
sharing a company email domain or a regional area code, so those signals
are satisfied constantly and don't actually distinguish same-person from
different-person. Concretely, this let 1,110 distinct people (unique
emails, unique phones) collapse down to 12 survivors in one test batch,
purely because their names looked similar to each other.

The cost of getting this wrong is asymmetric: a missed duplicate just
shows up as two separate lead rows (mildly annoying, fully recoverable).
A false-positive merge silently deletes a real customer's lead data
(unrecoverable, and invisible unless someone goes looking for it). Given
that asymmetry, only merging on exact identifiers -- which can't produce
false positives -- is the correct tradeoff, even though it means this
dedup pass no longer catches "same person, different email and phone,
recognizable name" cases. If that case needs to be caught later, it needs
a much stronger signal than name text alone (e.g. matching on a resolved
company + verified phone carrier lookup), not a bigger fuzzy-match
threshold.

A naive all-pairs comparison is O(n^2); union-find over exact keys keeps
this roughly linear even at 100k+ leads.
"""

from collections import defaultdict

from app.schema.canonical import Lead


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def _completeness(lead: Lead) -> int:
    return sum(1 for v in (lead.first_name, lead.last_name, lead.email, lead.phone_e164, lead.campaign_id) if v)


def _best_key(lead: Lead) -> tuple[float, int, object]:
    # quality_score is the primary tiebreaker (leads are scored before
    # dedup runs, see app/agent/pipeline.py) -- completeness and recency
    # only matter if two leads in a cluster scored identically.
    return (lead.quality_score or 0.0, _completeness(lead), lead.created_at)


def deduplicate(leads: list[Lead]) -> tuple[list[Lead], list[Lead]]:
    """Returns (kept, marked_as_duplicate). `kept` retains the best record
    from each cluster of matching leads; every other cluster member comes
    back in `marked_as_duplicate` with status set accordingly."""
    n = len(leads)
    uf = _UnionFind(n)

    by_email: dict[str, int] = {}
    by_phone: dict[str, int] = {}

    for i, lead in enumerate(leads):
        if lead.email:
            key = lead.email.lower()
            if key in by_email:
                uf.union(i, by_email[key])
            else:
                by_email[key] = i

        if lead.phone_e164:
            if lead.phone_e164 in by_phone:
                uf.union(i, by_phone[lead.phone_e164])
            else:
                by_phone[lead.phone_e164] = i

    clusters: dict[int, list[int]] = defaultdict(list)
    for i in range(n):
        clusters[uf.find(i)].append(i)

    kept: list[Lead] = []
    duplicates: list[Lead] = []

    for indices in clusters.values():
        cluster = [leads[i] for i in indices]
        if len(cluster) == 1:
            kept.append(cluster[0])
            continue
        best = max(cluster, key=_best_key)
        kept.append(best)
        for member in cluster:
            if member is not best:
                member.status = "duplicate"
                member.duplicate_of_lead_id = best.lead_id
                duplicates.append(member)

    return kept, duplicates
