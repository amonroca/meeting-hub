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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

interface ReminderPayload {
    organizationId: string
    googleEventId: string
    title: string
    meetingAt: string
    meetingType?: string
    meetingTypeLabel?: string
    location?: string
    reminderType?: '4days' | '1day' | '1hour' // '4days', '1day' ou '1hour' (lembrete 1h antes da entrevista)
    testChatId?: number // quando presente, envia apenas para este chat_id (modo de teste)
}

async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup: object): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
        }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        const errMsg = body?.description || `HTTP ${response.status}`
        console.warn(`Falha ao enviar mensagem para chat_id ${chatId}: ${errMsg}`)
        return { ok: false, error: errMsg }
    }
    return { ok: true }
}

async function sendSimpleMessage(botToken: string, chatId: number, text: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        const errMsg = body?.description || `HTTP ${response.status}`
        console.warn(`Falha ao enviar mensagem simples para chat_id ${chatId}: ${errMsg}`)
        return { ok: false, error: errMsg }
    }
    return { ok: true }
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ error: 'Variáveis de ambiente ausentes.' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let payload: ReminderPayload
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, googleEventId, title, meetingAt, meetingType, meetingTypeLabel, location, reminderType, testChatId } = payload

    if (!organizationId || !googleEventId || !title || !meetingAt) {
        return jsonResponse({ error: 'Campos obrigatórios: organizationId, googleEventId, title, meetingAt.' }, 400)
    }

    // Busca usuários internos com Telegram vinculado
    const { data: usersRaw, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, telegram_chat_id, notification_meeting_types')
        .eq('organization_id', organizationId)
        .not('telegram_chat_id', 'is', null)

    if (usersError) {
        return jsonResponse({ error: `Erro ao buscar usuários: ${usersError.message}` }, 500)
    }

    // Filtra usuários pelo tipo de reunião: array vazio = recebe tudo
    const users = (usersRaw || []).filter((u: { notification_meeting_types?: string[] }) => {
        const types: string[] = u.notification_meeting_types || []
        return types.length === 0 || (meetingType ? types.includes(meetingType) : true)
    })

    // Busca contatos externos com Telegram vinculado, filtrados pelo tipo de reunião
    let contacts: Array<{ id: string; full_name: string; telegram_chat_id: number }> = []
    if (meetingType) {
        const { data: contactData, error: contactError } = await supabase
            .from('telegram_contacts')
            .select('id, full_name, telegram_chat_id')
            .eq('organization_id', organizationId)
            .not('telegram_chat_id', 'is', null)
            .contains('meeting_types', [meetingType])

        if (contactError) {
            console.warn('Erro ao buscar contatos externos:', contactError.message)
        } else {
            contacts = contactData || []
        }
    }

    // Modo de teste: ignora destinatários reais e envia apenas para o chat_id especificado
    const isTestMode = typeof testChatId === 'number'
    const effectiveUsers: Array<{ id: string; full_name: string; telegram_chat_id: number }> = isTestMode
        ? [{ id: 'test', full_name: 'Teste', telegram_chat_id: testChatId as number }]
        : (users || [])
    const effectiveContacts = isTestMode ? [] : contacts

    const totalParticipants = effectiveUsers.length + effectiveContacts.length
    if (totalParticipants === 0) {
        return jsonResponse({ sent: 0, message: 'Nenhum destinatário com Telegram vinculado.' })
    }

    // Formata a data
    const dateStr = new Date(meetingAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    })

    // Bloco informativo base (compartilhado por todas as variantes de mensagem)
    const baseInfo = [
        `<b>${title}</b>`,
        meetingTypeLabel ? `📋 ${meetingTypeLabel}` : '',
        `🕐 ${dateStr}`,
        location ? `📍 ${location}` : '',
    ].filter((l) => l !== '').join('\n')

    // Texto do lembrete padrão (4 dias antes)
    const text4days = `📅 <b>Lembrete de Reunião</b>\n\n${baseInfo}\n\nConfirme sua presença:`

    // Função auxiliar — envia mensagem adequada conforme tipo e status de confirmação
    async function sendToParticipant(
        participantId: string,
        chatId: number,
        idColumn: 'user_id' | 'telegram_contact_id',
        displayName: string
    ): Promise<{ ok: boolean; error?: string }> {

        // Modo de teste: envia mensagem formatada sem operações no banco
        if (isTestMode) {
            let testMsg: string
            if (reminderType === '1hour') {
                testMsg = `⏰ <b>[TESTE] Lembrete: Entrevista em 1 Hora!</b>\n\n${baseInfo}\n\nPrepare-se — sua entrevista começa em aproximadamente 1 hora.`
            } else if (reminderType === '1day') {
                testMsg = `⚠️ <b>[TESTE] Lembrete: Amanhã!</b>\n\n${baseInfo}\n\nA reunião é amanhã! Por favor, confirme sua presença:`
            } else {
                testMsg = `📅 <b>[TESTE] Lembrete de Reunião</b>\n\n${baseInfo}\n\nConfirme sua presença:`
            }
            testMsg += '\n\n🧪 <i>Mensagem de teste — nenhuma confirmação foi registrada.</i>'
            return await sendSimpleMessage(botToken as string, chatId, testMsg)
        }

        // --- Lembrete 1 hora antes (apenas entrevistas) ---
        if (reminderType === '1hour') {
            const msg = `⏰ <b>Lembrete: Entrevista em 1 Hora!</b>\n\n${baseInfo}\n\nPrepare-se — sua entrevista começa em aproximadamente 1 hora.`
            return await sendSimpleMessage(botToken as string, chatId, msg)
        }

        // --- Lembrete do dia anterior (1day) ---
        if (reminderType === '1day') {
            const { data: existing1day } = await supabase
                .from('meeting_confirmations')
                .select('id, status')
                .eq('google_event_id', googleEventId)
                .eq(idColumn, participantId)
                .maybeSingle()

            // Já confirmou: mensagem apenas informativa
            if (existing1day?.status === 'confirmed') {
                const msg = `✅ <b>Lembrete: Reunião Amanhã</b>\n\n${baseInfo}\n\nVocê já confirmou sua presença. Até amanhã! 🎉`
                return await sendSimpleMessage(botToken as string, chatId, msg)
            }

            // Já recusou: mensagem apenas informativa
            if (existing1day?.status === 'declined') {
                const msg = `📅 <b>Lembrete: Reunião Amanhã</b>\n\n${baseInfo}\n\nCaso tenha mudado de ideia, entre em contato com o secretário.`
                return await sendSimpleMessage(botToken as string, chatId, msg)
            }

            // Pendente ou sem registro: solicita confirmação com urgência
            const urgentText = `⚠️ <b>Lembrete: Reunião Amanhã!</b>\n\n${baseInfo}\n\nA reunião é amanhã! Por favor, confirme sua presença:`

            let confirmationId1day: string
            if (existing1day) {
                confirmationId1day = existing1day.id
            } else {
                const insertData: Record<string, unknown> = {
                    organization_id: organizationId,
                    google_event_id: googleEventId,
                    status: 'pending',
                }
                insertData[idColumn] = participantId
                const { data: inserted, error: insertError } = await supabase
                    .from('meeting_confirmations')
                    .insert(insertData)
                    .select('id')
                    .single()
                if (insertError || !inserted) {
                    console.warn(`Falha ao criar confirmação para ${displayName}: ${insertError?.message}`)
                    return { ok: false, error: `${displayName}: falha ao criar confirmação` }
                }
                confirmationId1day = inserted.id
            }

            const replyMarkup1day = {
                inline_keyboard: [[
                    { text: '✅ Confirmar presença', callback_data: `c:${confirmationId1day}:yes` },
                    { text: '❌ Não poderei comparecer', callback_data: `c:${confirmationId1day}:no` },
                ]],
            }
            return await sendMessage(botToken as string, chatId, urgentText, replyMarkup1day)
        }

        // --- Lembrete padrão (4 dias antes): sempre envia com botões ---
        const { data: existingRecord } = await supabase
            .from('meeting_confirmations')
            .select('id')
            .eq('google_event_id', googleEventId)
            .eq(idColumn, participantId)
            .maybeSingle()

        let confirmationId: string
        if (existingRecord) {
            confirmationId = existingRecord.id
        } else {
            const insertData: Record<string, unknown> = {
                organization_id: organizationId,
                google_event_id: googleEventId,
                status: 'pending',
            }
            insertData[idColumn] = participantId

            const { data: inserted, error: insertError } = await supabase
                .from('meeting_confirmations')
                .insert(insertData)
                .select('id')
                .single()

            if (insertError || !inserted) {
                console.warn(`Falha ao criar confirmação para ${displayName}: ${insertError?.message}`)
                return { ok: false, error: `${displayName}: falha ao criar confirmação` }
            }
            confirmationId = inserted.id
        }

        const replyMarkup = {
            inline_keyboard: [[
                { text: '✅ Confirmar presença', callback_data: `c:${confirmationId}:yes` },
                { text: '❌ Não poderei comparecer', callback_data: `c:${confirmationId}:no` },
            ]],
        }

        return await sendMessage(botToken as string, chatId, text4days, replyMarkup)
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    // Envia para usuários internos
    for (const user of effectiveUsers) {
        const result = await sendToParticipant(user.id, user.telegram_chat_id, 'user_id', user.full_name)
        if (result.ok) sent++
        else { failed++; if (result.error) errors.push(result.error) }
    }

    // Envia para contatos externos
    for (const contact of effectiveContacts) {
        const result = await sendToParticipant(contact.id, contact.telegram_chat_id, 'telegram_contact_id', contact.full_name)
        if (result.ok) sent++
        else { failed++; if (result.error) errors.push(result.error) }
    }

    console.log(`Lembretes enviados: ${sent}/${totalParticipants} (${failed} falhas) — evento: ${googleEventId}`)

    return jsonResponse({ sent, failed, total: totalParticipants, errors, ...(isTestMode && { testMode: true }) })
})
