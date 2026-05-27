import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../../services/meetingMinutes', () => ({
    listMeetingMinutes: vi.fn().mockResolvedValue([]),
    getTrelloTasks: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../services/googleCalendar', () => ({
    isGoogleCalendarConfigured: false,
    listGoogleCalendarEvents: vi.fn().mockResolvedValue([]),
    formatCalendarDate: vi.fn((v) => v || 'Sem data'),
}))

// Recharts usa SVG — mock para evitar problemas no jsdom
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    BarChart: ({ children }) => <div>{children}</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Cell: () => null,
}))

import { useAuth } from '../../hooks/useAuth'
import DashboardPage from '../DashboardPage.jsx'

const defaultAuth = {
    isConfigured: true,
    isAuthenticated: true,
    loading: false,
    user: { id: 'u1', name: 'Ana', email: 'ana@test.com', organizationId: 'org-1', role: 'admin' },
}

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue(defaultAuth)
})

function renderDashboard() {
    return render(
        <MemoryRouter>
            <DashboardPage />
        </MemoryRouter>
    )
}

describe('DashboardPage', () => {
    it('renderiza os cards de estatísticas após carregar', async () => {
        renderDashboard()
        await waitFor(() => {
            expect(screen.getByText(/reuniões esse mês/i)).toBeInTheDocument()
        })
    })

    it('exibe estatísticas de tarefas', async () => {
        renderDashboard()
        await waitFor(() => {
            expect(screen.getByText(/tarefas abertas/i)).toBeInTheDocument()
        })
    })

    it('renderiza sem erro quando dados estão vazios', async () => {
        renderDashboard()
        await waitFor(() => {
            // Não há dados, mas a página não deve travar
            expect(document.body).toBeInTheDocument()
        })
    })
})
