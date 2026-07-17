// Fotografies dels elements: viuen a IndexedDB (no a localStorage, que té un
// límit d'uns 5 MB i només accepta cadenes). No viatgen amb l'exportació del
// JSON, però amb un compte es sincronitzen entre dispositius (photoSync.ts):
// savePhoto() i deletePhoto() avisen el sincronitzador de cada canvi.
import { useEffect, useState } from 'react'

const DB_NAME = 'fardell'
const STORE = 'photos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function getPhoto(id: string): Promise<Blob | undefined> {
  return withStore('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
}

/** Nombre màxim de fotografies per ressenya. */
export const MAX_REVIEW_PHOTOS = 3

/**
 * Claus de les fotografies d'una ressenya: la primera és l'id pelat (les
 * fotografies velles, de quan només n'hi cabia una, queden a la primera
 * posició sense cap migració) i la resta duen el sufix «#2», «#3»…
 */
export function photoKeys(id: string): string[] {
  return Array.from({ length: MAX_REVIEW_PHOTOS }, (_, i) => (i === 0 ? id : `${id}#${i + 1}`))
}

/** Claus de totes les fotografies desades al dispositiu. */
export async function listPhotoKeys(): Promise<string[]> {
  const keys = await withStore('readonly', (s) => s.getAllKeys())
  return keys.filter((k): k is string => typeof k === 'string')
}

// El sincronitzador (photoSync.ts) s'hi registra per apuntar cada canvi local.
// És una funció solta i no un import per no crear una dependència circular.
let changeListener: ((kind: 'save' | 'delete', key: string) => void) | null = null
export function setPhotoChangeListener(fn: typeof changeListener): void {
  changeListener = fn
}

// Quan la sincronització baixa o esborra fotografies, les vistes obertes
// (usePhoto/usePhotos) es refresquen escoltant aquest esdeveniment.
const CHANGED_EVENT = 'fardell:photos-changed'
export function firePhotosChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/** Desa sense avisar el sincronitzador (la fa servir ell mateix, en baixar). */
export async function putPhotoLocal(id: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (s) => s.put(blob, id))
}

/** Esborra sense avisar el sincronitzador (la fa servir ell mateix). */
export async function removePhotoLocal(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await putPhotoLocal(id, blob)
  changeListener?.('save', id)
}

export async function deletePhoto(id: string): Promise<void> {
  await removePhotoLocal(id)
  changeListener?.('delete', id)
}

/** Esborra les fotografies d'elements que ja no existeixen (després d'importar
 * o restaurar). Les claus amb sufix («id#2», «id#3»…) valen pel seu id base. */
export async function prunePhotos(validIds: Set<string>): Promise<void> {
  const keys = await withStore('readonly', (s) => s.getAllKeys())
  await Promise.all(
    keys
      .filter((k): k is string => typeof k === 'string' && !validIds.has(k.split('#')[0]))
      .map((k) => deletePhoto(k)),
  )
}

/**
 * Redueix la imatge abans de desar-la: costat màxim 1280 px, JPEG al 80 %.
 * Una foto de càmera de 3-5 MB queda en uns 150-250 kB.
 */
export async function downscale(file: File, maxSide = 1280): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No s’ha pogut llegir la imatge'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8),
    )
    if (!blob) throw new Error('No s’ha pogut convertir la imatge')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** URL de la fotografia d'un element, o null si no en té. `refresh()` la torna a llegir. */
export function usePhoto(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // La sincronització pot baixar o esborrar fotografies: es torna a llegir.
  useEffect(() => {
    const onChanged = () => setVersion((v) => v + 1)
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    let cancelled = false
    getPhoto(id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = blob ? URL.createObjectURL(blob) : null
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, version])

  return { url, refresh: () => setVersion((v) => v + 1) }
}

/** URLs de diverses fotografies alhora (null on no n'hi ha). Per a claus
 * sense id (ressenya nova, encara sense desar) retorna null directament. */
export function usePhotos(ids: (string | undefined)[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>(() => ids.map(() => null))
  const [version, setVersion] = useState(0)
  const key = ids.join('|')

  useEffect(() => {
    const onChanged = () => setVersion((v) => v + 1)
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    let cancelled = false
    let objectUrls: (string | null)[] = []
    void Promise.all(
      ids.map((id) => (id ? getPhoto(id).catch(() => undefined) : Promise.resolve(undefined))),
    ).then((blobs) => {
      if (cancelled) return
      objectUrls = blobs.map((blob) => (blob ? URL.createObjectURL(blob) : null))
      setUrls(objectUrls)
    })
    return () => {
      cancelled = true
      for (const u of objectUrls) if (u) URL.revokeObjectURL(u)
    }
    // Les claus canvien totes juntes: n'hi ha prou amb la cadena concatenada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  return urls
}
