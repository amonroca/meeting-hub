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
    isGoogleCalendarConfigured: true,
    listGoogleCalendarEvents: vi.fn().mockResolvedValue([]),
    createGoogleCalendarEvent: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../services/telegram', () => ({
    getMeetingConfirmations: vi.fn().mockResolvedValue([]),
    sendTelegramReminders: vi.fn().mockResolvedValue({ sent: 0 }),
}))

// Modais usam serviços — mock completo para evitar erros secundários
vi.mock('../../components/GenerateMinutesModal', () => ({
    default: () => null,
}))
vi.mock('../../components/ScheduleMeetingModal', () => ({
    default: () => null,
}))

import { useAuth } from '../../hooks/useAuth'
import MeetingsPage from '../MeetingsPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        isConfigured: true,
        isAuthenticated: true,
        loading: false,
        user: { id: 'u1', name: 'Ana', organizationId: 'org-1', role: 'admin' },
    })
})

function renderMeetings() {
    return render(
        <MemoryRouter>
            <MeetingsPage />
        </MemoryRouter>
    )
}

describe('MeetingsPage', () => {
    it('renderiza o título da página', async () => {
        renderMeetings()
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Reuniões' })).toBeInTheDocument()
        })
    })

    it('exibe filtros de data', async () => {
        renderMeetings()
        await waitFor(() => {
            expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
        })
    })

    it('renderiza sem erros com dados vazios', async () => {
        renderMeetings()
        await waitFor(() => {
            expect(document.body).toBeInTheDocument()
        })
    })
})
