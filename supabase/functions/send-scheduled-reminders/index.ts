/// <reference path="./types.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * send-scheduled-reminders
 *
 * Chamada pelo pg_cron às 14h (horário de Brasília = 17h UTC).
 * Em cada execução processa dois lotes:
 *   - 4 dias à frente: lembrete padrão com pedido de confirmação
 *   - 1 dia à frente:  lembrete contextual (informativo se já respondeu,
 *                      urgente com botões se ainda pendente)
 *
 * Para testes manuais, envie POST com body:
 *   { "daysAhead": 4, "reminderType": "4days" }
 * para processar apenas um lote específico.
 */

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

/** Retorna a data de X dias à frente no fuso de Brasília (YYYY-MM-DD) */
function dateInBrasilia(daysAhead: number): string {
    const d = new Date()
    d.setHours(d.getHours() - 3) // UTC-3
    d.setDate(d.getDate() + daysAhead)
    return d.toISOString().slice(0, 10)
}

interface CalendarEvent {
    id: string
    summary?: string
    description?: string
    location?: string
    extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
    start?: { dateTime?: string; date?: string }
}

// Tipos de reunião contemplados no escopo da aplicação
const LEADERSHIP_MEETING_TYPES = new Set([
    'conselho_estaca',
    'coordenacao_missionaria_estaca',
    'presidencia_estaca',
    'sumo_conselho_estaca',
    'entrevista_presidencia_estaca',
])

const meetingTypeRules: Array<{ value: string; keywords: string[] }> = [
    {
        value: 'entrevista_presidencia_estaca',
        keywords: [
            'entrevista com a presidência da estaca',
            'entrevista com a presidencia da estaca',
            'calendário de entrevista',
            'calendario de entrevista',
        ],
    },
    {
        value: 'sumo_conselho_estaca',
        keywords: ['sumo conselho', 'reunião do sumo conselho', 'reuniao do sumo conselho'],
    },
    {
        value: 'conselho_estaca',
        keywords: ['conselho da estaca', 'conselho estaca', 'stake council', 'reunião de conselho', 'reuniao de conselho'],
    },
    {
        value: 'coordenacao_missionaria_estaca',
        keywords: [
            'coordenação missionária',
            'coordenacao missionaria',
            'missionária da estaca',
            'missionaria da estaca',
            'missionary coordination',
        ],
    },
    {
        value: 'presidencia_estaca',
        keywords: [
            'presidência da estaca',
            'presidencia da estaca',
            'stake presidency',
            'reunião de presidência',
            'reuniao de presidencia',
        ],
    },
]

function inferMeetingTypeFromText(title: string = '', description: string = ''): string | undefined {
    const text = `${title} ${description}`.toLowerCase()
    return meetingTypeRules.find((rule) => rule.keywords.some((kw) => text.includes(kw)))?.value
}

interface ReminderBatch {
    daysAhead: number
    reminderType: '4days' | '1day' | '1hour'
}

/** Retorna o intervalo da próxima hora cheia em UTC (para filtrar entrevistas que iniciam na próxima hora) */
function nextHourRange(): { start: Date; end: Date } {
    const now = new Date()
    const start = new Date(now)
    start.setHours(start.getHours() + 1, 0, 0, 0)
    const end = new Date(start)
    end.setMinutes(59, 59, 999)
    return { start, end }
}

Deno.serve(async (request: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ error: 'Variáveis de ambiente ausentes.' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Por padrão processa os dois intervalos; pode ser sobrescrito via body para testes
    let batches: ReminderBatch[] = [
        { daysAhead: 4, reminderType: '4days' },
        { daysAhead: 1, reminderType: '1day' },
    ]
    let testChatId: number | undefined
    try {
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}))
            if (typeof body?.testChatId === 'number') testChatId = body.testChatId
            if (body?.reminderType === '1hour') {
                // Lote exclusivo para lembretes de 1h antes das entrevistas (chamado pelo cron horário)
                batches = [{ daysAhead: 0, reminderType: '1hour' }]
            } else if (typeof body?.daysAhead === 'number' && body?.reminderType) {
                batches = [{ daysAhead: body.daysAhead, reminderType: body.reminderType }]
            }
        }
    } catch { /* ignora */ }

    // Busca todas as organizações
    const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id')

    if (orgsError) {
        return jsonResponse({ error: `Erro ao buscar organizações: ${orgsError.message}` }, 500)
    }

    if (!orgs || orgs.length === 0) {
        return jsonResponse({ processed: 0, message: 'Nenhuma organização encontrada.' })
    }

    const allResults: Array<{
        daysAhead: number
        reminderType: string
        targetDate: string
        totalSent: number
        totalFailed: number
        events: Array<{ organizationId: string; eventId: string; title: string; sent: number; failed: number }>
    }> = []

    for (const batch of batches) {
        const targetDate = dateInBrasilia(batch.daysAhead)
        console.log(`[send-scheduled-reminders] reminderType=${batch.reminderType} → data alvo: ${targetDate}`)

        let batchSent = 0
        let batchFailed = 0
        const batchEvents: Array<{ organizationId: string; eventId: string; title: string; sent: number; failed: number }> = []

        for (const org of orgs) {
            const organizationId: string = org.id

            // Busca eventos do Google Calendar para a data-alvo
            const calendarResponse = await fetch(
                `${supabaseUrl}/functions/v1/google-calendar-events`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'apikey': supabaseServiceKey,
                    },
                    body: JSON.stringify({
                        action: 'listEvents',
                        calendarId: 'primary',
                        startDate: targetDate,
                        endDate: targetDate,
                        maxResults: 50,
                    }),
                }
            )

            if (!calendarResponse.ok) {
                const errText = await calendarResponse.text()
                console.warn(`[org ${organizationId}] Erro ao buscar eventos do Calendar: ${errText}`)
                continue
            }

            const calendarData = await calendarResponse.json()
            const events: CalendarEvent[] = calendarData?.items || []

            if (events.length === 0) {
                console.log(`[org ${organizationId}] Nenhum evento em ${targetDate}`)
                continue
            }

            console.log(`[org ${organizationId}] ${events.length} evento(s) para ${targetDate}`)

            for (const event of events) {
                const googleEventId = event.id
                const title = event.summary || 'Reunião'
                const meetingAt = event.start?.dateTime || event.start?.date || targetDate
                const location = event.location
                const meetingType = event.extendedProperties?.private?.meetingType
                    || event.extendedProperties?.shared?.meetingType
                    || (event.extendedProperties?.private?.interviewer ? 'entrevista_presidencia_estaca' : undefined)
                    || inferMeetingTypeFromText(event.summary, event.description)

                // Ignora eventos fora do escopo da aplicação
                if (!meetingType || !LEADERSHIP_MEETING_TYPES.has(meetingType)) {
                    console.log(`[org ${organizationId}] Evento "${title}" ignorado (tipo: ${meetingType ?? 'desconhecido'})`)
                    continue
                }

                // Lote 4days: entrevistas não recebem lembrete de 4 dias (apenas 1 dia e 1 hora antes)
                if (batch.reminderType === '4days' && meetingType === 'entrevista_presidencia_estaca') {
                    console.log(`[org ${organizationId}] Entrevista "${title}" ignorada no lote 4days`)
                    continue
                }

                // Lote 1hour: apenas entrevistas, e somente as que iniciam na próxima hora
                if (batch.reminderType === '1hour') {
                    if (meetingType !== 'entrevista_presidencia_estaca') continue
                    const eventStart = event.start?.dateTime ? new Date(event.start.dateTime) : null
                    if (!eventStart) continue
                    const { start: nhStart, end: nhEnd } = nextHourRange()
                    if (eventStart < nhStart || eventStart > nhEnd) {
                        console.log(`[org ${organizationId}] Entrevista "${title}" fora da janela de 1h (início: ${event.start?.dateTime})`)
                        continue
                    }
                }

                const reminderResponse = await fetch(
                    `${supabaseUrl}/functions/v1/send-telegram-reminders`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'apikey': supabaseServiceKey,
                        },
                        body: JSON.stringify({
                            organizationId,
                            googleEventId,
                            title,
                            meetingAt,
                            meetingType,
                            location,
                            reminderType: batch.reminderType,
                            ...(testChatId !== undefined && { testChatId }),
                        }),
                    }
                )

                const reminderResult = await reminderResponse.json().catch(() => ({}))

                if (reminderResponse.ok) {
                    batchSent += reminderResult.sent || 0
                    batchFailed += reminderResult.failed || 0
                    batchEvents.push({
                        organizationId,
                        eventId: googleEventId,
                        title,
                        sent: reminderResult.sent || 0,
                        failed: reminderResult.failed || 0,
                    })
                    console.log(`[${batch.reminderType}][org ${organizationId}] "${title}": ${reminderResult.sent} enviados`)
                } else {
                    console.warn(`[${batch.reminderType}][org ${organizationId}] Falha para "${title}": ${JSON.stringify(reminderResult)}`)
                    batchFailed++
                }
            }
        }

        allResults.push({
            daysAhead: batch.daysAhead,
            reminderType: batch.reminderType,
            targetDate,
            totalSent: batchSent,
            totalFailed: batchFailed,
            events: batchEvents,
        })

        console.log(`[${batch.reminderType}] Concluído: ${batchSent} enviados, ${batchFailed} falhas`)
    }

    const grandTotalSent = allResults.reduce((s, r) => s + r.totalSent, 0)
    const grandTotalFailed = allResults.reduce((s, r) => s + r.totalFailed, 0)

    return jsonResponse({
        totalSent: grandTotalSent,
        totalFailed: grandTotalFailed,
        batches: allResults,
    })
})
