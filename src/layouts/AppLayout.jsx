import { useMemo, useState } from 'react'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function navItemClass(isActive) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive
    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`
}

function Sidebar({ menuItems, user, onClose, onLogout }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Meeting Hub</p>
            <p className="text-xs text-gray-400">Meeting Minutes Generator</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 lg:hidden"
        >
          <CloseRoundedIcon fontSize="small" />
        </button>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink key={item.path} to={item.path} onClick={onClose} className={({ isActive }) => navItemClass(isActive)}>
              <Icon fontSize="small" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-gray-800 px-4 py-4">
        <div className="mb-3 rounded-lg bg-gray-800 p-3">
          <p className="text-sm font-semibold text-white">{user?.name || 'Usuário'}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700"
        >
          <LogoutRoundedIcon fontSize="small" />
          Sair
        </button>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const menuItems = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardRoundedIcon },
      { label: 'Reuniões', path: '/meetings', icon: EventNoteRoundedIcon },
      { label: 'Atas', path: '/minutes', icon: DescriptionRoundedIcon },
      { label: 'Entrevistas', path: '/interviews', icon: GroupsRoundedIcon },
      { label: 'Tarefas', path: '/tasks', icon: AssignmentTurnedInRoundedIcon },
      { label: 'Configurações', path: '/settings', icon: SettingsRoundedIcon },
    ],
    [],
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-sm font-semibold">Meeting Hub</p>
          <p className="text-xs text-slate-500">Meeting Minutes Generator</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
        >
          <MenuRoundedIcon fontSize="small" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full w-64 bg-gray-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar
              menuItems={menuItems}
              user={user}
              onClose={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-800 bg-gray-900 lg:block">
        <Sidebar menuItems={menuItems} user={user} onClose={() => { }} onLogout={handleLogout} />
      </aside>

      <main className="min-w-0 overflow-x-hidden px-4 pb-6 pt-20 lg:ml-64 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
