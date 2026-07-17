// Compte d'usuari i sincronització amb el servidor (vegeu server/README.md).
//
// El model és «local primer»: l'app funciona igual sense compte, i el servidor
// només guarda una còpia del JSON de dades per usuari. L'estat de sincronització
// que es persisteix és mínim:
//   - lastSyncedAt: la versió del servidor que aquest dispositiu coneix.
//   - dirty: hi ha canvis locals que encara no s'han enviat.
// Amb això n'hi ha prou per saber, en connectar, qui té la versió bona:
//   servidor buit → s'hi puja el local; només canvis locals → push; només
//   canvis remots → pull; canvis a totes dues bandes → es pregunta a l'usuari.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useI18n, type TKey } from './i18n'
import {
  hasPendingPhotoOps,
  resetPhotoSyncState,
  setPhotoQueueListener,
  syncPhotos,
} from './photoSync'
import { parseGearData, useStore, type GearData } from './store'

const ACCOUNT_KEY = 'fardell:account'
const SYNC_KEY = 'fardell:sync'
const SERVER_URL_KEY = 'fardell:server-url'

/** Enviament diferit: agrupa una ràfega d'edicions en una sola petició. */
const PUSH_DEBOUNCE_MS = 1500
/** En tornar a l'app, no es torna a comprovar el servidor abans d'aquest temps. */
const FOCUS_SYNC_MIN_MS = 60_000

export type Account = { email: string; token: string; serverUrl: string }
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'dirty' | 'error'

type SyncState = { lastSyncedAt: string | null; dirty: boolean }

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function loadAccount(): Account | null {
  const acc = loadJson<Account>(ACCOUNT_KEY)
  return acc && acc.email && acc.token && acc.serverUrl ? acc : null
}

function loadSyncState(): SyncState {
  return loadJson<SyncState>(SYNC_KEY) ?? { lastSyncedAt: null, dirty: false }
}

export function defaultServerUrl(): string {
  return (
    localStorage.getItem(SERVER_URL_KEY) ??
    ((import.meta.env.VITE_API_URL as string | undefined) || '')
  )
}

/** Treu la barra final i els espais: «https://api…/» i «https://api…» són el mateix. */
function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

type ApiResponse = { status: number; body: Record<string, unknown> }

async function api(
  serverUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const res = await fetch(serverUrl + path, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

type AccountContextValue = {
  account: Account | null
  status: SyncStatus
  lastSyncedAt: string | null
  /** Missatge d'error pendent de mostrar (clau i18n), o null. */
  errorKey: TKey | null
  /** Retornen la clau i18n de l'error, o null si tot ha anat bé. */
  login: (serverUrl: string, email: string, password: string) => Promise<TKey | null>
  register: (serverUrl: string, email: string, password: string, code: string) => Promise<TKey | null>
  logout: () => void
  deleteAccount: (password: string) => Promise<TKey | null>
  syncNow: () => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data, dispatch } = useStore()
  const { t } = useI18n()

  const [account, setAccountState] = useState<Account | null>(loadAccount)
  const [syncState, setSyncStateRaw] = useState<SyncState>(loadSyncState)
  const [status, setStatus] = useState<SyncStatus>(() =>
    loadAccount() ? (loadSyncState().dirty ? 'dirty' : 'synced') : 'idle',
  )
  const [errorKey, setErrorKey] = useState<TKey | null>(null)

  // Referències per a les funcions asíncrones (sempre el valor d'ara mateix).
  const dataRef = useRef<GearData>(data)
  dataRef.current = data
  const accountRef = useRef(account)
  accountRef.current = account
  const syncRef = useRef(syncState)
  syncRef.current = syncState

  const lastSeenData = useRef(data)
  const applyingRemote = useRef(false)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncAttempt = useRef(0)

  // Fotografies: a l'arrencada (o després d'entrar) sempre toca una passada
  // completa; després, només quan hi ha canvis locals o dades noves del servidor.
  const photoSyncWanted = useRef(true)
  const photoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePhotoSync = useCallback(() => {
    const acc = accountRef.current
    if (!acc) return
    if (photoTimer.current) clearTimeout(photoTimer.current)
    photoTimer.current = setTimeout(() => {
      photoTimer.current = null
      const current = accountRef.current
      if (current) void syncPhotos(current.serverUrl, current.token)
    }, PUSH_DEBOUNCE_MS)
  }, [])

  const setAccount = useCallback((acc: Account | null) => {
    accountRef.current = acc
    setAccountState(acc)
    if (acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc))
    else localStorage.removeItem(ACCOUNT_KEY)
  }, [])

  const setSyncState = useCallback((state: SyncState) => {
    syncRef.current = state
    setSyncStateRaw(state)
    localStorage.setItem(SYNC_KEY, JSON.stringify(state))
  }, [])

  const failWith = useCallback((key: TKey) => {
    setErrorKey(key)
    setStatus('error')
  }, [])

  /** La sessió ja no val al servidor: es tanca en local sense perdre res. */
  const expireSession = useCallback(() => {
    setAccount(null)
    failWith('account.errSession')
  }, [setAccount, failWith])

  const applyRemote = useCallback(
    (payload: unknown, updatedAt: string): boolean => {
      const parsed = parseGearData(payload)
      if (!parsed) {
        failWith('account.errIncompatible')
        return false
      }
      applyingRemote.current = true
      dispatch({ type: 'data/import', data: parsed })
      setSyncState({ lastSyncedAt: updatedAt, dirty: false })
      setErrorKey(null)
      // Dades noves del servidor: potser hi ha fotografies noves a baixar.
      photoSyncWanted.current = true
      setStatus('synced')
      return true
    },
    [dispatch, setSyncState, failWith],
  )

  const push = useCallback(
    async (baseUpdatedAt: string | null): Promise<void> => {
      const acc = accountRef.current
      if (!acc) return
      setStatus('syncing')
      try {
        const res = await api(acc.serverUrl, '/api/data', {
          method: 'PUT',
          token: acc.token,
          body: { payload: dataRef.current, baseUpdatedAt },
        })
        if (res.status === 200) {
          setSyncState({ lastSyncedAt: res.body.updatedAt as string, dirty: false })
          setErrorKey(null)
          setStatus('synced')
        } else if (res.status === 409) {
          // Un altre dispositiu ha desat entremig: es torna a mirar el servidor.
          await reconcileRef.current()
        } else if (res.status === 401) {
          expireSession()
        } else {
          failWith('account.errNetwork')
        }
      } catch {
        failWith('account.errNetwork')
      }
    },
    [setSyncState, expireSession, failWith],
  )

  /**
   * Posa el dispositiu i el servidor d'acord. És l'única porta d'entrada de la
   * sincronització manual, la d'arrencada i la de després d'iniciar sessió.
   */
  const reconcile = useCallback(async (): Promise<void> => {
    const acc = accountRef.current
    if (!acc) return
    lastSyncAttempt.current = Date.now()
    setStatus('syncing')
    try {
      const res = await api(acc.serverUrl, '/api/data', { token: acc.token })
      if (res.status === 401) return expireSession()
      if (res.status !== 200) return failWith('account.errNetwork')
      const payload = res.body.payload
      const updatedAt = (res.body.updatedAt as string | null) ?? null
      const sync = syncRef.current

      if (payload == null) return push(updatedAt) // servidor buit: s'hi puja el local
      if (updatedAt === sync.lastSyncedAt) {
        // El servidor no s'ha mogut des de l'última vegada.
        if (sync.dirty) return push(updatedAt)
        setErrorKey(null)
        setStatus('synced')
        return
      }
      // El servidor té una versió que aquest dispositiu no ha vist.
      if (!sync.dirty) {
        applyRemote(payload, updatedAt as string)
        return
      }
      // Canvis a totes dues bandes: que triï l'usuari.
      if (window.confirm(t('account.conflict'))) applyRemote(payload, updatedAt as string)
      else await push(updatedAt)
    } catch {
      failWith('account.errNetwork')
    }
  }, [push, applyRemote, expireSession, failWith, t])

  // push() i reconcile() es criden mútuament (el 409 torna a reconciliar);
  // la referència trenca el cicle de dependències.
  const reconcileRef = useRef(reconcile)
  reconcileRef.current = reconcile

  const schedulePush = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null
      void push(syncRef.current.lastSyncedAt)
    }, PUSH_DEBOUNCE_MS)
  }, [push])

  // Qualsevol canvi de dades (el reductor sempre retorna un objecte nou) marca
  // el dispositiu com a brut i, si hi ha sessió, programa l'enviament.
  useEffect(() => {
    if (data === lastSeenData.current) return
    lastSeenData.current = data
    if (applyingRemote.current) {
      applyingRemote.current = false
      return
    }
    setSyncState({ ...syncRef.current, dirty: true })
    if (accountRef.current) {
      setStatus('dirty')
      schedulePush()
    }
  }, [data, setSyncState, schedulePush])

  // Amb les dades sincronitzades, es sincronitzen també les fotografies —
  // però només quan pot haver-hi feina: la primera vegada, quan han arribat
  // dades noves del servidor o quan hi ha canvis locals a la cua.
  useEffect(() => {
    if (status !== 'synced' || !accountRef.current) return
    if (photoSyncWanted.current || hasPendingPhotoOps()) {
      photoSyncWanted.current = false
      schedulePhotoSync()
    }
  }, [status, schedulePhotoSync])

  // Cada fotografia desada o suprimida amb la sessió oberta programa l'enviament.
  useEffect(() => {
    setPhotoQueueListener(() => schedulePhotoSync())
    return () => setPhotoQueueListener(null)
  }, [schedulePhotoSync])

  // En arrencar amb sessió oberta, es reconcilia; en tornar a l'app (PWA en
  // segon pla), també, però com a molt un cop per minut.
  useEffect(() => {
    if (accountRef.current) void reconcileRef.current()
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        accountRef.current &&
        Date.now() - lastSyncAttempt.current > FOCUS_SYNC_MIN_MS
      ) {
        void reconcileRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const signIn = useCallback(
    async (
      path: '/api/login' | '/api/register',
      serverUrl: string,
      email: string,
      password: string,
      code?: string,
    ): Promise<TKey | null> => {
      const url = normalizeServerUrl(serverUrl)
      if (!url) return 'account.errServer'
      setStatus('syncing')
      setErrorKey(null)
      try {
        const res = await api(url, path, {
          method: 'POST',
          body: { email: email.trim(), password, ...(code?.trim() ? { code: code.trim() } : {}) },
        })
        if (res.status === 200 || res.status === 201) {
          localStorage.setItem(SERVER_URL_KEY, url)
          setAccount({ email: res.body.email as string, token: res.body.token as string, serverUrl: url })
          // La sessió és nova: no se sap quina versió del servidor coneixíem.
          setSyncState({ lastSyncedAt: null, dirty: syncRef.current.dirty })
          photoSyncWanted.current = true
          await reconcileRef.current()
          return null
        }
        setStatus('idle')
        const error = res.body.error
        if (error === 'exists') return 'account.errExists'
        if (error === 'email') return 'account.errEmail'
        if (error === 'password') return 'account.errPassword'
        if (error === 'code') return 'account.errCode'
        if (res.status === 401) return 'account.errCredentials'
        return 'account.errNetwork'
      } catch {
        setStatus('idle')
        return 'account.errNetwork'
      }
    },
    [setAccount, setSyncState],
  )

  const login = useCallback(
    (serverUrl: string, email: string, password: string) =>
      signIn('/api/login', serverUrl, email, password),
    [signIn],
  )
  const register = useCallback(
    (serverUrl: string, email: string, password: string, code: string) =>
      signIn('/api/register', serverUrl, email, password, code),
    [signIn],
  )

  const logout = useCallback(() => {
    const acc = accountRef.current
    if (pushTimer.current) clearTimeout(pushTimer.current)
    if (photoTimer.current) clearTimeout(photoTimer.current)
    setAccount(null)
    setErrorKey(null)
    setStatus('idle')
    // L'estat de sincronització es conserva: si el mateix compte torna a entrar
    // sense haver tocat res, no cal preguntar res.
    if (acc) {
      void api(acc.serverUrl, '/api/logout', { method: 'POST', token: acc.token }).catch(() => {})
    }
  }, [setAccount])

  const deleteAccount = useCallback(
    async (password: string): Promise<TKey | null> => {
      const acc = accountRef.current
      if (!acc) return null
      try {
        const res = await api(acc.serverUrl, '/api/account', {
          method: 'DELETE',
          token: acc.token,
          body: { password },
        })
        if (res.status === 204) {
          setAccount(null)
          setSyncState({ lastSyncedAt: null, dirty: true })
          // El servidor ja no té cap fotografia: es parteix de zero.
          resetPhotoSyncState()
          setErrorKey(null)
          setStatus('idle')
          return null
        }
        if (res.status === 401) return 'account.errCredentials'
        return 'account.errNetwork'
      } catch {
        return 'account.errNetwork'
      }
    },
    [setAccount, setSyncState],
  )

  const syncNow = useCallback(() => {
    // La sincronització manual també repassa les fotografies de dalt a baix.
    photoSyncWanted.current = true
    void reconcileRef.current()
  }, [])

  return (
    <AccountContext.Provider
      value={{
        account,
        status,
        lastSyncedAt: syncState.lastSyncedAt,
        errorKey,
        login,
        register,
        logout,
        deleteAccount,
        syncNow,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount s’ha de fer servir dins d’AccountProvider')
  return ctx
}
