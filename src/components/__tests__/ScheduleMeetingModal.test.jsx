import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleMeetingModal from '../ScheduleMeetingModal.jsx'

const defaultProps = {
    meetingTypeOptions: [
        { value: 'conselho_estaca', label: 'Conselho de Estaca' },
        { value: '', label: 'Outro' }, // value vazio — não deve aparecer no select
    ],
    onClose: vi.fn(),
    onSuccess: vi.fn(),
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('ScheduleMeetingModal', () => {
    it('renderiza o título do modal', () => {
        render(<ScheduleMeetingModal {...defaultProps} />)
        expect(screen.getByText('Agendar reunião')).toBeInTheDocument()
    })

    it('renderiza apenas opções com value não vazio no select de tipo', () => {
        render(<ScheduleMeetingModal {...defaultProps} />)
        const options = screen.getAllByRole('option')
        const values = options.map((o) => o.value)
        expect(values).toContain('conselho_estaca')
        // opção com value='' fica apenas como "Selecione" placeholder
        const emptyOptions = options.filter((o) => o.value === '' && o.textContent !== 'Conselho de Estaca')
        expect(emptyOptions.length).toBe(1)
    })

    it('exibe erro quando submetido sem título', async () => {
        const user = userEvent.setup()
        render(<ScheduleMeetingModal {...defaultProps} />)
        await user.click(screen.getByRole('button', { name: /agendar/i }))
        expect(screen.getByText('Informe o título da reunião.')).toBeInTheDocument()
        expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    })

    it('exibe erro quando submetido sem data de início', async () => {
        const user = userEvent.setup()
        render(<ScheduleMeetingModal {...defaultProps} />)
        await user.type(screen.getByPlaceholderText(/presidência/i), 'Reunião de Teste')
        await user.click(screen.getByRole('button', { name: /agendar/i }))
        expect(screen.getByText('Informe a data e hora de início.')).toBeInTheDocument()
    })

    it('exibe erro quando término é antes ou igual ao início', async () => {
        const user = userEvent.setup()
        const { container } = render(<ScheduleMeetingModal {...defaultProps} />)

        await user.type(screen.getByPlaceholderText(/presidência/i), 'Reunião de Teste')

        // Define início e término com o mesmo horário via fireEvent
        const [startInput, endInput] = container.querySelectorAll('input[type="datetime-local"]')
        fireEvent.change(startInput, { target: { value: '2026-05-27T10:00' } })
        fireEvent.change(endInput, { target: { value: '2026-05-27T09:00' } })

        await user.click(screen.getByRole('button', { name: /agendar/i }))
        expect(screen.getByText(/término deve ser depois/i)).toBeInTheDocument()
    })

    it('fecha o modal ao pressionar Escape', () => {
        render(<ScheduleMeetingModal {...defaultProps} />)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('chama onClose ao clicar no botão Fechar', async () => {
        const user = userEvent.setup()
        render(<ScheduleMeetingModal {...defaultProps} />)
        await user.click(screen.getByRole('button', { name: /fechar/i }))
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('chama onSuccess com os dados corretos ao submeter formulário válido', async () => {
        const user = userEvent.setup()
        defaultProps.onSuccess.mockResolvedValue()
        const { container } = render(<ScheduleMeetingModal {...defaultProps} />)

        await user.type(screen.getByPlaceholderText(/presidência/i), 'Reunião de Teste')

        const [startInput, endInput] = container.querySelectorAll('input[type="datetime-local"]')
        fireEvent.change(startInput, { target: { value: '2026-05-27T10:00' } })
        fireEvent.change(endInput, { target: { value: '2026-05-27T11:00' } })

        await user.click(screen.getByRole('button', { name: /agendar/i }))

        expect(defaultProps.onSuccess).toHaveBeenCalledWith(
            expect.objectContaining({
                summary: 'Reunião de Teste',
                startAt: expect.any(String),
                endAt: expect.any(String),
            })
        )
    })

    it('ajusta o término automaticamente quando início é alterado e término está vazio', () => {
        const { container } = render(<ScheduleMeetingModal {...defaultProps} meetingTypeOptions={[]} />)

        const [startInput, endInput] = container.querySelectorAll('input[type="datetime-local"]')
        fireEvent.change(startInput, { target: { value: '2026-05-27T10:00' } })

        expect(endInput.value).not.toBe('')
    })
})
