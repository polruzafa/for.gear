import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import seed from './data/gear.json'
import { getLocale } from './i18n'

export type Category = {
  id: string
  name: string
  color: string
}

export type GearItem = {
  id: string
  name: string
  categoryId: string
  tags: string[]
  weightGrams: number | null
  notes: string
  photo: string | null
  /** On va col·locat dins la motxilla («fondo», «bolsillo exterior»…). */
  placement?: string
  /** Pes de la funda quan es pesa a part, en grams. */
  caseWeightGrams?: number
  /** Càrrega màxima recomanada (per a motxilles), en grams. */
  maxLoadGrams?: number
  /** Característiques lliures, només informatives («Capacidad: 750 ml», «R-value: 4,2»…). */
  specs?: { label: string; value: string }[]
}

/**
 * Un grup és una llista de material amb nom: si té `backpackId` és una
 * motxilla preparada; si no, és un kit reutilitzable. Els grups poden
 * contenir altres grups (kits dins de motxilles, kits dins de kits, o una
 * motxilla carregada dins d'una altra).
 */
export type Group = {
  id: string
  name: string
  backpackId: string | null
  itemIds: string[]
  groupIds: string[]
}

export type GearData = {
  schemaVersion: number
  categories: Category[]
  items: GearItem[]
  groups: Group[]
}

export const BACKPACK_CATEGORY = 'mochilas'

const STORAGE_KEY = 'for-gear:data'

export const seedData = seed as GearData

export type Action =
  | { type: 'item/add'; item: GearItem }
  | { type: 'item/update'; item: GearItem }
  | { type: 'item/delete'; id: string }
  | { type: 'group/add'; group: Group }
  | { type: 'group/delete'; id: string }
  | { type: 'group/toggleItem'; groupId: string; itemId: string }
  | { type: 'group/toggleGroup'; groupId: string; childId: string }
  | { type: 'data/import'; data: GearData }
  | { type: 'data/reset' }

function reducer(data: GearData, action: Action): GearData {
  switch (action.type) {
    case 'item/add':
      return { ...data, items: [...data.items, action.item] }
    case 'item/update':
      return {
        ...data,
        items: data.items.map((it) => (it.id === action.item.id ? action.item : it)),
      }
    case 'item/delete':
      return {
        ...data,
        items: data.items.filter((it) => it.id !== action.id),
        groups: data.groups.map((g) => ({
          ...g,
          // Si era la motxilla d'un grup, el grup passa a ser un kit: no es perd res.
          backpackId: g.backpackId === action.id ? null : g.backpackId,
          itemIds: g.itemIds.filter((id) => id !== action.id),
        })),
      }
    case 'group/add':
      return { ...data, groups: [...data.groups, action.group] }
    case 'group/delete':
      return {
        ...data,
        groups: data.groups
          .filter((g) => g.id !== action.id)
          .map((g) => ({ ...g, groupIds: g.groupIds.filter((id) => id !== action.id) })),
      }
    case 'group/toggleItem':
      return {
        ...data,
        groups: data.groups.map((g) => {
          if (g.id !== action.groupId) return g
          const has = g.itemIds.includes(action.itemId)
          return {
            ...g,
            itemIds: has
              ? g.itemIds.filter((id) => id !== action.itemId)
              : [...g.itemIds, action.itemId],
          }
        }),
      }
    case 'group/toggleGroup':
      return {
        ...data,
        groups: data.groups.map((g) => {
          if (g.id !== action.groupId) return g
          const has = g.groupIds.includes(action.childId)
          return {
            ...g,
            groupIds: has
              ? g.groupIds.filter((id) => id !== action.childId)
              : [...g.groupIds, action.childId],
          }
        }),
      }
    case 'data/import':
      return action.data
    case 'data/reset':
      return seedData
  }
}

// ── Política de migracions ──────────────────────────────────────────────────
// Les dades de l'usuari viuen al dispositiu i NO es poden descartar a la
// lleugera. Regles:
//  1. Afegir un camp OPCIONAL no requereix apujar schemaVersion: les dades
//     desades segueixen sent vàlides tal qual.
//  2. Si un canvi és incompatible (camp que canvia de forma, renom, unitats),
//     apugeu schemaVersion a la llavor i afegiu un pas a migrate() que
//     TRANSFORMI les dades de la versió anterior sense perdre res.
//  3. Tornar a la llavor és només l'últim recurs per a dades corruptes o de
//     versions desconegudes (més noves que l'app, per exemple).

function looksLikeGearData(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.categories) &&
    Array.isArray(v.items) &&
    (Array.isArray(v.groups) || Array.isArray(v.packs))
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function migrate(raw: Record<string, unknown>): GearData {
  let data: any = raw
  // v2 → v3: només es van afegir camps opcionals; les dades són vàlides tal qual.
  if (data.schemaVersion === 2) data = { ...data, schemaVersion: 3 }
  // v3 → v4: `packs` passa a `groups` (amb groupIds) i el camp numèric
  // `kit` dels elements es converteix en grups amb nom.
  if (data.schemaVersion === 3) {
    const items = data.items as (GearItem & { kit?: number })[]
    const kitNumbers = [...new Set(items.map((it) => it.kit).filter((k): k is number => k != null))]
    const kitGroups: Group[] = kitNumbers.map((n) => ({
      id: `kit-${n}`,
      name: `Kit ${n}`,
      backpackId: null,
      itemIds: items.filter((it) => it.kit === n).map((it) => it.id),
      groupIds: [],
    }))
    const { packs, ...rest } = data
    data = {
      ...rest,
      schemaVersion: 4,
      items: items.map(({ kit, ...it }) => it),
      groups: [
        ...((packs ?? []) as any[]).map((p) => ({
          ...p,
          backpackId: p.backpackId ?? null,
          groupIds: p.groupIds ?? [],
        })),
        ...kitGroups,
      ],
    }
  }
  return data as GearData
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Valida i migra unes dades (de localStorage o d'un fitxer importat). */
export function parseGearData(value: unknown): GearData | null {
  if (!looksLikeGearData(value)) return null
  const migrated = migrate(value)
  return migrated.schemaVersion === seedData.schemaVersion ? migrated : null
}

function load(): GearData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseGearData(JSON.parse(raw) as unknown)
      if (parsed) return parsed
    }
  } catch {
    // dades corruptes: es torna a les dades d'exemple
  }
  return seedData
}

const StoreContext = createContext<{ data: GearData; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  return <StoreContext.Provider value={{ data, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore s’ha de fer servir dins de StoreProvider')
  return ctx
}

// ── Utilitats ────────────────────────────────────────────────────────────────

export function newId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function categoryOf(data: GearData, categoryId: string): Category {
  return (
    data.categories.find((c) => c.id === categoryId) ?? {
      id: categoryId,
      name: categoryId,
      color: '#6e6a5e',
    }
  )
}

export function itemOf(data: GearData, id: string): GearItem | undefined {
  return data.items.find((it) => it.id === id)
}

export function groupOf(data: GearData, id: string): Group | undefined {
  return data.groups.find((g) => g.id === id)
}

/** Ruta d'un grup: les motxilles i els kits tenen llistes separades. */
export function groupPath(group: Group): string {
  return `${group.backpackId ? '/motxilles' : '/kits'}/${group.id}`
}

/**
 * Ids ÚNICS de tots els elements continguts, grups imbricats inclosos (una
 * motxilla imbricada hi aporta també la seva pròpia motxilla, perquè es
 * carrega). No inclou la motxilla pròpia del grup arrel. Un element present
 * per dos camins compta un sol cop, i el recorregut és a prova de cicles.
 */
export function collectGroupItemIds(data: GearData, group: Group): Set<string> {
  const itemIds = new Set<string>()
  const visited = new Set<string>()
  const walk = (g: Group) => {
    if (visited.has(g.id)) return
    visited.add(g.id)
    for (const id of g.itemIds) itemIds.add(id)
    for (const childId of g.groupIds) {
      const child = groupOf(data, childId)
      if (!child) continue
      if (child.backpackId) itemIds.add(child.backpackId)
      walk(child)
    }
  }
  walk(group)
  return itemIds
}

/** Pes del contingut (sense la motxilla pròpia): es compara amb la càrrega màxima. */
export function groupContentsWeight(data: GearData, group: Group): number {
  let sum = 0
  for (const id of collectGroupItemIds(data, group)) sum += itemOf(data, id)?.weightGrams ?? 0
  return sum
}

/** Pes total del grup, amb la seva motxilla inclosa si en té. */
export function groupWeight(data: GearData, group: Group): number {
  const backpack = group.backpackId ? itemOf(data, group.backpackId) : undefined
  return groupContentsWeight(data, group) + (backpack?.weightGrams ?? 0)
}

/** Pes per categoria del grup sencer (motxilla pròpia inclosa). */
export function groupWeightByCategory(data: GearData, group: Group): Map<string, number> {
  const ids = collectGroupItemIds(data, group)
  if (group.backpackId) ids.add(group.backpackId)
  const byCategory = new Map<string, number>()
  for (const id of ids) {
    const item = itemOf(data, id)
    if (!item) continue
    byCategory.set(item.categoryId, (byCategory.get(item.categoryId) ?? 0) + (item.weightGrams ?? 0))
  }
  return byCategory
}

/** Percentatge de càrrega sobre la màxima de la motxilla, o null si no n'hi ha. */
export function groupLoadPercent(data: GearData, group: Group): number | null {
  const maxLoad = group.backpackId ? itemOf(data, group.backpackId)?.maxLoadGrams : undefined
  if (!maxLoad) return null
  return Math.round((groupContentsWeight(data, group) / maxLoad) * 100)
}

/** Cert si `group` conté el grup `targetId`, directament o transitivament. */
export function groupContainsGroup(data: GearData, group: Group, targetId: string): boolean {
  const visited = new Set<string>()
  const walk = (g: Group): boolean => {
    if (visited.has(g.id)) return false
    visited.add(g.id)
    for (const childId of g.groupIds) {
      if (childId === targetId) return true
      const child = groupOf(data, childId)
      if (child && walk(child)) return true
    }
    return false
  }
  return walk(group)
}

/** «820 g» o «1,18 kg», segons la llengua activa. */
export function formatWeight(grams: number | null): string {
  if (grams === null) return '—'
  if (grams < 1000) return `${grams} g`
  const kg = grams / 1000
  return `${kg.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
}
