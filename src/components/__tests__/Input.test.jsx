import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from '../Input.jsx'

describe('Input', () => {
    it('renderiza um elemento input', () => {
        render(<Input />)
        expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('aceita e exibe texto digitado', async () => {
        render(<Input />)
        const input = screen.getByRole('textbox')
        await userEvent.type(input, 'Reunião semanal')
        expect(input).toHaveValue('Reunião semanal')
    })

    it('encaminha o placeholder', () => {
        render(<Input placeholder="Digite o título" />)
        expect(screen.getByPlaceholderText('Digite o título')).toBeInTheDocument()
    })

    it('encaminha o atributo type', () => {
        render(<Input type="email" placeholder="Email" />)
        expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email')
    })

    it('aplica className extra sem remover as classes base', () => {
        render(<Input className="mb-2" />)
        const input = screen.getByRole('textbox')
        expect(input.className).toContain('mb-2')
        expect(input.className).toContain('rounded-2xl')
    })

    it('pode ser controlado com value + onChange', async () => {
        const { rerender } = render(<Input value="inicial" onChange={() => { }} />)
        expect(screen.getByRole('textbox')).toHaveValue('inicial')
        rerender(<Input value="atualizado" onChange={() => { }} />)
        expect(screen.getByRole('textbox')).toHaveValue('atualizado')
    })
})
