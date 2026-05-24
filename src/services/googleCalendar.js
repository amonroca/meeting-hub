import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export const isGoogleCalendarConfigured = isSupabaseConfigured

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

export const stakePresidencyInterviewerOptions = [
  { value: 'presidente_estaca_sidney_ataide', label: 'Presidente da Estaca - Sidney Ataíde' },
  { value: 'primeiro_conselheiro_rodrigo_pinheiro', label: 'Primeiro Conselheiro - Rodrigo Pinheiro' },
  { value: 'segundo_conselheiro_denilson_rodrigues', label: 'Segundo Conselheiro - Denilson Rodrigues' },
]

export const interviewNatureOptions = [
  { value: 'renovacao_recomendacao_templo', label: 'Renovação de Recomendação para o templo' },
  { value: 'primeira_recomendacao_templo', label: 'Primeira Recomendação para o templo' },
  { value: 'entrevista_missao_tempo_integral', label: 'Entrevista para missão de tempo integral' },
  { value: 'entrevista_missao_servico', label: 'Entrevista para missão de serviço' },
  { value: 'entrevista_para_chamado', label: 'Entrevista para chamado' },
  { value: 'outros', label: 'Outros' },
]

export const interviewModeOptions = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'On-line' },
]

const meetingTypeMap = [
  {
    value: 'entrevista_presidencia_estaca',
    label: 'Entrevista com a Presidência da Estaca',
    keywords: [
      'entrevista com a presidência da estaca',
      'entrevista com a presidencia da estaca',
      'calendário de entrevista',
      'calendario de entrevista',
    ],
  },
  {
    value: 'sumo_conselho_estaca',
    label: 'Reunião do Sumo Conselho da Estaca',
    keywords: ['sumo conselho', 'sumo conselho da estaca', 'high council', 'reunião do sumo conselho', 'reuniao do sumo conselho'],
  },
  {
    value: 'conselho_estaca',
    label: 'Reunião de Conselho da Estaca',
    keywords: ['conselho da estaca', 'conselho estaca', 'stake council', 'reunião de conselho', 'reuniao de conselho'],
  },
  {
    value: 'coordenacao_missionaria_estaca',
    label: 'Reunião de Coordenação Missionária da Estaca',
    keywords: [
      'coordenação missionária',
      'coordenacao missionaria',
      'missionária da estaca',
      'missionaria da estaca',
      'coordenação missionária da estaca',
      'coordenacao missionaria da estaca',
      'missionary coordination',
    ],
  },
  {
    value: 'presidencia_estaca',
    label: 'Reunião de Presidência da Estaca',
    keywords: ['presidência da estaca', 'presidencia da estaca', 'stake presidency', 'reunião de presidência', 'reuniao de presidencia'],
  },
]

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getOptionLabel(options, value, fallback = '') {
  return options.find((item) => item.value === value)?.label || fallback
}

function getOptionValueFromLabel(options, label = '') {
  const normalized = normalizeText(label)
  return options.find((item) => normalizeText(item.label) === normalized)?.value || ''
}

function inferMeetingType(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase()

  if (/confer[eê]ncia\s+(de\s+|da\s+)?(ala|estaca)/i.test(text)) {
    return {
      value: 'outras',
      label: 'Outras Reuniões',
    }
  }

  const matched = meetingTypeMap.find((item) => item.keywords.some((keyword) => text.includes(keyword)))

  if (matched) {
    return {
      value: matched.value,
      label: matched.label,
    }
  }

  return {
    value: 'outras',
    label: 'Outras Reuniões',
  }
}

function toDateValue(event) {
  return event.start?.dateTime || event.start?.date || null
}

function extractValueFromDescription(description, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(description || '').match(new RegExp(`${escapedLabel}:\\s*(.+)`, 'i'))
  return match?.[1]?.trim() || ''
}

function parseInterviewMetadata(event = {}) {
  const privateData = event.extendedProperties?.private || {}
  const description = String(event.description || '')
  const location = String(event.location || '')

  const interviewer = String(
    privateData.interviewer ||
    getOptionValueFromLabel(stakePresidencyInterviewerOptions, extractValueFromDescription(description, 'Entrevistador')),
  )

  const interviewNature = String(
    privateData.interviewNature ||
    getOptionValueFromLabel(interviewNatureOptions, extractValueFromDescription(description, 'Natureza')),
  )

  const attendanceMode = String(
    privateData.attendanceMode ||
    getOptionValueFromLabel(interviewModeOptions, extractValueFromDescription(description, 'Modalidade')) ||
    (/on-line|online/i.test(location) ? 'online' : location ? 'presencial' : ''),
  )

  return {
    interviewer,
    intervieweeName: String(privateData.intervieweeName || extractValueFromDescription(description, 'Entrevistado') || ''),
    phone: String(privateData.phone || extractValueFromDescription(description, 'Telefone') || ''),
    interviewNature,
    attendanceMode,
    notes: String(privateData.notes || extractValueFromDescription(description, 'Observações') || ''),
  }
}

export function parseCalendarDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' && dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0, 0)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatCalendarDate(value, isAllDay = false) {
  const parsed = parseCalendarDate(value)

  if (!parsed) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', isAllDay ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

export function isCalendarDateToday(value) {
  const parsed = parseCalendarDate(value)

  if (!parsed) {
    return false
  }

  const today = new Date()

  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  )
}

function mapEvent(event) {
  const metadata = parseInterviewMetadata(event)
  const inferredType = inferMeetingType(event.summary, event.description)
  const isInterview = Boolean(metadata.interviewer || metadata.intervieweeName) || inferredType.value === 'entrevista_presidencia_estaca'
  const meetingType = isInterview
    ? { value: 'entrevista_presidencia_estaca', label: 'Entrevista com a Presidência da Estaca' }
    : inferredType
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)

  return {
    id: event.id,
    title: event.summary || 'Sem título',
    description: event.description || '',
    location: event.location || '',
    htmlLink: event.htmlLink || '',
    status: event.status || 'confirmed',
    startAt: toDateValue(event),
    endAt: event.end?.dateTime || event.end?.date || null,
    isAllDay,
    meetingType: meetingType.value,
    meetingTypeLabel: meetingType.label,
    organizerEmail: event.organizer?.email || '',
    sourceCalendar: event._sourceCalendarSummary || '',
    sourceCalendarId: event._sourceCalendarId || 'primary',
    interviewer: metadata.interviewer,
    interviewerLabel: getOptionLabel(stakePresidencyInterviewerOptions, metadata.interviewer, 'Não informado'),
    intervieweeName: metadata.intervieweeName,
    phone: metadata.phone,
    interviewNature: metadata.interviewNature,
    interviewNatureLabel: getOptionLabel(interviewNatureOptions, metadata.interviewNature, 'Não informado'),
    attendanceMode: metadata.attendanceMode,
    attendanceModeLabel: getOptionLabel(interviewModeOptions, metadata.attendanceMode, event.location || 'Não informado'),
    notes: metadata.notes,
  }
}

async function invokeGoogleCalendarAction(payload = {}) {
  if (!isGoogleCalendarConfigured) {
    throw new Error('Google Calendar não configurado.')
  }

  const client = getSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  const { data, error } = await client.functions.invoke('google-calendar-events', {
    headers: session?.access_token
      ? {
        Authorization: `Bearer ${session.access_token}`,
      }
      : undefined,
    body: payload,
  })

  if (error) {
    const details = await error.context?.json?.().catch(() => null)
    const message = [details?.error, details?.details, error.message].filter(Boolean).join(' ')

    throw new Error(message || 'Não foi possível executar a ação no Google Calendar.')
  }

  return data
}

export async function listGoogleCalendarEvents(filters = {}) {
  if (!isGoogleCalendarConfigured) {
    return []
  }

  const client = getSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  const { data, error } = await client.functions.invoke('google-calendar-events', {
    headers: session?.access_token
      ? {
        Authorization: `Bearer ${session.access_token}`,
      }
      : undefined,
    body: {
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      maxResults: filters.maxResults || 20,
    },
  })

  if (error) {
    const details = await error.context?.json?.().catch(() => null)
    const message = [details?.error, details?.details, error.message].filter(Boolean).join(' ')

    throw new Error(message || 'Não foi possível carregar os eventos do Google Calendar.')
  }

  let items = (data?.items || []).map(mapEvent)

  if (filters.meetingType) {
    items = items.filter((item) => item.meetingType === filters.meetingType)
  }

  if (filters.interviewer) {
    items = items.filter((item) => item.interviewer === filters.interviewer)
  }

  return items
}

export async function createGoogleCalendarEvent(payload = {}) {
  const data = await invokeGoogleCalendarAction({
    action: 'createEvent',
    ...payload,
  })

  return data?.item ? mapEvent(data.item) : null
}

export async function updateGoogleCalendarEvent(payload = {}) {
  const data = await invokeGoogleCalendarAction({
    action: 'updateEvent',
    ...payload,
  })

  return data?.item ? mapEvent(data.item) : null
}

export async function cancelGoogleCalendarEvent(payload = {}) {
  return invokeGoogleCalendarAction({
    action: 'cancelEvent',
    ...payload,
  })
}
