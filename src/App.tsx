import { HashRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { I18nProvider, useI18n } from './i18n'
import { StoreProvider } from './store'
import GearList from './pages/GearList'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Packs from './pages/Packs'
import PackDetail from './pages/PackDetail'
import DataPage from './pages/DataPage'

function Layout() {
  const { t } = useI18n()
  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">
          For<span className="wordmark-dot">·</span>Gear
        </span>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label={t('nav.main')}>
        <NavLink to="/" end className="tab">
          <TabIcon kind="gear" />
          {t('tabs.gear')}
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

function TabIcon({ kind }: { kind: 'gear' | 'pack' | 'data' }) {
  const paths = {
    gear: 'M4 7h16M4 12h16M4 17h10',
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
              <Route path="motxilles" element={<Packs />} />
              <Route path="motxilles/:id" element={<PackDetail />} />
              <Route path="dades" element={<DataPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </StoreProvider>
    </I18nProvider>
  )
}
