import { useCallback, useEffect, useState } from 'react'
import {
    cancelGoogleCalendarEvent,
    createGoogleCalendarEvent,
    formatCalendarDate,
    interviewModeOptions,
    interviewNatureOptions,
    isGoogleCalendarConfigured,
    listGoogleCalendarEvents,
    parseCalendarDate,
    stakePresidencyInterviewerOptions,
    updateGoogleCalendarEvent,
} from '../services/googleCalendar'

function statusClasses(status) {
    switch (status) {
        case 'ready':
            return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        case 'processing':
            return 'bg-amber-50 text-amber-700 ring-amber-200'
        case 'failed':
            return 'bg-red-50 text-red-700 ring-red-200'
        default:
            return 'bg-blue-50 text-blue-700 ring-blue-200'
    }
}

function formatBookingDetails(value) {
    if (!value) {
        return ''
    }

    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .trim()
}

function openExternalLink(url) {
    if (!url || typeof window === 'undefined') {
        return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
}

function getOptionLabel(options, value, fallback = '') {
    return options.find((item) => item.value === value)?.label || fallback
}

function toDateInputValue(value) {
    const parsed = parseCalendarDate(value)

    if (!parsed) {
        return ''
    }

    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function toTimeInputValue(value) {
    const parsed = parseCalendarDate(value)

    if (!parsed) {
        return ''
    }

    const hours = String(parsed.getHours()).padStart(2, '0')
    const minutes = String(parsed.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

function toIsoFromInput(dateValue, timeValue) {
    const [year, month, day] = (dateValue || '').split('-').map(Number)
    const [hours, minutes] = (timeValue || '00:00').split(':').map(Number)

    if (!year || !month || !day) {
        return null
    }

    return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0).toISOString()
}

function sanitizeBrazilianName(value) {
    return value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s'-]/g, '')
}

function maskBrazilianPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits.length ? `(${digits}` : ''
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function buildInterviewForm(meeting) {
    return {
        interviewer: meeting?.interviewer || stakePresidencyInterviewerOptions[0]?.value || '',
        intervieweeName: meeting?.intervieweeName || '',
        phone: meeting?.phone || '',
        interviewNature: meeting?.interviewNature || interviewNatureOptions[0]?.value || '',
        attendanceMode:
            meeting?.attendanceMode || (/on-line|online/i.test(meeting?.location || '') ? 'online' : 'presencial'),
        startDate: toDateInputValue(meeting?.startAt),
        startTime: toTimeInputValue(meeting?.startAt) || '19:00',
        endTime: toTimeInputValue(meeting?.endAt) || '19:30',
        notes: meeting?.notes || '',
    }
}

export default function InterviewsPage() {
    const [meetingDate, setMeetingDate] = useState('')
    const [interviewerFilter, setInterviewerFilter] = useState('')
    const [interviews, setInterviews] = useState([])
    const [loading, setLoading] = useState(isGoogleCalendarConfigured)
    const [error, setError] = useState('')
    const [activeEventId, setActiveEventId] = useState('')
    const [editingMeeting, setEditingMeeting] = useState(null)
    const [interviewForm, setInterviewForm] = useState(buildInterviewForm())
    const [meetingToCancel, setMeetingToCancel] = useState(null)
    const [isFormModalOpen, setIsFormModalOpen] = useState(false)

    const loadInterviews = useCallback(async () => {
        if (!isGoogleCalendarConfigured) {
            setInterviews([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError('')

        try {
            const calendarEvents = await listGoogleCalendarEvents({
                meetingType: 'entrevista_presidencia_estaca',
                startDate: meetingDate || undefined,
                endDate: meetingDate || undefined,
                interviewer: interviewerFilter || undefined,
                maxResults: 50,
            })

            setInterviews(calendarEvents)
        } catch (err) {
            setError(err.message || 'Não foi possível carregar as entrevistas.')
        } finally {
            setLoading(false)
        }
    }, [interviewerFilter, meetingDate])

    useEffect(() => {
        void loadInterviews()
    }, [loadInterviews])

    const handleOpenNewInterview = () => {
        setError('')
        setEditingMeeting(null)
        setInterviewForm(buildInterviewForm())
        setIsFormModalOpen(true)
    }

    const handleEditInterview = (meeting) => {
        setError('')
        setEditingMeeting(meeting)
        setInterviewForm(buildInterviewForm(meeting))
        setIsFormModalOpen(true)
    }

    const closeInterviewModal = () => {
        setIsFormModalOpen(false)
        setEditingMeeting(null)
        setInterviewForm(buildInterviewForm())
    }

    const handleInterviewFormChange = (field, value) => {
        setInterviewForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    const buildInterviewPayload = () => {
        const interviewerLabel = getOptionLabel(stakePresidencyInterviewerOptions, interviewForm.interviewer)
        const natureLabel = getOptionLabel(interviewNatureOptions, interviewForm.interviewNature)
        const attendanceLabel = getOptionLabel(interviewModeOptions, interviewForm.attendanceMode)

        return {
            summary: `Entrevista - ${interviewForm.intervieweeName.trim()} (${natureLabel})`,
            description: [
                'Entrevista com a Presidência da Estaca',
                `Entrevistado: ${interviewForm.intervieweeName.trim()}`,
                `Telefone: ${interviewForm.phone.trim()}`,
                `Entrevistador: ${interviewerLabel}`,
                `Natureza: ${natureLabel}`,
                `Modalidade: ${attendanceLabel}`,
                interviewForm.notes.trim() ? `Observações: ${interviewForm.notes.trim()}` : null,
            ]
                .filter(Boolean)
                .join('\n'),
            location: attendanceLabel,
            interviewer: interviewForm.interviewer,
            intervieweeName: interviewForm.intervieweeName.trim(),
            phone: interviewForm.phone.trim(),
            interviewNature: interviewForm.interviewNature,
            attendanceMode: interviewForm.attendanceMode,
            notes: interviewForm.notes.trim(),
        }
    }

    const submitInterviewForm = async (event) => {
        event.preventDefault()

        const requiredFields = [
            interviewForm.interviewer,
            interviewForm.intervieweeName.trim(),
            interviewForm.phone.trim(),
            interviewForm.interviewNature,
            interviewForm.attendanceMode,
            interviewForm.startDate,
            interviewForm.startTime,
            interviewForm.endTime,
        ]

        if (requiredFields.some((field) => !field)) {
            setError('Preencha todos os campos obrigatórios para salvar a entrevista.')
            return
        }

        const startAt = toIsoFromInput(interviewForm.startDate, interviewForm.startTime)
        const endAt = toIsoFromInput(interviewForm.startDate, interviewForm.endTime)

        if (!startAt || !endAt) {
            setError('Informe datas e horários válidos para a entrevista.')
            return
        }

        if (new Date(endAt) <= new Date(startAt)) {
            setError('O término da entrevista precisa ser depois do início.')
            return
        }

        const activeId = editingMeeting?.id || 'new-interview'
        setActiveEventId(activeId)
        setError('')

        try {
            const payload = {
                calendarId: editingMeeting?.sourceCalendarId || 'primary',
                startAt,
                endAt,
                ...buildInterviewPayload(),
            }

            if (editingMeeting) {
                await updateGoogleCalendarEvent({
                    ...payload,
                    eventId: editingMeeting.id,
                })
            } else {
                await createGoogleCalendarEvent(payload)
            }

            closeInterviewModal()
            await loadInterviews()
        } catch (err) {
            setError(err.message || 'Não foi possível salvar a entrevista.')
        } finally {
            setActiveEventId('')
        }
    }

    const handleCancelInterview = (meeting) => {
        setError('')
        setMeetingToCancel(meeting)
    }

    const confirmCancelInterview = async () => {
        if (!meetingToCancel) {
            return
        }

        setActiveEventId(meetingToCancel.id)
        setError('')

        try {
            await cancelGoogleCalendarEvent({
                calendarId: meetingToCancel.sourceCalendarId || 'primary',
                eventId: meetingToCancel.id,
            })

            setMeetingToCancel(null)
            await loadInterviews()
        } catch (err) {
            setError(err.message || 'Não foi possível cancelar o agendamento.')
        } finally {
            setActiveEventId('')
        }
    }

    const handleClearFilters = () => {
        setMeetingDate('')
        setInterviewerFilter('')
    }

    const isSavingInterview = activeEventId === (editingMeeting?.id || 'new-interview')

    return (
        <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 shadow-lg">
                <h1 className="text-2xl font-bold text-white">Entrevistas</h1>
                <p className="mt-1 text-sm text-blue-100">
                    Agende, filtre e acompanhe entrevistas da Presidência da Estaca em um só lugar.
                </p>
            </div>

            {!isGoogleCalendarConfigured && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Configure o Google Calendar para exibir e agendar as entrevistas automaticamente.
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="rounded-lg bg-white p-4 shadow-md">
                <div className="grid gap-4 xl:grid-cols-[180px_1fr_auto] xl:items-end xl:justify-between">
                    <label className="block min-w-0">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Filtrar por data</span>
                        <input
                            type="date"
                            value={meetingDate}
                            onChange={(event) => setMeetingDate(event.target.value)}
                            className="w-full max-w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Quem realizará a entrevista</span>
                        <select
                            value={interviewerFilter}
                            onChange={(event) => setInterviewerFilter(event.target.value)}
                            className="w-full min-w-[280px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="">Todos</option>
                            {stakePresidencyInterviewerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                        <button
                            type="button"
                            onClick={() => void loadInterviews()}
                            disabled={loading}
                            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Atualizar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {loading ? 'Sincronizando...' : `${interviews.length} entrevista(s)`}
                </span>
                <button
                    type="button"
                    onClick={handleOpenNewInterview}
                    className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                    Agendar nova entrevista
                </button>
            </div>

            <div className="space-y-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Próximas entrevistas</h2>
                    <p className="text-sm text-slate-500">Compromissos sincronizados com o calendário principal.</p>
                </div>

                {loading ? (
                    <div className="rounded-lg bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-md">
                        Carregando entrevistas...
                    </div>
                ) : interviews.length === 0 ? (
                    <div className="rounded-lg bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-md">
                        Nenhuma entrevista encontrada para os filtros selecionados.
                    </div>
                ) : (
                    interviews.map((meeting) => {
                        const details = meeting.notes || (
                            meeting.description?.includes('Entrevista com a Presidência da Estaca')
                                ? ''
                                : formatBookingDetails(meeting.description)
                        )

                        return (
                            <div key={meeting.id} className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">
                                                {meeting.intervieweeName || meeting.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500">{meeting.interviewNatureLabel}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entrevistador</p>
                                            <p className="mt-1 text-sm text-slate-700">{meeting.interviewerLabel}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modalidade</p>
                                            <p className="mt-1 text-sm text-slate-700">{meeting.attendanceModeLabel}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Início</p>
                                            <p className="mt-1 text-sm text-slate-700">{formatCalendarDate(meeting.startAt, meeting.isAllDay)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Término</p>
                                            <p className="mt-1 text-sm text-slate-700">{formatCalendarDate(meeting.endAt, meeting.isAllDay)}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 text-sm text-slate-600">
                                        <span><strong>Telefone:</strong> {meeting.phone || 'Não informado'}</span>
                                    </div>

                                    {details && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observações</p>
                                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{details}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditInterview(meeting)}
                                            disabled={activeEventId === meeting.id}
                                            className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {activeEventId === meeting.id ? 'Salvando...' : 'Editar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCancelInterview(meeting)}
                                            disabled={activeEventId === meeting.id}
                                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {activeEventId === meeting.id ? 'Cancelando...' : 'Cancelar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900">
                                    {editingMeeting ? 'Editar entrevista' : 'Nova entrevista'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Preencha os dados abaixo para salvar a entrevista no calendário principal.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submitInterviewForm} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Quem fará a entrevista</span>
                                    <select
                                        value={interviewForm.interviewer}
                                        onChange={(event) => handleInterviewFormChange('interviewer', event.target.value)}
                                        className="w-full min-w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    >
                                        {stakePresidencyInterviewerOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Natureza da entrevista</span>
                                    <select
                                        value={interviewForm.interviewNature}
                                        onChange={(event) => handleInterviewFormChange('interviewNature', event.target.value)}
                                        className="w-full min-w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    >
                                        {interviewNatureOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Nome de quem será entrevistado</span>
                                    <input
                                        type="text"
                                        value={interviewForm.intervieweeName}
                                        onChange={(event) => handleInterviewFormChange('intervieweeName', sanitizeBrazilianName(event.target.value))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Telefone</span>
                                    <input
                                        type="tel"
                                        value={interviewForm.phone}
                                        onChange={(event) => handleInterviewFormChange('phone', maskBrazilianPhone(event.target.value))}
                                        placeholder="(00) 00000-0000"
                                        maxLength={15}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    />
                                </label>
                            </div>

                            <fieldset>
                                <legend className="mb-2 block text-sm font-medium text-slate-700">Modalidade</legend>
                                <div className="flex flex-wrap gap-3">
                                    {interviewModeOptions.map((option) => (
                                        <label
                                            key={option.value}
                                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                        >
                                            <input
                                                type="radio"
                                                name="attendanceMode"
                                                value={option.value}
                                                checked={interviewForm.attendanceMode === option.value}
                                                onChange={(event) => handleInterviewFormChange('attendanceMode', event.target.value)}
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="block min-w-0">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Data da entrevista</span>
                                    <input
                                        type="date"
                                        value={interviewForm.startDate}
                                        onChange={(event) => handleInterviewFormChange('startDate', event.target.value)}
                                        className="w-full max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Hora de início</span>
                                    <input
                                        type="time"
                                        value={interviewForm.startTime}
                                        onChange={(event) => handleInterviewFormChange('startTime', event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Hora de término</span>
                                    <input
                                        type="time"
                                        value={interviewForm.endTime}
                                        onChange={(event) => handleInterviewFormChange('endTime', event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        required
                                    />
                                </label>
                            </div>

                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Observações</span>
                                <textarea
                                    value={interviewForm.notes}
                                    onChange={(event) => handleInterviewFormChange('notes', event.target.value)}
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Campo opcional"
                                />
                            </label>

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeInterviewModal}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingInterview}
                                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSavingInterview ? 'Salvando...' : editingMeeting ? 'Salvar alterações' : 'Agendar entrevista'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {meetingToCancel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
                        <h3 className="text-xl font-semibold text-slate-900">Confirmar cancelamento</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Tem certeza que deseja cancelar a entrevista de <strong>{meetingToCancel.intervieweeName || meetingToCancel.title}</strong>?
                        </p>
                        <p className="mt-1 text-sm text-slate-500">Essa ação removerá o agendamento do calendário principal.</p>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setMeetingToCancel(null)}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmCancelInterview()}
                                disabled={activeEventId === meetingToCancel.id}
                                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {activeEventId === meetingToCancel.id ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
