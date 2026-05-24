import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import { useAuth } from '../hooks/useAuth'
import { listMeetingMinutes, getTrelloTasks } from '../services/meetingMinutes'
import {
  formatCalendarDate,
  isGoogleCalendarConfigured,
  listGoogleCalendarEvents,
} from '../services/googleCalendar'

const LEADERSHIP_MEETING_TYPES = [
  'conselho_estaca',
  'coordenacao_missionaria_estaca',
  'presidencia_estaca',
  'sumo_conselho_estaca',
]

const INTERVIEW_MEETING_TYPES = [
  'entrevista_presidencia_estaca',
  'entrevista_missao_tempo_integral',
  'entrevista_missao_servico',
  'entrevista_para_chamado',
]

const CHART_COLORS = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#0891b2', '#dc2626']

function cleanTitle(title) {
  return (title || '').replace(/ - Carapicuiba Brazil Stake Atividades$/i, '').trim()
}

const MEETING_TYPE_SHORT = {
  'Reunião de Conselho da Estaca': 'Conselho',
  'Reunião de Coordenação Missionária da Estaca': 'Coord. Missionária',
  'Reunião de Presidência da Estaca': 'Presidência',
  'Reunião do Sumo Conselho da Estaca': 'Sumo Conselho',
  'Outras Reuniões': 'Outras',
  'Entrevista com a Presidência da Estaca': 'Entrevistas',
}

function shortType(label) {
  return MEETING_TYPE_SHORT[label] || label
}

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

function getAvgDaysOpenByType(tasks) {
  const byType = {}
  for (const t of tasks) {
    const type = shortType(t.meetingTypeLabel || 'Outros')
    if (!byType[type]) byType[type] = { sum: 0, count: 0 }
    byType[type].sum += t.daysOpen || 0
    byType[type].count++
  }
  return Object.entries(byType)
    .map(([name, { sum, count }]) => ({ name, dias: Math.round(sum / count) }))
    .sort((a, b) => b.dias - a.dias)
}

function isThisMonth(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function isThisWeek(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  return date >= monday && date < nextMonday
}

function getMonthlyData(minutes) {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const raw = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
    return { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), atas: 0 }
  })
  for (const m of minutes) {
    if (!m.meeting_at) continue
    const d = new Date(m.meeting_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = months.find((x) => x.key === key)
    if (entry) entry.atas++
  }
  return months
}

function getTaskStatusData(tasks) {
  const map = {}
  for (const t of tasks) {
    const status = t.status || 'Sem status'
    map[status] = (map[status] || 0) + 1
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="text-blue-600">{payload[0].value} ata{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: inner } = payload[0]
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{name}</p>
      <p style={{ color: inner.fill }}>{value} tarefa{value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function AvgDaysTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{payload[0].payload.name}</p>
      <p className="text-violet-600">{payload[0].value} dia{payload[0].value !== 1 ? 's' : ''} em média</p>
    </div>
  )
}

export default function DashboardPage() {
  const { isConfigured, user } = useAuth()
  const [minutes, setMinutes] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(isConfigured || isGoogleCalendarConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      if (!isConfigured && !isGoogleCalendarConfigured) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const [minutesData, events, tasksData] = await Promise.all([
          isConfigured ? listMeetingMinutes() : Promise.resolve([]),
          isGoogleCalendarConfigured
            ? listGoogleCalendarEvents({ maxResults: 50 })
            : Promise.resolve([]),
          user?.organizationId ? getTrelloTasks(user.organizationId).catch(() => []) : Promise.resolve([]),
        ])
        setMinutes(minutesData)
        setCalendarEvents(events)
        setTasks(tasksData)
      } catch (err) {
        setError(err.message || 'Não foi possível carregar o dashboard.')
      } finally {
        setLoading(false)
      }
    }
    void loadDashboard()
  }, [isConfigured, user?.organizationId])

  const stats = useMemo(() => [
    {
      label: 'Reuniões esse mês',
      value: calendarEvents.filter((e) => e.startAt && isThisMonth(e.startAt) && LEADERSHIP_MEETING_TYPES.includes(e.meetingType)).length,
      tone: 'bg-blue-50 text-blue-600',
      border: 'border-blue-500',
      Icon: CalendarTodayRoundedIcon,
    },
    {
      label: 'Entrevistas esta semana',
      value: calendarEvents.filter((e) => e.startAt && isThisWeek(e.startAt) && INTERVIEW_MEETING_TYPES.includes(e.meetingType)).length,
      tone: 'bg-violet-50 text-violet-600',
      border: 'border-violet-500',
      Icon: CalendarMonthRoundedIcon,
    },
    {
      label: 'Atas geradas',
      value: minutes.length,
      tone: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-500',
      Icon: DescriptionRoundedIcon,
    },
    {
      label: 'Tarefas abertas',
      value: tasks.filter((t) => {
        const s = (t.status || '').toLowerCase()
        return !s.includes('conclu') && !s.includes('done') && !s.includes('pronto')
      }).length,
      tone: 'bg-amber-50 text-amber-600',
      border: 'border-amber-500',
      Icon: AssignmentRoundedIcon,
    },
  ], [calendarEvents, minutes, tasks])

  const monthlyData = useMemo(() => getMonthlyData(minutes), [minutes])
  const taskStatusData = useMemo(() => getTaskStatusData(tasks), [tasks])
  const avgDaysOpen = useMemo(() => getAvgDaysOpenByType(tasks), [tasks])
  const upcomingMeetings = useMemo(() => {
    const now = new Date()
    return calendarEvents
      .filter((e) =>
        LEADERSHIP_MEETING_TYPES.includes(e.meetingType) &&
        e.startAt &&
        isThisMonth(e.startAt)
      )
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  }, [calendarEvents])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-blue-100">Acompanhe o panorama das suas reuniões, agendas e entrevistas.</p>
      </div>

      {!isGoogleCalendarConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Google Calendar para carregar os próximos eventos automaticamente.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, tone, border, Icon }) => (
          <div key={label} className={`rounded-lg border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md ${border}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-xl p-1.5 ${tone}`}>
                <Icon fontSize="small" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Atas por mês */}
        <div className="min-w-0 overflow-hidden rounded-lg bg-white p-4 shadow-md transition hover:shadow-lg lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Atas por mês</h2>
          <p className="mb-4 text-sm text-slate-500">Últimos 6 meses</p>
          {loading ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <BarChart data={monthlyData} barSize={36} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} style={{ overflow: 'visible' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                <Bar dataKey="atas" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribuição por status de tarefa */}
        <div className="min-w-0 overflow-hidden rounded-lg bg-white p-4 shadow-md transition hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Status das tarefas</h2>
          <p className="mb-2 text-sm text-slate-500">Distribuição por lista do Trello</p>
          {loading ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Carregando...</div>
          ) : taskStatusData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              Sem tarefas no Trello
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {taskStatusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {taskStatusData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{entry.name}</span>
                    <span className="ml-auto font-semibold text-slate-900">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Próximas reuniões do mês + tempo médio aberta */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Próximas reuniões do mês vigente */}
        <div className="min-w-0 overflow-hidden rounded-lg bg-white p-4 shadow-md transition hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Reuniões do mês</h2>
          <p className="mb-4 text-sm text-slate-500">Reuniões de liderança no mês vigente</p>
          {loading ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Carregando...</div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Nenhuma reunião de liderança este mês</div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 264 }}>
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{cleanTitle(meeting.title)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {meeting.meetingTypeLabel} · {formatCalendarDate(meeting.startAt, meeting.isAllDay)}
                    </p>
                  </div>
                  {meeting.location && (
                    <p className="shrink-0 text-xs text-slate-400">{meeting.location}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barras: tempo médio aberta por tipo de reunião */}
        <div className="min-w-0 overflow-hidden rounded-lg bg-white p-4 shadow-md transition hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Tempo médio de tarefa aberta</h2>
          <p className="mb-4 text-sm text-slate-500">Por board do Trello · em dias</p>
          {loading ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Carregando...</div>
          ) : avgDaysOpen.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Sem tarefas no Trello</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <BarChart
                data={avgDaysOpen}
                barSize={36}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
                style={{ overflow: 'visible' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<AvgDaysTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                <Bar dataKey="dias" radius={[6, 6, 0, 0]}>
                  {avgDaysOpen.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
