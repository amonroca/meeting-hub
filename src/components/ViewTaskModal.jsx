import { useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { deleteTrelloCard, getTelegramUsers, sendTaskNotification } from '../services/meetingMinutes'
import { formatCalendarDate } from '../services/googleCalendar'

function statusClasses(status) {
    if (!status) return 'bg-slate-100 text-slate-500 ring-slate-200'
    const lower = status.toLowerCase()
    if (lower.includes('conclu') || lower.includes('done') || lower.includes('pronto')) {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    }
    if (lower.includes('andamento') || lower.includes('doing') || lower.includes('progresso')) {
        return 'bg-blue-50 text-blue-700 ring-blue-200'
    }
    return 'bg-amber-50 text-amber-700 ring-amber-200'
}

export default function ViewTaskModal({ task, organizationId, onClose, onDelete, onNotify }) {
    const [deleting, setDeleting] = useState(false)
    const [notifying, setNotifying] = useState(false)
    const [notificationsCount, setNotificationsCount] = useState(task.notificationsCount ?? 0)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [error, setError] = useState('')

    // Picker de destinatário Telegram
    const [showNotifyPicker, setShowNotifyPicker] = useState(false)
    const [telegramUsers, setTelegramUsers] = useState([])
    const [loadingTelegramUsers, setLoadingTelegramUsers] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const pickerSearchRef = useRef(null)

    const filteredUsers = useMemo(() => {
        const q = pickerSearch.toLowerCase().trim()
        if (!q) return telegramUsers
        return telegramUsers.filter((u) => u.name.toLowerCase().includes(q))
    }, [telegramUsers, pickerSearch])

    async function handleOpenNotifyPicker() {
        setShowNotifyPicker(true)
        setPickerSearch('')
        setSelectedUser(null)
        setLoadingTelegramUsers(true)
        try {
            const users = await getTelegramUsers(organizationId)
            setTelegramUsers(users)
        } catch {
            setTelegramUsers([])
        } finally {
            setLoadingTelegramUsers(false)
            setTimeout(() => pickerSearchRef.current?.focus(), 50)
        }
    }

    async function handleSendNotification() {
        if (!selectedUser) return
        setNotifying(true)
        setError('')
        try {
            const result = await sendTaskNotification({
                organizationId,
                cardId: task.id,
                minuteId: task.minuteId,
                cardName: task.name,
                meetingTitle: task.meetingTitle || task.meetingTypeLabel || '',
                description: task.description || undefined,
                recipientChatId: selectedUser.chatId,
                recipientName: selectedUser.name,
            })
            const newCount = result.notificationsCount ?? notificationsCount + 1
            setNotificationsCount(newCount)
            onNotify?.(task.id, newCount)
            setShowNotifyPicker(false)
        } catch (err) {
            setError(err.message || 'Falha ao enviar notificação.')
            setShowNotifyPicker(false)
        } finally {
            setNotifying(false)
        }
    }

    async function handleDelete() {
        setDeleting(true)
        setConfirmDelete(false)
        setError('')
        try {
            await deleteTrelloCard({
                organizationId,
                cardId: task.id,
                minuteId: task.minuteId,
            })
            onDelete(task.id)
        } catch (err) {
            setError(err.message || 'Falha ao remover. Tente novamente.')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose() }}
            >
                <div className="flex w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 max-h-[90vh]">
                    {/* Header */}
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div className="min-w-0">
                            <h2 className="break-words text-lg font-semibold text-slate-900">{task.name}</h2>
                            {task.url && (
                                <a
                                    href={task.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-0.5 block break-all text-xs text-blue-600 hover:underline"
                                >
                                    Ver no Trello
                                </a>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={deleting}
                            className="mt-0.5 shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                            aria-label="Fechar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                            </svg>
                        </button>
                    </div>

                    {/* Detalhes */}
                    <div className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-6 py-5">
                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                            {task.status ? (
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusClasses(task.status)}`}>
                                    {task.status}
                                </span>
                            ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                                    Sem status
                                </span>
                            )}
                            {task.daysOpen != null && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                    ⏱ {task.daysOpen}d em aberto
                                </span>
                            )}
                            {notificationsCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                    📨 {notificationsCount} notificação(ões)
                                </span>
                            )}
                        </div>

                        {/* Campos */}
                        <div className="space-y-3">
                            {task.responsible && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Responsável</p>
                                    <p className="mt-0.5 text-sm text-slate-900">{task.responsible}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reunião</p>
                                <p className="mt-0.5 text-sm text-slate-900">
                                    {task.meetingTypeLabel} · {formatCalendarDate(task.meetingAt)}
                                </p>
                            </div>
                            {task.description && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descrição</p>
                                    <div className="mt-0.5 break-words text-sm text-slate-700
                                    [&_p]:mb-2 [&_p:last-child]:mb-0
                                    [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4
                                    [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4
                                    [&_li]:mb-0.5
                                    [&_strong]:font-semibold [&_em]:italic
                                    [&_a]:break-all [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800
                                    [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1
                                    [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1
                                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1
                                    [&_code]:break-all [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
                                    [&_pre]:overflow-x-auto
                                    [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: '#2563eb', textDecoration: 'underline' }}
                                                    >
                                                        {children}
                                                    </a>
                                                ),
                                            }}
                                        >
                                            {task.description}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex shrink-0 justify-between gap-3 border-t border-slate-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            disabled={deleting || notifying}
                            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Remover
                        </button>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleOpenNotifyPicker}
                                disabled={notifying || deleting}
                                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {notifying ? 'Enviando…' : '📨 Notificar'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={deleting}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Picker de destinatário Telegram */}
            {showNotifyPicker && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowNotifyPicker(false) }}
                >
                    <div className="flex w-full max-w-sm flex-col rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                            <h3 className="text-base font-semibold text-slate-900">Notificar via Telegram</h3>
                            <button
                                type="button"
                                onClick={() => setShowNotifyPicker(false)}
                                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Fechar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-4 pt-4">
                            <input
                                ref={pickerSearchRef}
                                type="text"
                                placeholder="Buscar pessoa…"
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>
                        <div className="max-h-56 overflow-y-auto px-4 py-3">
                            {loadingTelegramUsers ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-2xl bg-slate-100" />)}
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-400">
                                    {telegramUsers.length === 0 ? 'Nenhum usuário com Telegram vinculado.' : 'Nenhum resultado.'}
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {filteredUsers.map((u) => (
                                        <button
                                            key={u.chatId}
                                            type="button"
                                            onClick={() => setSelectedUser(u)}
                                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm transition ${selectedUser?.chatId === u.chatId
                                                ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                                                : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <span className="font-medium">{u.name}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.type === 'member' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {u.type === 'member' ? 'Membro' : 'Externo'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setShowNotifyPicker(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSendNotification}
                                disabled={!selectedUser || notifying}
                                className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {notifying ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de remoção */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                        <div className="px-6 py-5">
                            <h3 className="text-base font-semibold text-slate-900">Remover tarefa</h3>
                            <p className="mt-2 text-sm text-slate-600">
                                Esta ação removerá o card do Trello e da ata. Não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                                Sim, remover
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
