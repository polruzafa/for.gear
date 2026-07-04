// Fusió a tres bandes entre la llavor empaquetada i les dades de l'usuari.
//
// L'app desa, a banda de les dades, la «base»: la llavor amb què es va fer
// l'última fusió. Quan arriba una llavor nova (un desplegament), es fusiona
// entitat per entitat (per id) amb aquestes regles:
//   - L'usuari no l'ha tocat (usuari == base)  → guanya la llavor nova.
//   - L'usuari l'ha modificat o creat          → guanya l'usuari, sempre.
//   - L'usuari l'havia suprimit                → continua suprimit.
//   - Nou a la llavor                          → s'afegeix.
// Res del que l'usuari ha fet no es perd mai.
import type { GearData } from './store'

/** JSON amb les claus ordenades, per comparar entitats sense dependre de l'ordre. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function mergeCollection<T extends { id: string }>(base: T[], user: T[], seed: T[]): T[] {
  const baseMap = new Map(base.map((entity) => [entity.id, entity]))
  const userMap = new Map(user.map((entity) => [entity.id, entity]))
  const eq = (a: T | undefined, b: T | undefined) =>
    stableStringify(a ?? null) === stableStringify(b ?? null)

  const result: T[] = []
  const seedIds = new Set<string>()
  for (const s of seed) {
    seedIds.add(s.id)
    const u = userMap.get(s.id)
    const b = baseMap.get(s.id)
    if (u === undefined) {
      // L'usuari no el té: si era a la base el va suprimir; si no, és nou.
      if (b === undefined) result.push(s)
    } else if (eq(u, b)) {
      result.push(s)
    } else {
      result.push(u)
    }
  }
  for (const u of user) {
    if (seedIds.has(u.id)) continue
    const b = baseMap.get(u.id)
    // Afegit o modificat per l'usuari → es conserva.
    // Idèntic a la base però fora de la llavor nova → suprimit per la llavor.
    if (b === undefined || !eq(u, b)) result.push(u)
  }
  return result
}

export function mergeSeedData(base: GearData, user: GearData, seed: GearData): GearData {
  const merged: GearData = {
    schemaVersion: seed.schemaVersion,
    categories: mergeCollection(base.categories, user.categories, seed.categories),
    items: mergeCollection(base.items, user.items, seed.items),
    groups: mergeCollection(base.groups, user.groups, seed.groups),
  }

  // Higiene: cap referència a elements o grups que ja no existeixen.
  const itemIds = new Set(merged.items.map((it) => it.id))
  const groupIds = new Set(merged.groups.map((g) => g.id))
  merged.groups = merged.groups.map((g) => ({
    ...g,
    backpackId: g.backpackId !== null && itemIds.has(g.backpackId) ? g.backpackId : null,
    itemIds: g.itemIds.filter((id) => itemIds.has(id)),
    groupIds: g.groupIds.filter((id) => groupIds.has(id) && id !== g.id),
  }))
  return merged
}

/** Base buida per a la primera fusió: conserva tot el que té l'usuari. */
export const EMPTY_BASE: GearData = { schemaVersion: 0, categories: [], items: [], groups: [] }
