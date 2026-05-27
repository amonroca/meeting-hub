import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../../services/googleCalendar', () => ({
    isGoogleCalendarConfigured: true,
}))

vi.mock('../../services/organizationSettings', () => ({
    getOrganizationSettings: vi.fn().mockResolvedValue(null),
    saveOrganizationSettings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/telegram', () => ({
    generateTelegramLinkToken: vi.fn().mockResolvedValue('tok-abc'),
    getTelegramStatus: vi.fn().mockResolvedValue(null),
    unlinkTelegram: vi.fn().mockResolvedValue(undefined),
    listTelegramContacts: vi.fn().mockResolvedValue([]),
    addTelegramContact: vi.fn().mockResolvedValue({}),
    removeTelegramContact: vi.fn().mockResolvedValue(undefined),
    listOrgUsers: vi.fn().mockResolvedValue([]),
    updateUserNotificationTypes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/meetingMinutes', () => ({
    listMeetingTypeOptions: vi.fn().mockResolvedValue([]),
}))

import { useAuth } from '../../hooks/useAuth'
import SettingsPage from '../SettingsPage.jsx'

beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
        isConfigured: true,
        isAuthenticated: true,
        loading: false,
        user: { id: 'u1', name: 'Ana Souza', email: 'ana@test.com', organizationId: 'org-1', role: 'admin' },
    })
})

function renderSettings() {
    return render(
        <MemoryRouter>
            <SettingsPage />
        </MemoryRouter>
    )
}

describe('SettingsPage', () => {
    it('renderiza o título da página', () => {
        renderSettings()
        expect(screen.getByText(/configurações/i)).toBeInTheDocument()
    })

    it('exibe as abas de configuração para admin', async () => {
        renderSettings()
        await waitFor(() => {
            expect(screen.getByText('Perfil')).toBeInTheDocument()
            expect(screen.getByText('Usuários')).toBeInTheDocument()
            expect(screen.getByText('Google Drive')).toBeInTheDocument()
            expect(screen.getByText('Trello')).toBeInTheDocument()
        })
    })

    it('exibe somente a aba Perfil para não-admin', async () => {
        useAuth.mockReturnValue({
            isConfigured: true,
            isAuthenticated: true,
            loading: false,
            user: { id: 'u1', name: 'Paulo', email: 'paulo@test.com', organizationId: 'org-1', role: 'user' },
        })

        renderSettings()
        await waitFor(() => {
            // Não-admin vê conteúdo do perfil diretamente, sem abas de navegação
            expect(screen.getByText(/gerencie seu perfil/i)).toBeInTheDocument()
            expect(screen.queryByText('Usuários')).not.toBeInTheDocument()
            expect(screen.queryByText('Trello')).not.toBeInTheDocument()
        })
    })

    it('renderiza sem erros', async () => {
        renderSettings()
        await waitFor(() => {
            expect(document.body).toBeInTheDocument()
        })
    })
})
