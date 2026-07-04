import { HashRouter, Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { I18nProvider, useI18n } from './i18n'
import { StoreProvider } from './store'
import GearList from './pages/GearList'
import GroupDetail from './pages/GroupDetail'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import KitsPage from './pages/KitsPage'
import Packs from './pages/Packs'
import DataPage from './pages/DataPage'
import SettingsPage from './pages/SettingsPage'

function Layout() {
  const { t } = useI18n()
  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">
          For<span className="wordmark-dot">·</span>Gear
        </span>
        <Link to="/ajustos" className="settings-link" aria-label={t('settings.title')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-icon">
            <path
              d="M4 6h9m4 0h3M13 3.8v4.4M4 12h3m4 0h9M7 9.8v4.4M4 18h11m4 0h1M15 15.8v4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label={t('nav.main')}>
        <NavLink to="/" end className="tab">
          <TabIcon kind="gear" />
          {t('tabs.gear')}
        </NavLink>
        <NavLink to="/kits" className="tab">
          <TabIcon kind="kit" />
          {t('tabs.kits')}
        </NavLink>
        <NavLink to="/motxilles" className="tab">
          <TabIcon kind="pack" />
          {t('tabs.packs')}
        </NavLink>
        <NavLink to="/dades" className="tab">
          <TabIcon kind="data" />
          {t('tabs.data')}
        </NavLink>
      </nav>
    </div>
  )
}

function TabIcon({ kind }: { kind: 'gear' | 'kit' | 'pack' | 'data' }) {
  const paths = {
    gear: 'M4 7h16M4 12h16M4 17h10',
    kit: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9m0-9L4 7.5M12 12l8-4.5',
    pack: 'M8 7V5a4 4 0 0 1 8 0v2m-9 0h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm1 7h8',
    data: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Zm-8 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<GearList />} />
              <Route path="element/nou" element={<ItemForm />} />
              <Route path="element/:id" element={<ItemDetail />} />
              <Route path="element/:id/edita" element={<ItemForm />} />
              <Route path="kits" element={<KitsPage />} />
              <Route path="kits/:id" element={<GroupDetail />} />
              <Route path="motxilles" element={<Packs />} />
              <Route path="motxilles/:id" element={<GroupDetail />} />
              <Route path="dades" element={<DataPage />} />
              <Route path="ajustos" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </StoreProvider>
    </I18nProvider>
  )
}
