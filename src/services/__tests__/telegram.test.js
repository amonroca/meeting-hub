import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChain } from '../../test/supabaseChain.js'

const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: vi.fn(() => ({ from: mockFrom })),
    supabase: null,
}))

import {
    getTelegramStatus,
    generateTelegramLinkToken,
    unlinkTelegram,
} from '../telegram.js'

let cryptoSpy

beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(createChain({ data: null, error: null }))
    // Mock global crypto para generateTelegramLinkToken
    cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => {
        arr.fill(42) // valor fixo para tornar determinístico
        return arr
    })
})

afterEach(() => {
    cryptoSpy?.mockRestore()
})

describe('getTelegramStatus', () => {
    it('retorna null quando userId não é fornecido', async () => {
        const result = await getTelegramStatus('')
        expect(result).toBeNull()
        expect(result).toBeNull()
    })

    it('retorna dados quando Supabase responde', async () => {
        const fakeStatus = { telegram_chat_id: '12345', telegram_link_token: 'abc' }
        mockFrom.mockReturnValue(createChain({ data: fakeStatus, error: null }))

        const result = await getTelegramStatus('user-123')
        expect(result).toEqual(fakeStatus)
    })

    it('lança erro quando Supabase retorna erro', async () => {
        const supabaseError = new Error('DB error')
        mockFrom.mockReturnValue(createChain({ data: null, error: supabaseError }))

        await expect(getTelegramStatus('user-123')).rejects.toThrow('DB error')
    })
})

describe('generateTelegramLinkToken', () => {
    it('lança erro quando userId não é fornecido', async () => {
        await expect(generateTelegramLinkToken('')).rejects.toThrow('Supabase não configurado.')
    })

    it('retorna o token gerado quando Supabase responde com sucesso', async () => {
        mockFrom.mockReturnValue(createChain({ error: null }))

        const token = await generateTelegramLinkToken('user-123')
        expect(typeof token).toBe('string')
        expect(token.length).toBeGreaterThan(0)
    })

    it('lança erro quando Supabase retorna erro no update', async () => {
        const supabaseError = new Error('Update failed')
        mockFrom.mockReturnValue(createChain({ error: supabaseError }))

        await expect(generateTelegramLinkToken('user-123')).rejects.toThrow('Update failed')
    })
})

describe('unlinkTelegram', () => {
    it('lança erro quando userId não é fornecido', async () => {
        await expect(unlinkTelegram('')).rejects.toThrow('Supabase não configurado.')
    })

    it('resolve sem erro quando Supabase responde com sucesso', async () => {
        mockFrom.mockReturnValue(createChain({ error: null }))
        await expect(unlinkTelegram('user-123')).resolves.toBeUndefined()
    })

    it('lança erro quando Supabase retorna erro', async () => {
        const supabaseError = new Error('Unlink failed')
        mockFrom.mockReturnValue(createChain({ error: supabaseError }))

        await expect(unlinkTelegram('user-123')).rejects.toThrow('Unlink failed')
    })
})
