import { useCallback, useEffect, useMemo, useState } from 'react'
import GenerateMinutesModal from '../components/GenerateMinutesModal'
import ScheduleMeetingModal from '../components/ScheduleMeetingModal'
import { useAuth } from '../hooks/useAuth'
import { createGoogleCalendarEvent, formatCalendarDate, isGoogleCalendarConfigured, listGoogleCalendarEvents } from '../services/googleCalendar'
import { listMeetingMinutes, listMeetingTypeOptions } from '../services/meetingMinutes'
import { getMeetingConfirmations, sendTelegramReminders } from '../services/telegram'

const defaultMeetingTypeOptions = [
  { value: '', label: 'Todos os tipos' },
]

function cleanTitle(title) {
  return (title || '').replace(/ - Carapicuiba Brazil Stake Atividades$/i, '').trim()
}

export default function MeetingsPage() {
  const { isConfigured, user } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [calendarMeetings, setCalendarMeetings] = useState([])
  const [meetingMinutes, setMeetingMinutes] = useState([])
  const [meetingTypeOptions, setMeetingTypeOptions] = useState(defaultMeetingTypeOptions)
  const [loading, setLoading] = useState(isConfigured || isGoogleCalendarConfigured)
  const [error, setError] = useState('')
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Telegram: mapa de eventId → { sending, confirmations }
  const [telegramState, setTelegramState] = useState({})

  async function handleSendReminders(meeting) {
    // Bloqueia envio para reuniões passadas
    const meetingDate = new Date(meeting.meeting_at ?? meeting.startAt)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (meetingDate < today) return
    setTelegramState((prev) => ({ ...prev, [meeting.id]: { sending: true, confirmations: prev[meeting.id]?.confirmations } }))
    try {
      const result = await sendTelegramReminders({
        organizationId: user.organizationId,
        googleEventId: meeting.id,
        title: meeting.title,
        meetingAt: meeting.startAt,
        meetingType: meeting.meetingType,
        meetingTypeLabel: meeting.meetingTypeLabel,
        location: meeting.location,
      })
      setSuccessMessage(`Lembretes enviados: ${result.sent} de ${result.total} destinatários com Telegram vinculado.${result.errors?.length ? ' Erros: ' + result.errors.join('; ') : ''}`)
      setTimeout(() => setSuccessMessage(''), 6000)
      // Carrega confirmações após envio
      const confirmations = await getMeetingConfirmations(user.organizationId, meeting.id)
      setTelegramState((prev) => ({ ...prev, [meeting.id]: { sending: false, confirmations } }))
    } catch (err) {
      setSuccessMessage('')
      setTelegramState((prev) => ({ ...prev, [meeting.id]: { sending: false, confirmations: prev[meeting.id]?.confirmations } }))
      alert(err.message || 'Erro ao enviar lembretes.')
    }
  }

  async function loadConfirmations(meetingId) {
    if (!user?.organizationId) return
    try {
      const confirmations = await getMeetingConfirmations(user.organizationId, meetingId)
      setTelegramState((prev) => ({ ...prev, [meetingId]: { ...prev[meetingId], confirmations } }))
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    listMeetingTypeOptions()
      .then((options) => {
        setMeetingTypeOptions([
          { value: '', label: 'Todos os tipos' },
          ...options,
        ])
      })
      .catch(() => { })
  }, [])

  const loadMeetings = useCallback(async () => {
    if (!isConfigured && !isGoogleCalendarConfigured) {
      setCalendarMeetings([])
      setMeetingMinutes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [calendarEvents, minutes] = await Promise.all([
        isGoogleCalendarConfigured
          ? listGoogleCalendarEvents({
            meetingType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            maxResults: 30,
          })
          : Promise.resolve([]),
        isConfigured
          ? listMeetingMinutes({
            meetingType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
          : Promise.resolve([]),
      ])

      setCalendarMeetings(calendarEvents)
      setMeetingMinutes(minutes)

      // Carrega confirmações de todas as reuniões do calendário
      if (user?.organizationId && calendarEvents.length > 0) {
        calendarEvents.forEach((meeting) => {
          getMeetingConfirmations(user.organizationId, meeting.id)
            .then((confirmations) => {
              if (confirmations.length > 0) {
                setTelegramState((prev) => ({ ...prev, [meeting.id]: { ...prev[meeting.id], confirmations } }))
              }
            })
            .catch(() => { })
        })
      }
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as reuniões.')
    } finally {
      setLoading(false)
    }
  }, [isConfigured, startDate, endDate, meetingType])

  useEffect(() => {
    void loadMeetings()
  }, [loadMeetings])

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setMeetingType('')
  }

  async function handleScheduleMeeting(payload) {
    await createGoogleCalendarEvent({ calendarId: 'primary', ...payload })
    setShowScheduleModal(false)
    setSuccessMessage('Reunião agendada com sucesso no Google Calendar!')
    setTimeout(() => setSuccessMessage(''), 6000)
    void loadMeetings()
  }

  const handleMinutesSuccess = (result) => {
    setSelectedMeeting(null)
    setSuccessMessage('Ata gerada com sucesso! O documento foi salvo no Google Drive.')
    setTimeout(() => setSuccessMessage(''), 6000)
    void loadMeetings()
  }

  // Mapa de google_event_id → registro de ata para cruzar com eventos do calendário
  const minuteByEventId = useMemo(() => {
    const map = {}
    for (const m of meetingMinutes) {
      if (m.google_event_id) map[m.google_event_id] = m
    }
    return map
  }, [meetingMinutes])

  const leadershipMeetingTypes = meetingTypeOptions
    .filter((opt) => opt.value && opt.value !== 'outras')
    .map((opt) => opt.value)

  const regularMeetings = calendarMeetings.filter(
    (meeting) => leadershipMeetingTypes.includes(meeting.meetingType),
  )

  const renderMeetingCards = (items, emptyMessage) => {
    if (loading) {
      return (
        <div className="rounded-lg border-l-4 border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Carregando reuniões...
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="rounded-lg border-l-4 border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
          {emptyMessage}
        </div>
      )
    }

    return items.map((meeting) => {
      const existingMinute = minuteByEventId[meeting.id]
      const tState = telegramState[meeting.id]
      const confirmations = tState?.confirmations || []
      const confirmed = confirmations.filter((c) => c.status === 'confirmed').length
      const declined = confirmations.filter((c) => c.status === 'declined').length
      const isAdmin = user?.role === 'admin'
      return (
        <div key={meeting.id} className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{cleanTitle(meeting.title)}</h3>
              <p className="mt-1 text-sm text-slate-500">{meeting.meetingTypeLabel}</p>
              <p className="mt-1 text-sm text-slate-500">Data: {formatCalendarDate(meeting.startAt, meeting.isAllDay)}</p>
              {meeting.location && <p className="mt-1 text-sm text-slate-500">Local: {meeting.location}</p>}
              {meeting.description && (
                <p className="mt-1 max-h-20 overflow-hidden text-sm text-slate-500">
                  Descrição: {meeting.description}
                </p>
              )}
              {confirmations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                    ✅ {confirmed} confirmado{confirmed !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-200">
                    ❌ {declined} recusou{declined !== 1 ? 'ram' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadConfirmations(meeting.id)}
                    className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
                  >
                    Atualizar
                  </button>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 md:items-end">
              {isAdmin && (() => {
                const meetingDate = new Date(meeting.meeting_at ?? meeting.startAt)
                const today = new Date(); today.setHours(0, 0, 0, 0)
                const isPast = meetingDate < today
                return (
                  <button
                    type="button"
                    onClick={() => handleSendReminders(meeting)}
                    disabled={tState?.sending || isPast}
                    title={isPast ? 'Não é possível enviar lembretes para reuniões passadas' : undefined}
                    className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {tState?.sending ? 'Enviando...' : '📨 Enviar lembretes'}
                  </button>
                )
              })()}
              {isConfigured && (
                existingMinute?.drive_file_url ? (
                  <a
                    href={existingMinute.drive_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Abrir ata
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedMeeting(meeting)}
                    title="Gerar ata desta reunião"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700"
                  >
                    + Gerar ata
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Reuniões</h1>
        <p className="mt-1 text-sm text-blue-100">
          Agende, pesquise e acompanhe suas reuniões de forma eficiente.
        </p>
      </div>

      {!isGoogleCalendarConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Google Calendar para exibir as reuniões automaticamente.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,160px)_minmax(0,160px)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de reunião</span>
            <select
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {meetingTypeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Data inicial</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Data final</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadMeetings()}
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {loading ? 'Carregando...' : `${regularMeetings.length} reunião(es)`}
        </span>
        {isGoogleCalendarConfigured && (
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Agendar nova reunião
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Próximas reuniões agendadas</h2>
          <p className="text-sm text-slate-500">Agenda oficial sincronizada do calendário.</p>
        </div>

        {renderMeetingCards(regularMeetings, 'Nenhuma reunião encontrada no Google Calendar.')}
      </div>

      {selectedMeeting && (
        <GenerateMinutesModal
          meeting={selectedMeeting}
          organizationId={user?.organizationId}
          onClose={() => setSelectedMeeting(null)}
          onSuccess={handleMinutesSuccess}
        />
      )}

      {showScheduleModal && (
        <ScheduleMeetingModal
          meetingTypeOptions={meetingTypeOptions}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={handleScheduleMeeting}
        />
      )}
    </div>
  )
}
