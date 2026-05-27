import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../../services/meetingMinutes', () => ({
    getTrelloTasks: vi.fn().mockResolvedValue([]),
    deleteTrelloCard: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/googleCalendar', () => ({
    formatCalendarDate: vi.fn((v) => v || 'Sem data'),
}))

vi.mock('../../components/EditTaskModal', () => ({ default: () => null }))
vi.mock('../../components/ViewTaskModal', () => ({ default: () => null }))

import { useAuth } from '../../hooks/useAuth'
import { getTrelloTasks } from '../../services/meetingMinutes'
import TasksPage from '../TasksPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        user: { id: 'u1', name: 'Ana', organizationId: 'org-1', role: 'admin' },
    })
})

function renderTasks() {
    return render(
        <MemoryRouter>
            <TasksPage />
        </MemoryRouter>
    )
}

describe('TasksPage', () => {
    it('renderiza o título da página', async () => {
        renderTasks()
        await waitFor(() => {
            expect(screen.getByText(/tarefas/i)).toBeInTheDocument()
        })
    })

    it('carrega tarefas ao montar', async () => {
        renderTasks()
        await waitFor(() => {
            expect(getTrelloTasks).toHaveBeenCalledWith('org-1')
        })
    })

    it('exibe lista de tarefas quando retornadas', async () => {
        getTrelloTasks.mockResolvedValue([
            { id: 'card-1', name: 'Tarefa Exemplo', status: 'Em andamento', meetingTitle: 'Reunião', minuteId: 'min-1' },
        ])

        renderTasks()
        await waitFor(() => {
            expect(screen.getByText('Tarefa Exemplo')).toBeInTheDocument()
        })
    })

    it('exibe mensagem quando não há tarefas', async () => {
        getTrelloTasks.mockResolvedValue([])
        renderTasks()
        await waitFor(() => {
            expect(screen.getByText(/nenhuma tarefa/i)).toBeInTheDocument()
        })
    })

    it('exibe erro quando carregamento falha', async () => {
        getTrelloTasks.mockRejectedValue(new Error('Falha ao carregar'))
        renderTasks()
        await waitFor(() => {
            expect(screen.getByText(/falha ao carregar/i)).toBeInTheDocument()
        })
    })
})
