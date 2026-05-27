import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../services/meetingMinutes', () => ({
    getTrelloBoardLists: vi.fn().mockResolvedValue([]),
    updateTrelloCard: vi.fn(),
}))

import { getTrelloBoardLists, updateTrelloCard } from '../../services/meetingMinutes'
import EditTaskModal from '../EditTaskModal.jsx'

const fakeTask = {
    id: 'card-1',
    minuteId: 'min-1',
    name: 'Minha tarefa de teste',
    responsible: 'João Silva',
    description: 'Descrição da tarefa',
    statusListId: 'list-1',
    status: 'Em andamento',
}

const defaultProps = {
    task: fakeTask,
    organizationId: 'org-123',
    onClose: vi.fn(),
    onSave: vi.fn(),
}

beforeEach(() => {
    vi.clearAllMocks()
    getTrelloBoardLists.mockResolvedValue([])
    updateTrelloCard.mockResolvedValue({ name: 'Tarefa Atualizada', idList: 'list-1', desc: '', url: '' })
})

describe('EditTaskModal', () => {
    it('renderiza o modal com o nome da tarefa', async () => {
        render(<EditTaskModal {...defaultProps} />)
        await waitFor(() => {
            expect(screen.getByDisplayValue('Minha tarefa de teste')).toBeInTheDocument()
        })
    })

    it('chama getTrelloBoardLists ao montar', async () => {
        render(<EditTaskModal {...defaultProps} />)
        await waitFor(() => {
            expect(getTrelloBoardLists).toHaveBeenCalledWith('org-123', 'card-1')
        })
    })

    it('exibe erro quando o título é submetido vazio', async () => {
        const { container } = render(<EditTaskModal {...defaultProps} />)

        // Aguarda carregamento das listas
        await waitFor(() => expect(getTrelloBoardLists).toHaveBeenCalled())

        const titleInput = screen.getByDisplayValue('Minha tarefa de teste')
        // Limpa o campo de título via fireEvent para contornar botão desabilitado
        fireEvent.change(titleInput, { target: { value: '' } })

        // Submete o formulário diretamente (botão fica disabled com título vazio)
        const form = container.querySelector('form')
        fireEvent.submit(form)

        expect(screen.getByText('O título é obrigatório.')).toBeInTheDocument()
        expect(updateTrelloCard).not.toHaveBeenCalled()
    })

    it('chama updateTrelloCard e onSave ao submeter formulário válido', async () => {
        const user = userEvent.setup()
        render(<EditTaskModal {...defaultProps} />)

        await waitFor(() => expect(getTrelloBoardLists).toHaveBeenCalled())

        await user.click(screen.getByRole('button', { name: /salvar/i }))

        await waitFor(() => {
            expect(updateTrelloCard).toHaveBeenCalled()
            expect(defaultProps.onSave).toHaveBeenCalled()
        })
    })

    it('fecha ao pressionar Escape quando não está salvando', async () => {
        render(<EditTaskModal {...defaultProps} />)
        await waitFor(() => expect(getTrelloBoardLists).toHaveBeenCalled())

        const { fireEvent } = await import('@testing-library/react')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('exibe erro quando updateTrelloCard falha', async () => {
        updateTrelloCard.mockRejectedValue(new Error('Falha na API'))
        const user = userEvent.setup()
        render(<EditTaskModal {...defaultProps} />)

        await waitFor(() => expect(getTrelloBoardLists).toHaveBeenCalled())
        await user.click(screen.getByRole('button', { name: /salvar/i }))

        await waitFor(() => {
            expect(screen.getByText(/Falha na API/i)).toBeInTheDocument()
        })
    })
})
