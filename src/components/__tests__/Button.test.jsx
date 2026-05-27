import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../Button.jsx'

describe('Button', () => {
    it('renderiza o texto filho', () => {
        render(<Button>Confirmar</Button>)
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    })

    it('usa type="button" por padrão', () => {
        render(<Button>Enviar</Button>)
        expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('usa o type fornecido via prop', () => {
        render(<Button type="submit">Salvar</Button>)
        expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('chama onClick ao ser clicado', async () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Clique</Button>)
        await userEvent.click(screen.getByRole('button'))
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('não dispara onClick quando desabilitado', async () => {
        const onClick = vi.fn()
        render(<Button disabled onClick={onClick}>Bloqueado</Button>)
        await userEvent.click(screen.getByRole('button'))
        expect(onClick).not.toHaveBeenCalled()
    })

    it('aplica className extra sem remover as classes base', () => {
        render(<Button className="mt-4">Estilizado</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('mt-4')
        expect(btn.className).toContain('bg-blue-600')
    })

    it('propaga atributos HTML arbitrários (data-testid, aria-label)', () => {
        render(<Button data-testid="btn-salvar" aria-label="Salvar reunião">OK</Button>)
        expect(screen.getByTestId('btn-salvar')).toHaveAttribute('aria-label', 'Salvar reunião')
    })
})
