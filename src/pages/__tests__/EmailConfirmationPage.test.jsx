import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'
import EmailConfirmationPage from '../EmailConfirmationPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/email-confirmation']}>
            <EmailConfirmationPage />
        </MemoryRouter>
    )
}

describe('EmailConfirmationPage', () => {
    it('exibe mensagem de confirmação pendente quando não autenticado', () => {
        useAuth.mockReturnValue({ isAuthenticated: false, loading: false })
        renderPage()
        expect(screen.getByText(/confirme seu e-mail/i)).toBeInTheDocument()
    })

    it('exibe mensagem de sucesso quando autenticado', () => {
        useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
        renderPage()
        expect(screen.getByText(/confirmado com sucesso/i)).toBeInTheDocument()
    })

    it('não trava durante loading', () => {
        useAuth.mockReturnValue({ isAuthenticated: false, loading: true })
        renderPage() // não deve lançar erro
    })
})
