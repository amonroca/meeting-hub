import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { formatCalendarDate } from '../services/googleCalendar'
import { getTrelloTasks, deleteTrelloCard } from '../services/meetingMinutes'
import EditTaskModal from '../components/EditTaskModal'
import ViewTaskModal from '../components/ViewTaskModal'

const MEETING_TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'conselho_estaca', label: 'Reunião de Conselho da Estaca' },
  { value: 'coordenacao_missionaria_estaca', label: 'Reunião de Coordenação Missionária da Estaca' },
  { value: 'presidencia_estaca', label: 'Reunião de Presidência da Estaca' },
  { value: 'sumo_conselho_estaca', label: 'Reunião do Sumo Conselho da Estaca' },
  { value: 'outras', label: 'Outras Reuniões' },
]

function statusClasses(status) {
  if (!status) return 'bg-slate-100 text-slate-500 ring-slate-200'
  const lower = status.toLowerCase()
  if (lower.includes('conclu') || lower.includes('done') || lower.includes('pronto')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (lower.includes('andamento') || lower.includes('doing') || lower.includes('progresso')) {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const loadTasks = useCallback(() => {
    if (!user?.organizationId) return
    setLoading(true)
    setError('')
    getTrelloTasks(user.organizationId)
      .then(setTasks)
      .catch((err) => setError(err.message || 'Erro ao carregar tarefas.'))
      .finally(() => setLoading(false))
  }, [user?.organizationId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Status únicos para o filtro
  const statusOptions = useMemo(() => {
    const unique = [...new Set(tasks.map((t) => t.status).filter(Boolean))]
    return unique.sort()
  }, [tasks])

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus && task.status !== filterStatus) return false
      if (filterType && task.meetingType !== filterType) return false
      if (filterStartDate) {
        const taskDate = new Date(task.meetingAt)
        const start = new Date(filterStartDate)
        start.setHours(0, 0, 0, 0)
        if (taskDate < start) return false
      }
      if (filterEndDate) {
        const taskDate = new Date(task.meetingAt)
        const end = new Date(filterEndDate)
        end.setHours(23, 59, 59, 999)
        if (taskDate > end) return false
      }
      return true
    })
  }, [tasks, filterStatus, filterType, filterStartDate, filterEndDate])

  const [editingTask, setEditingTask] = useState(null)
  const [viewingTask, setViewingTask] = useState(null)

  function handleSaveTask(updatedTask) {
    setTasks((prev) => prev.map((t) => t.id === updatedTask.id ? updatedTask : t))
    setEditingTask(null)
  }

  function handleDeleteTask(taskId) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setViewingTask(null)
  }

  function handleNotifyTask(taskId, newCount) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, notificationsCount: newCount } : t))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Tarefas</h1>
        <p className="mt-1 text-sm text-blue-100">
          Sincronizadas em tempo real com o Trello.
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,180px)_2fr_minmax(0,150px)_minmax(0,150px)_auto] lg:items-end">
          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Status (lista Trello)</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Todos os status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Tipo de reunião */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo de reunião</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {MEETING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data inicial */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Data inicial</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Data final */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Data final</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadTasks}
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus('')
                setFilterType('')
                setFilterStartDate('')
                setFilterEndDate('')
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {loading ? 'Carregando...' : `${filteredTasks.length} tarefa(s)`}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="rounded-lg bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-md">
          Sincronizando com o Trello...
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-6 text-center text-sm text-red-700 border border-red-200">
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-lg bg-white px-4 py-12 text-center text-sm text-slate-600 shadow-md">
          {tasks.length === 0
            ? 'Nenhuma tarefa encontrada. As tarefas aparecem aqui quando atas com a seção ## Tarefas são geradas com o Trello configurado.'
            : 'Nenhuma tarefa corresponde aos filtros selecionados.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div key={`${task.minuteId}-${task.id}`} className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{task.name}</h2>
                    {task.status ? (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusClasses(task.status)}`}>
                        {task.status}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                        Sem status
                      </span>
                    )}                    {/* Contador: dias em aberto */}
                    {task.daysOpen != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200" title="Dias em aberto">
                        ⏱ {task.daysOpen}d
                      </span>
                    )}
                    {/* Contador: notificações enviadas */}
                    {task.notificationsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200" title="Notificações enviadas">
                        📨 {task.notificationsCount}
                      </span>
                    )}                  </div>
                  {task.responsible && (
                    <p className="mt-1 text-sm text-slate-500">Responsável: {task.responsible}</p>
                  )}
                  {/*{task.description && (
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{task.description}</p>
                  )}*/}
                  <p className="mt-1 text-xs text-slate-400">
                    {task.meetingTypeLabel} · {formatCalendarDate(task.meetingAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingTask(task)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Detalhes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTask(task)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  {task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Ver no Trello
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingTask && (
        <ViewTaskModal
          task={viewingTask}
          organizationId={user.organizationId}
          onClose={() => setViewingTask(null)}
          onDelete={handleDeleteTask}
          onNotify={handleNotifyTask}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          organizationId={user.organizationId}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
        />
      )}
    </div>
  )
}