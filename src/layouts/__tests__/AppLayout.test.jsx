import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'
import AppLayout from '../AppLayout.jsx'

// AppLayout usa Outlet do react-router-dom — mock para evitar erros de rota
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        Outlet: () => <main data-testid="outlet">Conteúdo da rota</main>,
    }
})

const mockLogout = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        user: { name: 'Ana Souza', email: 'ana@test.com', role: 'admin' },
        logout: mockLogout,
    })
})

function renderLayout(initialEntry = '/dashboard') {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AppLayout />
        </MemoryRouter>
    )
}

describe('AppLayout', () => {
    it('renderiza os links de navegação principais', () => {
        renderLayout()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Reuniões')).toBeInTheDocument()
        expect(screen.getByText('Atas')).toBeInTheDocument()
        expect(screen.getByText('Tarefas')).toBeInTheDocument()
        expect(screen.getByText('Configurações')).toBeInTheDocument()
    })

    it('exibe o nome do usuário logado', () => {
        renderLayout()
        expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    it('renderiza o Outlet (conteúdo da rota)', () => {
        renderLayout()
        expect(screen.getByTestId('outlet')).toBeInTheDocument()
    })

    it('chama logout ao clicar no botão de sair', async () => {
        const user = userEvent.setup()
        mockLogout.mockResolvedValue(undefined)
        renderLayout()

        await user.click(screen.getByRole('button', { name: /sair/i }))
        await waitFor(() => expect(mockLogout).toHaveBeenCalled())
    })
})
