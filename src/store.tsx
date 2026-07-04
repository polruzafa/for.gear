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
  /** Número del kit al qual pertany (elements que van junts). */
  kit?: number
  /** Pes de la funda quan es pesa a part, en grams. */
  caseWeightGrams?: number
}

export type Pack = {
  id: string
  name: string
  backpackId: string
  itemIds: string[]
}

export type GearData = {
  schemaVersion: number
  categories: Category[]
  items: GearItem[]
  packs: Pack[]
}

export const BACKPACK_CATEGORY = 'mochilas'

const STORAGE_KEY = 'for-gear:data'

export const seedData = seed as GearData

export type Action =
  | { type: 'item/add'; item: GearItem }
  | { type: 'item/update'; item: GearItem }
  | { type: 'item/delete'; id: string }
  | { type: 'pack/add'; pack: Pack }
  | { type: 'pack/delete'; id: string }
  | { type: 'pack/toggleItem'; packId: string; itemId: string }
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
        packs: data.packs
          .filter((p) => p.backpackId !== action.id)
          .map((p) => ({ ...p, itemIds: p.itemIds.filter((id) => id !== action.id) })),
      }
    case 'pack/add':
      return { ...data, packs: [...data.packs, action.pack] }
    case 'pack/delete':
      return { ...data, packs: data.packs.filter((p) => p.id !== action.id) }
    case 'pack/toggleItem':
      return {
        ...data,
        packs: data.packs.map((p) => {
          if (p.id !== action.packId) return p
          const has = p.itemIds.includes(action.itemId)
          return {
            ...p,
            itemIds: has
              ? p.itemIds.filter((id) => id !== action.itemId)
              : [...p.itemIds, action.itemId],
          }
        }),
      }
    case 'data/import':
      return action.data
    case 'data/reset':
      return seedData
  }
}

function load(): GearData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      // Si l'esquema desat és d'una versió anterior, es torna a la llavor.
      if (isGearData(parsed) && parsed.schemaVersion === seedData.schemaVersion) return parsed
    }
  } catch {
    // dades corruptes: es torna a les dades d'exemple
  }
  return seedData
}

export function isGearData(value: unknown): value is GearData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.categories) && Array.isArray(v.items) && Array.isArray(v.packs)
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

export function packWeight(data: GearData, pack: Pack): number {
  const ids = [pack.backpackId, ...pack.itemIds]
  return ids.reduce((sum, id) => sum + (itemOf(data, id)?.weightGrams ?? 0), 0)
}

/** Pes per categoria d'una motxilla preparada (inclou la motxilla mateixa). */
export function packWeightByCategory(data: GearData, pack: Pack): Map<string, number> {
  const byCategory = new Map<string, number>()
  for (const id of [pack.backpackId, ...pack.itemIds]) {
    const item = itemOf(data, id)
    if (!item) continue
    byCategory.set(item.categoryId, (byCategory.get(item.categoryId) ?? 0) + (item.weightGrams ?? 0))
  }
  return byCategory
}

/** «820 g» o «1,18 kg», segons la llengua activa. */
export function formatWeight(grams: number | null): string {
  if (grams === null) return '—'
  if (grams < 1000) return `${grams} g`
  const kg = grams / 1000
  return `${kg.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
}
