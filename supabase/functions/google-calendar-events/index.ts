/// <reference path="./types.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function startOfDay(dateString?: string | null) {
  const date = dateString ? new Date(dateString) : new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(dateString?: string | null) {
  const date = dateString ? new Date(dateString) : new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

function defaultEndRange() {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  date.setHours(23, 59, 59, 999)
  return date
}

function buildOAuthParams() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
  const username = Deno.env.get('GOOGLE_OAUTH_USERNAME')
  const password = Deno.env.get('GOOGLE_OAUTH_PASSWORD')
  const scope = Deno.env.get('GOOGLE_OAUTH_SCOPE') || 'https://www.googleapis.com/auth/calendar'
  const grantType = Deno.env.get('GOOGLE_OAUTH_GRANT_TYPE') || 'password'

  if (!clientId || !clientSecret) {
    throw new Error('As secrets GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórias.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  })

  if (refreshToken) {
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', refreshToken)
    return params
  }

  if (username && password) {
    params.set('grant_type', grantType)
    params.set('username', username)
    params.set('password', password)
    params.set('scope', scope)
    return params
  }

  throw new Error(
    'Configure GOOGLE_REFRESH_TOKEN ou GOOGLE_OAUTH_USERNAME/GOOGLE_OAUTH_PASSWORD nas secrets da função.',
  )
}

function handleGoogleApiError(details: string, calendarId: string, action: string) {
  const normalizedDetails = details.toLowerCase()

  if (
    normalizedDetails.includes('insufficient authentication scopes') ||
    normalizedDetails.includes('access_token_scope_insufficient') ||
    normalizedDetails.includes('insufficientpermissions')
  ) {
    throw new Error(
      `O token do Google não tem permissão para ${action}. Gere um novo refresh token com o escopo https://www.googleapis.com/auth/calendar e atualize a secret GOOGLE_REFRESH_TOKEN no Supabase.`,
    )
  }

  throw new Error(`Falha ao ${action} no Google Calendar para ${calendarId}. ${details}`)
}

async function fetchCalendarEvents(calendarId: string, accessToken: string, payload: Record<string, unknown>) {
  const timeMin = startOfDay(payload.startDate as string | null | undefined).toISOString()
  const timeMax = payload.startDate || payload.endDate
    ? endOfDay((payload.endDate || payload.startDate) as string).toISOString()
    : defaultEndRange().toISOString()

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(payload.maxResults || 20),
    timeMin,
    timeMax,
  })

  const eventsResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!eventsResponse.ok) {
    const details = await eventsResponse.text()
    handleGoogleApiError(details, calendarId, 'consultar eventos')
  }

  const events = await eventsResponse.json()
  const items = (events.items || []).map((item: Record<string, unknown>) => ({
    ...item,
    _sourceCalendarId: calendarId,
    _sourceCalendarSummary: events.summary || calendarId,
  }))

  return {
    calendarId,
    summary: events.summary || calendarId,
    items,
  }
}

function buildCalendarEventBody(payload: Record<string, unknown>) {
  const body: Record<string, unknown> = {}

  if (typeof payload.summary === 'string') {
    body.summary = payload.summary
  }

  if (typeof payload.description === 'string') {
    body.description = payload.description
  }

  if (typeof payload.location === 'string') {
    body.location = payload.location
  }

  if (payload.startAt) {
    body.start = {
      dateTime: String(payload.startAt),
      timeZone: 'America/Sao_Paulo',
    }
  }

  if (payload.endAt) {
    body.end = {
      dateTime: String(payload.endAt),
      timeZone: 'America/Sao_Paulo',
    }
  }

  const metadataKeys = ['meetingType', 'interviewer', 'intervieweeName', 'phone', 'interviewNature', 'attendanceMode', 'notes']
  const privateMetadata = Object.fromEntries(
    metadataKeys
      .filter((key) => typeof payload[key] === 'string' && String(payload[key]).trim())
      .map((key) => [key, String(payload[key])]),
  )

  if (Object.keys(privateMetadata).length > 0) {
    body.extendedProperties = {
      private: privateMetadata,
    }
  }

  return body
}

async function createCalendarEvent(calendarId: string, accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCalendarEventBody(payload)),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    handleGoogleApiError(details, calendarId, 'criar a entrevista')
  }

  const item = await response.json()
  return {
    ...item,
    _sourceCalendarId: calendarId,
    _sourceCalendarSummary: calendarId,
  }
}

async function updateCalendarEvent(calendarId: string, eventId: string, accessToken: string, payload: Record<string, unknown>) {
  const body = buildCalendarEventBody(payload)

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    handleGoogleApiError(details, calendarId, 'atualizar o agendamento')
  }

  const item = await response.json()
  return {
    ...item,
    _sourceCalendarId: calendarId,
    _sourceCalendarSummary: calendarId,
  }
}

async function cancelCalendarEvent(calendarId: string, eventId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    const details = await response.text()
    handleGoogleApiError(details, calendarId, 'cancelar o agendamento')
  }

  return {
    success: true,
    eventId,
    calendarId,
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await request.json().catch(() => ({}))
    const rawCalendarIds = Deno.env.get('GOOGLE_CALENDAR_ID')
    const tokenUrl =
      Deno.env.get('GOOGLE_OAUTH_TOKEN_URL') ||
      Deno.env.get('GOOGLE_TOKEN_URI') ||
      'https://oauth2.googleapis.com/token'

    if (!rawCalendarIds) {
      return jsonResponse({ error: 'Secret GOOGLE_CALENDAR_ID não configurada.' }, 500)
    }

    const calendarIds = Array.from(
      new Set(
        ['primary', ...rawCalendarIds.split(/[\n,;]+/)]
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    )

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildOAuthParams().toString(),
    })

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text()
      return jsonResponse(
        {
          error: 'Falha ao obter token OAuth do Google.',
          details,
        },
        502,
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return jsonResponse({ error: 'Resposta OAuth sem access_token.' }, 502)
    }

    if (payload.action === 'createEvent') {
      const calendarId = String(payload.calendarId || 'primary')
      const item = await createCalendarEvent(calendarId, accessToken, payload)
      return jsonResponse({ item })
    }

    if (payload.action === 'updateEvent') {
      const eventId = String(payload.eventId || '')
      const calendarId = String(payload.calendarId || 'primary')

      if (!eventId) {
        return jsonResponse({ error: 'eventId é obrigatório para atualizar o agendamento.' }, 400)
      }

      const item = await updateCalendarEvent(calendarId, eventId, accessToken, payload)
      return jsonResponse({ item })
    }

    if (payload.action === 'cancelEvent') {
      const eventId = String(payload.eventId || '')
      const calendarId = String(payload.calendarId || 'primary')

      if (!eventId) {
        return jsonResponse({ error: 'eventId é obrigatório para cancelar o agendamento.' }, 400)
      }

      const result = await cancelCalendarEvent(calendarId, eventId, accessToken)
      return jsonResponse(result)
    }

    const calendarResults = await Promise.allSettled(
      calendarIds.map((calendarId) => fetchCalendarEvents(calendarId, accessToken, payload)),
    )

    const successfulResults = calendarResults
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchCalendarEvents>>> => result.status === 'fulfilled')
      .map((result) => result.value)

    if (successfulResults.length === 0) {
      const firstError = calendarResults.find((result) => result.status === 'rejected')
      throw new Error(firstError?.status === 'rejected' ? String(firstError.reason?.message || firstError.reason) : 'Falha ao consultar eventos no Google Calendar.')
    }

    const items = Array.from(
      new Map(
        successfulResults
          .flatMap((result) => result.items)
          .map((item) => [String((item as { id?: string }).id || crypto.randomUUID()), item]),
      ).values(),
    ).sort((left, right) => {
      const leftStart = String((left as { start?: { dateTime?: string; date?: string } }).start?.dateTime || (left as { start?: { dateTime?: string; date?: string } }).start?.date || '')
      const rightStart = String((right as { start?: { dateTime?: string; date?: string } }).start?.dateTime || (right as { start?: { dateTime?: string; date?: string } }).start?.date || '')
      return leftStart.localeCompare(rightStart)
    })

    return jsonResponse({
      items,
      calendars: successfulResults.map((result) => ({
        id: result.calendarId,
        summary: result.summary,
      })),
    })
  } catch (error) {
    console.error(error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Erro inesperado na integração.',
      },
      500,
    )
  }
})
