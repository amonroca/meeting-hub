import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'
import LoginPage from '../LoginPage.jsx'

const mockLogin = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        login: mockLogin,
        isConfigured: true,
        isAuthenticated: false,
        loading: false,
        session: null,
    })
})

function renderLogin() {
    return render(
        <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
        </MemoryRouter>
    )
}

describe('LoginPage', () => {
    it('renderiza o formulário de login', () => {
        renderLogin()
        expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    })

    it('exibe erro quando login falha', async () => {
        mockLogin.mockRejectedValue(new Error('Email ou senha inválidos.'))
        const user = userEvent.setup()
        renderLogin()

        await user.type(screen.getByLabelText(/email/i), 'test@test.com')
        await user.type(screen.getByLabelText(/senha/i), 'errado')
        await user.click(screen.getByRole('button', { name: /entrar/i }))

        await waitFor(() => {
            expect(screen.getByText('Email ou senha inválidos.')).toBeInTheDocument()
        })
    })

    it('chama login com email e senha', async () => {
        mockLogin.mockResolvedValue({})
        const user = userEvent.setup()
        renderLogin()

        await user.type(screen.getByLabelText(/email/i), 'user@test.com')
        await user.type(screen.getByLabelText(/senha/i), 'senha123')
        await user.click(screen.getByRole('button', { name: /entrar/i }))

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'senha123')
        })
    })

    it('exibe link para cadastro', () => {
        renderLogin()
        expect(screen.getByRole('link', { name: /criar conta/i })).toBeInTheDocument()
    })
})
