import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChain } from '../../test/supabaseChain.js'

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
    supabase: null,
}))

import { listMeetingMinutes, listMeetingTypeOptions } from '../meetingMinutes.js'

beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(createChain({ data: [], error: null }))
    mockRpc.mockResolvedValue({ data: null, error: null })
})

describe('listMeetingMinutes', () => {
    it('retorna array vazio por padrão', async () => {
        const result = await listMeetingMinutes()
        expect(result).toEqual([])
    })

    it('retorna os dados quando Supabase responde com lista', async () => {
        const fakeMins = [{ id: 'min-1', title: 'Ata Teste' }]
        mockFrom.mockReturnValue(createChain({ data: fakeMins, error: null }))

        const result = await listMeetingMinutes()
        expect(result).toEqual(fakeMins)
    })

    it('lança erro quando Supabase retorna erro', async () => {
        const supabaseError = new Error('DB error')
        mockFrom.mockReturnValue(createChain({ data: null, error: supabaseError }))

        await expect(listMeetingMinutes()).rejects.toThrow('DB error')
    })

    it('aplica filtro por meetingType', async () => {
        const chain = createChain({ data: [], error: null })
        mockFrom.mockReturnValue(chain)

        await listMeetingMinutes({ meetingType: 'conselho_estaca' })

        expect(chain.eq).toHaveBeenCalledWith('meeting_type', 'conselho_estaca')
    })

    it('aplica filtros de data', async () => {
        const chain = createChain({ data: [], error: null })
        mockFrom.mockReturnValue(chain)

        await listMeetingMinutes({ startDate: '2026-01-01', endDate: '2026-01-31' })

        expect(chain.gte).toHaveBeenCalled()
        expect(chain.lt).toHaveBeenCalled()
    })
})

describe('listMeetingTypeOptions', () => {
    it('retorna fallback quando rpc retorna erro', async () => {
        mockRpc.mockResolvedValue({ data: null, error: new Error('rpc error') })

        const result = await listMeetingTypeOptions()
        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('value')
        expect(result[0]).toHaveProperty('label')
    })

    it('retorna dados do rpc quando disponíveis', async () => {
        const fakeOptions = [{ value: 'tipo_a', label: 'Tipo A' }]
        mockRpc.mockResolvedValue({ data: fakeOptions, error: null })

        const result = await listMeetingTypeOptions()
        expect(result).toEqual(fakeOptions)
    })

    it('retorna fallback quando rpc retorna lista vazia', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null })

        const result = await listMeetingTypeOptions()
        expect(result.length).toBeGreaterThan(0)
    })
})
