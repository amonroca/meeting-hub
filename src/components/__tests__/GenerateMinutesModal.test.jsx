import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('../../services/meetingMinutes', () => ({
    generateMeetingMinutes: vi.fn().mockResolvedValue({ documentId: 'doc-1', webViewLink: 'https://docs.google.com' }),
    transcribeAudio: vi.fn().mockResolvedValue({ text: 'transcrição', jobId: 'job-1' }),
}))

vi.mock('../../services/audioConvert', () => ({
    convertToMp3: vi.fn().mockResolvedValue(new File([''], 'audio.mp3', { type: 'audio/mpeg' })),
    needsConversion: vi.fn().mockReturnValue(false),
}))

import GenerateMinutesModal from '../GenerateMinutesModal.jsx'

const fakeMeeting = {
    id: 'evt-1',
    title: 'Conselho de Estaca',
    meetingType: 'conselho_estaca',
    startAt: '2026-05-27T10:00:00.000Z',
}

const defaultProps = {
    meeting: fakeMeeting,
    organizationId: 'org-123',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
}

describe('GenerateMinutesModal', () => {
    it('renderiza o stepper com os 4 passos', () => {
        render(<GenerateMinutesModal {...defaultProps} />)
        // O stepper fica dentro da <nav aria-label="Progresso">
        const nav = screen.getByRole('navigation', { name: /progresso/i })
        expect(within(nav).getByText('\u00c1udio')).toBeInTheDocument()
        expect(within(nav).getByText('Transcri\u00e7\u00e3o')).toBeInTheDocument()
        expect(within(nav).getByText('Participantes')).toBeInTheDocument()
        expect(within(nav).getByText('Gerar ata')).toBeInTheDocument()
    })

    it('mostra o passo 1 (Áudio) inicialmente', () => {
        render(<GenerateMinutesModal {...defaultProps} />)
        // O t\u00edtulo da se\u00e7\u00e3o 1 é "Arquivo de \u00e1udio"
        expect(screen.getByText('Arquivo de \u00e1udio')).toBeInTheDocument()
    })

    it('exibe o botão Fechar no header', () => {
        render(<GenerateMinutesModal {...defaultProps} />)
        expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument()
    })

    it('exibe o título da reunião no modal', () => {
        render(<GenerateMinutesModal {...defaultProps} />)
        expect(screen.getByText('Conselho de Estaca')).toBeInTheDocument()
    })
})
