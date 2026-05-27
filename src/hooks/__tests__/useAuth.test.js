import { describe, it, expect, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { useAuth } from '../useAuth.js'
import { AuthProvider } from '../../context/AuthContext.jsx'

const mockGetSession = vi.hoisted(() =>
    vi.fn().mockResolvedValue({ data: { session: null }, error: null })
)
const mockOnAuthStateChange = vi.hoisted(() =>
    vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
)

vi.mock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: {
        auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
    },
}))

describe('useAuth', () => {
    it('lança erro quando usado fora do AuthProvider', () => {
        // Captura o erro de forma controlada sem poluir o console
        const originalError = console.error
        console.error = vi.fn()

        expect(() => {
            renderHook(() => useAuth())
        }).toThrow('useAuth deve ser usado dentro de AuthProvider')

        console.error = originalError
    })

    it('retorna o contexto de autenticação quando dentro do AuthProvider', async () => {
        const { result, unmount } = renderHook(() => useAuth(), {
            wrapper: AuthProvider,
        })

        // O hook retorna um objeto com as chaves esperadas
        expect(result.current).toHaveProperty('login')
        expect(result.current).toHaveProperty('register')
        expect(result.current).toHaveProperty('logout')
        expect(result.current).toHaveProperty('loading')
        expect(result.current).toHaveProperty('isAuthenticated')
        expect(result.current).toHaveProperty('isConfigured')

        unmount()
    })

    it('isAuthenticated começa como false', () => {
        const { result, unmount } = renderHook(() => useAuth(), {
            wrapper: AuthProvider,
        })
        expect(result.current.isAuthenticated).toBe(false)
        unmount()
    })

    it('isConfigured é true quando Supabase está configurado', () => {
        const { result, unmount } = renderHook(() => useAuth(), {
            wrapper: AuthProvider,
        })
        expect(result.current.isConfigured).toBe(true)
        unmount()
    })
})
