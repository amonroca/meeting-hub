import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute.jsx'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'

const PaginaProtegida = () => <div>Conteúdo protegido</div>
const PaginaLogin = () => <div>Página de login</div>

function renderRota(authState) {
    useAuth.mockReturnValue(authState)
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/login" element={<PaginaLogin />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<PaginaProtegida />} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('exibe spinner enquanto a sessão está carregando', () => {
        renderRota({ isAuthenticated: false, loading: true })
        expect(screen.getByText('Carregando ambiente...')).toBeInTheDocument()
    })

    it('não exibe o conteúdo protegido enquanto carrega', () => {
        renderRota({ isAuthenticated: false, loading: true })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    })

    it('redireciona para /login quando o usuário não está autenticado', () => {
        renderRota({ isAuthenticated: false, loading: false })
        expect(screen.getByText('Página de login')).toBeInTheDocument()
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    })

    it('renderiza o conteúdo protegido quando o usuário está autenticado', () => {
        renderRota({ isAuthenticated: true, loading: false })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })
})
