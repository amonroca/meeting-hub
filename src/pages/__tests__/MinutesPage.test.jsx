import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../../services/meetingMinutes', () => ({
    listMeetingMinutes: vi.fn().mockResolvedValue([]),
    listMeetingTypeOptions: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../services/googleCalendar', () => ({
    formatCalendarDate: vi.fn((v) => v || 'Sem data'),
}))

import { useAuth } from '../../hooks/useAuth'
import { listMeetingMinutes } from '../../services/meetingMinutes'
import MinutesPage from '../MinutesPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        isConfigured: true,
        isAuthenticated: true,
        loading: false,
        user: { id: 'u1', name: 'Ana', organizationId: 'org-1', role: 'admin' },
    })
    listMeetingMinutes.mockResolvedValue([])
})

function renderMinutes() {
    return render(
        <MemoryRouter>
            <MinutesPage />
        </MemoryRouter>
    )
}

describe('MinutesPage', () => {
    it('renderiza o título da página', async () => {
        renderMinutes()
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Atas' })).toBeInTheDocument()
        })
    })

    it('carrega atas ao montar', async () => {
        renderMinutes()
        await waitFor(() => {
            expect(listMeetingMinutes).toHaveBeenCalled()
        })
    })

    it('exibe atas quando retornadas', async () => {
        listMeetingMinutes.mockResolvedValue([
            {
                id: 'min-1',
                title: 'Conselho de Estaca',
                meeting_type: 'conselho_estaca',
                meeting_at: '2026-05-27T10:00:00.000Z',
                status: 'ready',
                attendees: ['João', 'Maria'],
                doc_url: 'https://docs.google.com/test',
            },
        ])

        renderMinutes()
        await waitFor(() => {
            expect(screen.getByText('Conselho de Estaca')).toBeInTheDocument()
        })
    })

    it('exibe mensagem quando não há atas', async () => {
        listMeetingMinutes.mockResolvedValue([])
        renderMinutes()
        await waitFor(() => {
            expect(screen.getByText(/nenhuma ata/i)).toBeInTheDocument()
        })
    })

    it('exibe erro quando carregamento falha', async () => {
        listMeetingMinutes.mockRejectedValue(new Error('Erro no servidor'))
        renderMinutes()
        await waitFor(() => {
            expect(screen.getByText(/erro no servidor/i)).toBeInTheDocument()
        })
    })
})
