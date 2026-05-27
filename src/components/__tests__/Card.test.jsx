import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from '../Card.jsx'

describe('Card', () => {
    it('renderiza os filhos passados', () => {
        render(<Card>Conteúdo do Card</Card>)
        expect(screen.getByText('Conteúdo do Card')).toBeInTheDocument()
    })

    it('aplica classes de estilo base', () => {
        const { container } = render(<Card>Texto</Card>)
        const div = container.firstChild
        expect(div.className).toMatch(/rounded/)
        expect(div.className).toMatch(/shadow/)
    })

    it('aceita e mescla className adicional', () => {
        const { container } = render(<Card className="minha-classe">Texto</Card>)
        expect(container.firstChild.className).toMatch(/minha-classe/)
    })

    it('encaminha atributos extras para o div', () => {
        render(<Card data-testid="meu-card">Texto</Card>)
        expect(screen.getByTestId('meu-card')).toBeInTheDocument()
    })

    it('renderiza múltiplos filhos', () => {
        render(
            <Card>
                <span>Filho 1</span>
                <span>Filho 2</span>
            </Card>
        )
        expect(screen.getByText('Filho 1')).toBeInTheDocument()
        expect(screen.getByText('Filho 2')).toBeInTheDocument()
    })
})
