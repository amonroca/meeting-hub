import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../services/meetingMinutes', () => ({
    deleteTrelloCard: vi.fn().mockResolvedValue(undefined),
    getTelegramUsers: vi.fn().mockResolvedValue([]),
    sendTaskNotification: vi.fn().mockResolvedValue({ notificationsCount: 1 }),
}))

vi.mock('../../services/googleCalendar', () => ({
    formatCalendarDate: vi.fn((v) => v || 'Sem data'),
}))

// Mocks para os pacotes usados internamente pelo ReactMarkdown
vi.mock('react-markdown', () => ({
    default: ({ children }) => <div data-testid="markdown">{children}</div>,
}))
vi.mock('remark-gfm', () => ({ default: () => { } }))
vi.mock('remark-breaks', () => ({ default: () => { } }))

import { deleteTrelloCard, getTelegramUsers } from '../../services/meetingMinutes'
import ViewTaskModal from '../ViewTaskModal.jsx'

const fakeTask = {
    id: 'card-1',
    minuteId: 'min-1',
    name: 'Tarefa de visualização',
    responsible: 'Maria Costa',
    description: 'Detalhes da tarefa',
    status: 'Em andamento',
    dueDate: '2026-06-01',
    url: 'https://trello.com/c/abc',
    notificationsCount: 2,
}

const defaultProps = {
    task: fakeTask,
    organizationId: 'org-123',
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onNotify: vi.fn(),
}

beforeEach(() => {
    vi.clearAllMocks()
    deleteTrelloCard.mockResolvedValue(undefined)
    getTelegramUsers.mockResolvedValue([])
})

describe('ViewTaskModal', () => {
    it('exibe o nome da tarefa no cabeçalho', () => {
        render(<ViewTaskModal {...defaultProps} />)
        expect(screen.getByText('Tarefa de visualização')).toBeInTheDocument()
    })

    it('exibe o status da tarefa', () => {
        render(<ViewTaskModal {...defaultProps} />)
        expect(screen.getByText('Em andamento')).toBeInTheDocument()
    })

    it('exibe o link do Trello', () => {
        render(<ViewTaskModal {...defaultProps} />)
        expect(screen.getByText('Ver no Trello')).toBeInTheDocument()
    })

    it('chama onClose ao clicar no botão Fechar', async () => {
        const user = userEvent.setup()
        render(<ViewTaskModal {...defaultProps} />)
        // Há dois botões com nome "Fechar": o X do cabeçalho e o do rodapé
        const fecharBtns = screen.getAllByRole('button', { name: /fechar/i })
        await user.click(fecharBtns[0])
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('exibe confirmação de exclusão ao clicar em Remover', async () => {
        const user = userEvent.setup()
        render(<ViewTaskModal {...defaultProps} />)
        await user.click(screen.getByRole('button', { name: /remover/i }))
        expect(screen.getByText('Remover tarefa')).toBeInTheDocument()
    })

    it('chama deleteTrelloCard e onDelete ao confirmar exclusão', async () => {
        const user = userEvent.setup()
        render(<ViewTaskModal {...defaultProps} />)

        await user.click(screen.getByRole('button', { name: /remover/i }))
        await user.click(screen.getByRole('button', { name: /sim, remover/i }))

        await waitFor(() => {
            expect(deleteTrelloCard).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'card-1' }))
            expect(defaultProps.onDelete).toHaveBeenCalledWith('card-1')
        })
    })

    it('carrega usuários Telegram ao abrir o picker de notificação', async () => {
        const user = userEvent.setup()
        getTelegramUsers.mockResolvedValue([
            { id: 'u1', name: 'João', chatId: '111' },
        ])
        render(<ViewTaskModal {...defaultProps} />)

        await user.click(screen.getByRole('button', { name: /notificar/i }))

        await waitFor(() => {
            expect(getTelegramUsers).toHaveBeenCalledWith('org-123')
        })
    })

    it('exibe "Sem status" quando a tarefa não tem status', () => {
        render(<ViewTaskModal {...defaultProps} task={{ ...fakeTask, status: '' }} />)
        expect(screen.getByText('Sem status')).toBeInTheDocument()
    })
})
