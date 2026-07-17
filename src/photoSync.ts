// Sincronització de fotografies amb el servidor (un bucket R2 darrere del
// Worker; vegeu server/README.md). Les fotografies mai no són crítiques: els
// errors es callen i es torna a provar amb la sincronització següent.
//
// El model és d'estat, no de diari. Es persisteixen tres conjunts:
//   - pendingUpload: claus desades en aquest dispositiu pendents d'enviar.
//   - pendingDelete: claus suprimides aquí pendents de propagar.
//   - known: les claus que el servidor tenia l'última vegada que hi vam parlar.
// El conjunt «known» distingeix els dos sentits d'una absència: una clau local
// que el servidor no té és «per enviar» si no la coneixia, i «suprimida en un
// altre dispositiu» si la coneixia.
import { getPhoto, listPhotoKeys, putPhotoLocal, removePhotoLocal, setPhotoChangeListener, firePhotosChanged } from './photos'

const STATE_KEY = 'fardell:photo-sync'
/** El mateix límit que el servidor; una foto reduïda ocupa 150–250 kB. */
const MAX_PHOTO_BYTES = 1_000_000

type PhotoSyncState = {
  pendingUpload: string[]
  pendingDelete: string[]
  known: string[]
}

function loadState(): PhotoSyncState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as PhotoSyncState
      if (Array.isArray(s.pendingUpload) && Array.isArray(s.pendingDelete) && Array.isArray(s.known)) {
        return s
      }
    }
  } catch {
    // estat corrupte: es torna a començar (com a molt es reenvia alguna foto)
  }
  return { pendingUpload: [], pendingDelete: [], known: [] }
}

function saveState(state: PhotoSyncState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

/** En suprimir el compte: el servidor ja no té res; les fotos locals es
 * tornaran a enviar senceres si mai hi ha un compte nou. */
export function resetPhotoSyncState(): void {
  localStorage.removeItem(STATE_KEY)
}

/** Hi ha canvis locals pendents de propagar? (guia per estalviar peticions) */
export function hasPendingPhotoOps(): boolean {
  const s = loadState()
  return s.pendingUpload.length > 0 || s.pendingDelete.length > 0
}

// L'AccountProvider s'hi registra per programar un enviament quan canvia una foto.
let queueListener: (() => void) | null = null
export function setPhotoQueueListener(fn: (() => void) | null): void {
  queueListener = fn
}

// Cada canvi local s'apunta a la cua, amb sessió o sense: si l'usuari inicia
// la sessió més tard, la cua ja diu què cal enviar o propagar.
setPhotoChangeListener((kind, key) => {
  const s = loadState()
  if (kind === 'save') {
    if (!s.pendingUpload.includes(key)) s.pendingUpload.push(key)
    s.pendingDelete = s.pendingDelete.filter((k) => k !== key)
  } else {
    if (!s.pendingDelete.includes(key)) s.pendingDelete.push(key)
    s.pendingUpload = s.pendingUpload.filter((k) => k !== key)
  }
  saveState(s)
  queueListener?.()
})

function photoUrl(serverUrl: string, key: string): string {
  return `${serverUrl}/api/photos/${encodeURIComponent(key)}`
}

// Si arriba una petició de sincronització mentre una altra és en marxa, se
// n'encadena una més al final en lloc de trepitjar-se.
let running = false
let runAgain = false

export async function syncPhotos(serverUrl: string, token: string): Promise<void> {
  if (running) {
    runAgain = true
    return
  }
  running = true
  try {
    do {
      runAgain = false
      await syncOnce(serverUrl, token)
    } while (runAgain)
  } catch {
    // sense xarxa o servidor caigut: la cua es conserva i es reintenta després
  } finally {
    running = false
  }
}

async function syncOnce(serverUrl: string, token: string): Promise<void> {
  const auth = { Authorization: `Bearer ${token}` }

  // Sense R2 al servidor (501), o sessió caducada (401): no es fa res; de la
  // sessió ja se n'adonarà la sincronització de dades.
  const listRes = await fetch(`${serverUrl}/api/photos`, { headers: auth })
  if (!listRes.ok) return
  const listBody = (await listRes.json()) as { keys?: unknown }
  if (!Array.isArray(listBody.keys)) return
  const remote = new Set(listBody.keys.filter((k): k is string => typeof k === 'string'))

  const local = new Set(await listPhotoKeys())
  const state = loadState()
  const known = new Set(state.known)
  let changedLocally = false

  // 1. Propaga les supressions locals.
  const stillDelete: string[] = []
  for (const key of state.pendingDelete) {
    try {
      const res = await fetch(photoUrl(serverUrl, key), { method: 'DELETE', headers: auth })
      if (res.ok || res.status === 404) {
        remote.delete(key)
        known.delete(key)
      } else {
        stillDelete.push(key)
      }
    } catch {
      stillDelete.push(key)
    }
  }

  // 2. Envia les pendents i les que el servidor no ha conegut mai.
  const toUpload = new Set(state.pendingUpload)
  for (const key of local) if (!remote.has(key) && !known.has(key)) toUpload.add(key)
  const stillUpload: string[] = []
  for (const key of toUpload) {
    if (stillDelete.includes(key)) continue
    const blob = await getPhoto(key).catch(() => undefined)
    if (!blob || blob.size > MAX_PHOTO_BYTES) continue // ja no hi és, o no hi cap
    // El servidor només accepta tipus d'imatge; les fotos de l'app sempre
    // surten del reductor com a JPEG, però per si de cas es normalitza.
    const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)
      ? blob.type
      : 'image/jpeg'
    try {
      const res = await fetch(photoUrl(serverUrl, key), {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': contentType },
        body: blob,
      })
      if (res.ok) {
        remote.add(key)
        known.add(key)
      } else {
        stillUpload.push(key)
      }
    } catch {
      stillUpload.push(key)
    }
  }

  // 3. Aplica aquí les supressions fetes en altres dispositius: el servidor
  //    tenia la clau (known) i ja no la té.
  for (const key of local) {
    if (!remote.has(key) && known.has(key) && !stillUpload.includes(key)) {
      await removePhotoLocal(key).catch(() => {})
      changedLocally = true
    }
  }

  // 4. Baixa les que falten en aquest dispositiu.
  for (const key of remote) {
    if (local.has(key)) continue
    try {
      const res = await fetch(photoUrl(serverUrl, key), { headers: auth })
      if (!res.ok) continue
      await putPhotoLocal(key, await res.blob())
      changedLocally = true
    } catch {
      // es tornarà a provar a la propera
    }
  }

  saveState({ pendingUpload: stillUpload, pendingDelete: stillDelete, known: [...remote] })
  if (changedLocally) firePhotosChanged()
}
