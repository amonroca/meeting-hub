import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../services/googleCalendar', () => ({
    cancelGoogleCalendarEvent: vi.fn().mockResolvedValue({}),
    createGoogleCalendarEvent: vi.fn().mockResolvedValue({}),
    formatCalendarDate: vi.fn((v) => v || 'Sem data'),
    interviewModeOptions: [{ value: 'presencial', label: 'Presencial' }],
    interviewNatureOptions: [{ value: 'anual', label: 'Entrevista Anual' }],
    isGoogleCalendarConfigured: true,
    listGoogleCalendarEvents: vi.fn().mockResolvedValue([]),
    parseCalendarDate: vi.fn((v) => (v ? new Date(v) : null)),
    stakePresidencyInterviewerOptions: [{ value: 'presidente', label: 'Presidente de Estaca' }],
    updateGoogleCalendarEvent: vi.fn().mockResolvedValue({}),
}))

import { listGoogleCalendarEvents } from '../../services/googleCalendar'
import InterviewsPage from '../InterviewsPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    listGoogleCalendarEvents.mockResolvedValue([])
})

function renderInterviews() {
    return render(
        <MemoryRouter>
            <InterviewsPage />
        </MemoryRouter>
    )
}

describe('InterviewsPage', () => {
    it('renderiza o título da página', async () => {
        renderInterviews()
        await waitFor(() => {
            // Há também um h2 "Próximas entrevistas" — usar correspondência exata
            expect(screen.getByRole('heading', { name: 'Entrevistas' })).toBeInTheDocument()
        })
    })

    it('carrega entrevistas ao montar', async () => {
        renderInterviews()
        await waitFor(() => {
            expect(listGoogleCalendarEvents).toHaveBeenCalled()
        })
    })

    it('exibe entrevistas quando retornadas', async () => {
        listGoogleCalendarEvents.mockResolvedValue([
            {
                id: 'evt-1',
                title: 'Entrevista João',
                meetingType: 'entrevista',
                startAt: '2026-06-01T10:00:00.000Z',
                endAt: '2026-06-01T10:30:00.000Z',
                allDay: false,
            },
        ])

        renderInterviews()
        await waitFor(() => {
            expect(screen.getByText('Entrevista João')).toBeInTheDocument()
        })
    })

    it('renderiza sem erros com lista vazia', async () => {
        renderInterviews()
        await waitFor(() => {
            expect(document.body).toBeInTheDocument()
        })
    })
})
