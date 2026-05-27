import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'
import RegisterPage from '../RegisterPage.jsx'

const mockRegister = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        register: mockRegister,
        isConfigured: true,
        isAuthenticated: false,
        loading: false,
    })
})

function renderRegister() {
    return render(
        <MemoryRouter initialEntries={['/register']}>
            <RegisterPage />
        </MemoryRouter>
    )
}

describe('RegisterPage', () => {
    it('renderiza o formulário de cadastro', () => {
        renderRegister()
        expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/nome/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('exibe erro quando a senha é curta demais', async () => {
        const user = userEvent.setup()
        renderRegister()

        await user.type(screen.getByLabelText(/nome/i), 'João Silva')
        await user.type(screen.getByLabelText(/email/i), 'joao@test.com')

        const [senha, confirmar] = screen.getAllByLabelText(/senha/i)
        await user.type(senha, '123')
        await user.type(confirmar, '123')

        await user.click(screen.getByRole('button', { name: /criar conta/i }))

        await waitFor(() => {
            expect(screen.getByText(/pelo menos 6/i)).toBeInTheDocument()
        })
        expect(mockRegister).not.toHaveBeenCalled()
    })

    it('exibe erro quando senhas não coincidem', async () => {
        const user = userEvent.setup()
        renderRegister()

        await user.type(screen.getByLabelText(/nome/i), 'João Silva')
        await user.type(screen.getByLabelText(/email/i), 'joao@test.com')

        const [senha, confirmar] = screen.getAllByLabelText(/senha/i)
        await user.type(senha, 'senha123')
        await user.type(confirmar, 'outrasenha')

        await user.click(screen.getByRole('button', { name: /criar conta/i }))

        await waitFor(() => {
            // O botão fica desabilitado quando senhas não coincidem;
            // a mensagem em tempo real é exibida antes do submit
            expect(screen.getByText('As senhas precisam ser iguais.')).toBeInTheDocument()
        })
    })

    it('chama register com os dados corretos', async () => {
        mockRegister.mockResolvedValue({ data: {} })
        const user = userEvent.setup()
        renderRegister()

        await user.type(screen.getByLabelText(/nome/i), 'João Silva')
        await user.type(screen.getByLabelText(/email/i), 'joao@test.com')

        const [senha, confirmar] = screen.getAllByLabelText(/senha/i)
        await user.type(senha, 'senha123')
        await user.type(confirmar, 'senha123')

        await user.click(screen.getByRole('button', { name: /criar conta/i }))

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith('João Silva', 'joao@test.com', 'senha123')
        })
    })

    it('exibe link para login', () => {
        renderRegister()
        expect(screen.getByRole('link', { name: /voltar para o login/i })).toBeInTheDocument()
    })
})
