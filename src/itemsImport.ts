// Importació additiva d'elements en JSON (la caixa d'enganxar de Dades).
// Accepta un objecte, una llista d'objectes o { items: [...] }, amb els noms
// de camp de l'app (name, categoryId, weightGrams…) o els del format original
// de l'inventari (item, categoria, peso_g, comentario, pack, slug…).
import { newId, type Category, type GearData, type GearItem } from './store'

export type ImportIssue =
  | { code: 'parse'; detail: string }
  | { code: 'notList' }
  | { code: 'noName'; n: number }
  | { code: 'noCategory'; n: number; name: string }
  | { code: 'badWeight'; n: number; name: string }
  | { code: 'dupId'; n: number; name: string }

export type ItemsImportResult = {
  items: GearItem[]
  newCategories: Category[]
  issues: ImportIssue[]
}

const PALETTE = [
  '#8a5a3b', '#5e7d4f', '#b5854e', '#5c6fa8', '#4e7d8e', '#c99a3c', '#b0413e',
  '#7a5c8e', '#55606b', '#58a08a', '#6e6a5e', '#c9b23a', '#a86378', '#54708c',
]

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || newId()
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
}

function asGrams(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined
}

export function parseItemsJson(text: string, data: GearData): ItemsImportResult {
  const result: ItemsImportResult = { items: [], newCategories: [], issues: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    result.issues.push({ code: 'parse', detail: err instanceof Error ? err.message : String(err) })
    return result
  }

  let entries: unknown[]
  if (Array.isArray(parsed)) {
    entries = parsed
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>
    entries = Array.isArray(obj.items) ? obj.items : [parsed]
  } else {
    entries = []
  }
  if (entries.length === 0) {
    result.issues.push({ code: 'notList' })
    return result
  }

  const usedIds = new Set(data.items.map((it) => it.id))
  const usedColors = new Set(data.categories.map((c) => c.color))
  // Amb la paleta exhaurida, es deriva un to estable del nom de la categoria.
  const nextColor = (from: string) => {
    const free = PALETTE.find((c) => !usedColors.has(c))
    if (free) return free
    let hash = 0
    for (const ch of from) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360
    return `hsl(${hash}, 35%, 45%)`
  }

  const findCategory = (raw: string): Category | undefined => {
    const norm = raw.toLowerCase()
    return [...data.categories, ...result.newCategories].find(
      (c) => c.id.toLowerCase() === norm || c.name.toLowerCase() === norm,
    )
  }

  entries.forEach((entry, i) => {
    const n = i + 1
    if (typeof entry !== 'object' || entry === null) {
      result.issues.push({ code: 'noName', n })
      return
    }
    const e = entry as Record<string, unknown>

    const name = asString(e.name) ?? asString(e.item)
    if (!name) {
      result.issues.push({ code: 'noName', n })
      return
    }

    const categoryRaw = asString(e.categoryId) ?? asString(e.categoria)
    if (!categoryRaw) {
      result.issues.push({ code: 'noCategory', n, name })
      return
    }
    let category = findCategory(categoryRaw)
    if (!category) {
      category = {
        id: slugify(categoryRaw),
        name: categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1),
        color: nextColor(categoryRaw),
      }
      usedColors.add(category.color)
      result.newCategories.push(category)
    }

    const weightRaw = e.weightGrams ?? e.peso_g
    let weightGrams: number | null = null
    if (weightRaw != null) {
      const grams = asGrams(weightRaw)
      if (grams === undefined) {
        result.issues.push({ code: 'badWeight', n, name })
        return
      }
      weightGrams = grams
    }

    const id = asString(e.slug) ?? asString(e.id) ?? slugify(name)
    if (usedIds.has(id)) {
      result.issues.push({ code: 'dupId', n, name })
      return
    }
    usedIds.add(id)

    const specsRaw = Array.isArray(e.specs) ? e.specs : []
    const specs = specsRaw
      .filter(
        (s): s is { label: string; value: string } =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>).label === 'string' &&
          typeof (s as Record<string, unknown>).value === 'string',
      )
      .map((s) => ({ label: s.label, value: s.value }))
    const tags = asStringArray(e.tags)
    const needs = asStringArray(e.needs)

    result.items.push({
      id,
      name,
      categoryId: category.id,
      tags,
      weightGrams,
      notes: asString(e.notes) ?? asString(e.comentario) ?? '',
      photo: null,
      placement: asString(e.placement) ?? asString(e.pack),
      caseWeightGrams: asGrams(e.caseWeightGrams ?? e.peso_funda_g),
      maxLoadGrams: asGrams(e.maxLoadGrams),
      needs: needs.length > 0 ? needs : undefined,
      worn: e.worn === true ? true : undefined,
      specs: specs.length > 0 ? specs : undefined,
    })
  })

  return result
}
