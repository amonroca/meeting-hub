import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChain } from '../../test/supabaseChain.js'

const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: vi.fn(() => ({ from: mockFrom })),
    supabase: null,
}))

import {
    getOrganizationSettings,
    saveOrganizationSettings,
} from '../organizationSettings.js'

beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(createChain({ data: null, error: null }))
})

describe('getOrganizationSettings', () => {
    it('retorna null quando organizationId não é fornecido', async () => {
        const result = await getOrganizationSettings('')
        expect(result).toBeNull()
    })

    it('retorna os dados quando Supabase responde com sucesso', async () => {
        const fakeSettings = { drive_root_folder_id: 'abc', type_folder_map: {} }
        mockFrom.mockReturnValue(createChain({ data: fakeSettings, error: null }))

        const result = await getOrganizationSettings('org-123')
        expect(result).toEqual(fakeSettings)
    })

    it('lança erro quando Supabase retorna erro', async () => {
        const supabaseError = new Error('Permission denied')
        mockFrom.mockReturnValue(createChain({ data: null, error: supabaseError }))

        await expect(getOrganizationSettings('org-123')).rejects.toThrow('Permission denied')
    })
})

describe('saveOrganizationSettings', () => {
    it('chama upsert com os dados corretos', async () => {
        const chain = createChain({ error: null })
        mockFrom.mockReturnValue(chain)

        await saveOrganizationSettings('org-123', {
            typeFolderMap: { conselho_estaca: 'pasta/atas' },
            driveRootFolderId: 'root-id',
        })

        expect(mockFrom).toHaveBeenCalledWith('organization_settings')
        expect(chain.upsert).toHaveBeenCalled()
    })

    it('lança erro quando Supabase retorna erro no upsert', async () => {
        const supabaseError = new Error('Unique constraint')
        const chain = createChain({ error: supabaseError })
        mockFrom.mockReturnValue(chain)

        await expect(
            saveOrganizationSettings('org-123', { typeFolderMap: {} })
        ).rejects.toThrow('Unique constraint')
    })
})
