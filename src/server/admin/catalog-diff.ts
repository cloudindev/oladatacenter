/**
 * Diff between two OVH catalog snapshots.
 *
 * What the operator is looking for, in order of how much it costs to miss:
 *  1. one of the four MVP plan codes disappeared from the catalog — we are selling
 *     something OVH no longer offers, and the next order will fail at checkout;
 *  2. a cost went UP — every PVP driven by the margin rule just lost margin;
 *  3. a cost went down, or something new appeared.
 *
 * Pure: it takes two already-parsed snapshots and returns the comparison.
 */
import { MVP_PLAN_CODES, TERMS, type Cents, type Term } from "@ola/core"
import type { SnapshotCost, SnapshotRow } from "./store"

export type CostChangeKind = "up" | "down" | "added" | "removed"

export interface CostChange {
  code: string
  name: string
  kind: "plan" | "addon"
  change: CostChangeKind
  /** Cost before and after, per term. `null` when the entry did not exist. */
  before: Record<Term, Cents> | null
  after: Record<Term, Cents> | null
  /** Monthly delta in cents, positive when it got more expensive. */
  deltaMonth: Cents
}

export interface CatalogDiff {
  newest: SnapshotRow | null
  previous: SnapshotRow | null
  changes: readonly CostChange[]
  /** MVP plan codes missing from the newest snapshot. A loud banner, not a row. */
  missingMvpPlans: readonly string[]
  /** True when at least one cost rose. */
  hasCostRises: boolean
}

function deltaMonth(before: SnapshotCost | undefined, after: SnapshotCost | undefined): Cents {
  return (after?.cost.P1M ?? 0) - (before?.cost.P1M ?? 0)
}

function changed(before: SnapshotCost, after: SnapshotCost): boolean {
  return TERMS.some((term: Term) => before.cost[term] !== after.cost[term])
}

export function diffSnapshots(snapshots: readonly SnapshotRow[]): CatalogDiff {
  const newest = snapshots[0] ?? null
  const previous = snapshots[1] ?? null

  const missingMvpPlans = newest
    ? MVP_PLAN_CODES.filter((code) => !newest.costs.has(code))
    : // No snapshot at all is not the same as a plan vanishing: say nothing and let the
      // page report that there has never been a sync.
      []

  if (!newest || !previous) {
    return { newest, previous, changes: [], missingMvpPlans, hasCostRises: false }
  }

  const changes: CostChange[] = []
  const codes = new Set<string>([...previous.costs.keys(), ...newest.costs.keys()])

  for (const code of codes) {
    const before = previous.costs.get(code)
    const after = newest.costs.get(code)

    if (before && !after) {
      changes.push({
        code,
        name: before.name,
        kind: before.kind,
        change: "removed",
        before: before.cost,
        after: null,
        deltaMonth: deltaMonth(before, after),
      })
      continue
    }
    if (!before && after) {
      changes.push({
        code,
        name: after.name,
        kind: after.kind,
        change: "added",
        before: null,
        after: after.cost,
        deltaMonth: deltaMonth(before, after),
      })
      continue
    }
    if (!before || !after || !changed(before, after)) continue

    const delta = deltaMonth(before, after)
    changes.push({
      code,
      name: after.name,
      kind: after.kind,
      change: delta >= 0 ? "up" : "down",
      before: before.cost,
      after: after.cost,
      deltaMonth: delta,
    })
  }

  // Cost rises first, then the biggest moves: the operator reads the top of the list.
  const order: Record<CostChangeKind, number> = { up: 0, removed: 1, down: 2, added: 3 }
  changes.sort(
    (a, b) => order[a.change] - order[b.change] || Math.abs(b.deltaMonth) - Math.abs(a.deltaMonth),
  )

  return {
    newest,
    previous,
    changes,
    missingMvpPlans,
    hasCostRises: changes.some((change) => change.change === "up"),
  }
}
