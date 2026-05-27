import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Mock do supabase com cliente de autenticação completo
const mockGetSession = vi.hoisted(() => vi.fn())
const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignUp = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: {
        auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut,
        },
        from: mockFrom,
    },
}))

import { AuthProvider } from '../AuthContext.jsx'
import { useAuth } from '../../hooks/useAuth.js'

// Componente auxiliar para expor o contexto
function AuthConsumer({ onReady }) {
    const auth = useAuth()
    onReady?.(auth)
    return (
        <div>
            <span data-testid="loading">{String(auth.loading)}</span>
            <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
            <span data-testid="configured">{String(auth.isConfigured)}</span>
        </div>
    )
}

beforeEach(() => {
    vi.clearAllMocks()

    // Sessão vazia por padrão
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
})

describe('AuthProvider', () => {
    it('renderiza os filhos corretamente', async () => {
        render(
            <AuthProvider>
                <span>Conteúdo filho</span>
            </AuthProvider>
        )
        await waitFor(() => {
            expect(screen.getByText('Conteúdo filho')).toBeInTheDocument()
        })
    })

    it('começa com loading=true e termina com loading=false sem sessão', async () => {
        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        )
        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false')
        })
        expect(screen.getByTestId('authenticated').textContent).toBe('false')
    })

    it('fornece isConfigured=true quando Supabase está configurado', async () => {
        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
        expect(screen.getByTestId('configured').textContent).toBe('true')
    })
})

describe('login (via AuthProvider)', () => {
    it('lança erro quando email e senha estão vazios', async () => {
        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await expect(authRef.login('', '')).rejects.toThrow('Informe email e senha.')
    })

    it('chama signInWithPassword e retorna dados', async () => {
        mockSignInWithPassword.mockResolvedValue({
            data: { session: { user: { id: 'user-1', email: 'a@b.com' } } },
            error: null,
        })

        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await authRef.login('user@test.com', 'senha123')
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
            email: 'user@test.com',
            password: 'senha123',
        })
    })

    it('lança erro traduzido para credenciais inválidas', async () => {
        mockSignInWithPassword.mockResolvedValue({
            data: null,
            error: { message: 'Invalid login credentials' },
        })

        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await expect(authRef.login('a@b.com', 'errado')).rejects.toThrow('Email ou senha inválidos.')
    })
})

describe('register (via AuthProvider)', () => {
    it('lança erro quando campos estão vazios', async () => {
        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await expect(authRef.register('', '', '')).rejects.toThrow('Informe nome completo, email e senha.')
    })

    it('chama signUp com os dados corretos', async () => {
        mockSignUp.mockResolvedValue({ data: {}, error: null })

        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await authRef.register('João Silva', 'joao@test.com', 'senha123')
        expect(mockSignUp).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'joao@test.com', password: 'senha123' })
        )
    })
})

describe('logout (via AuthProvider)', () => {
    it('chama signOut', async () => {
        mockSignOut.mockResolvedValue({ error: null })

        let authRef
        render(
            <AuthProvider>
                <AuthConsumer onReady={(auth) => { authRef = auth }} />
            </AuthProvider>
        )
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

        await act(async () => { await authRef.logout() })
        expect(mockSignOut).toHaveBeenCalled()
    })
})
