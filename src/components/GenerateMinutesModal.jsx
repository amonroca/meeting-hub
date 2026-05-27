import { useEffect, useRef, useState } from 'react'
import { generateMeetingMinutes, transcribeAudio } from '../services/meetingMinutes'
import { convertToMp3, needsConversion } from '../services/audioConvert'

const MIN_TRANSCRIPT_LENGTH = 50
const ACCEPTED_AUDIO_TYPES = '.mp3,.m4a,.wav,.ogg,.webm,.flac,.mp4'
const MAX_AUDIO_MB = 200

// ── Stepper ────────────────────────────────────────────────────────────────
const STEPS = [
    { id: 1, label: 'Áudio' },
    { id: 2, label: 'Transcrição' },
    { id: 3, label: 'Participantes' },
    { id: 4, label: 'Gerar ata' },
]

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
    )
}

function StepperBar({ currentStep }) {
    return (
        <nav aria-label="Progresso" className="mb-6 flex items-start">
            {STEPS.map((step, idx) => {
                const done = step.id < currentStep
                const active = step.id === currentStep
                return (
                    <div key={step.id} className="flex flex-1 flex-col items-center">
                        <div className="flex w-full items-center">
                            {idx > 0 && (
                                <div className={`h-px flex-1 transition-colors ${done || active ? 'bg-blue-400' : 'bg-slate-200'}`} />
                            )}
                            <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${done
                                    ? 'bg-blue-600 text-white'
                                    : active
                                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                        : 'bg-slate-100 text-slate-400'
                                }`}>
                                {done ? <CheckIcon /> : step.id}
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`h-px flex-1 transition-colors ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                            )}
                        </div>
                        <span className={`mt-1.5 text-[11px] font-medium ${active ? 'text-blue-600' : done ? 'text-blue-500' : 'text-slate-400'}`}>
                            {step.label}
                        </span>
                    </div>
                )
            })}
        </nav>
    )
}

// ── Barra de progresso ────────────────────────────────────────────────────
function ProgressBar({ value, indeterminate = false }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            {indeterminate ? (
                <div
                    className="h-full w-full rounded-full"
                    style={{
                        backgroundImage: 'linear-gradient(90deg, #2563eb 0%, #93c5fd 40%, #2563eb 80%)',
                        backgroundSize: '200% 100%',
                        animation: 'progress-shimmer 1.4s linear infinite',
                    }}
                />
            ) : (
                <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${value ?? 0}%` }}
                />
            )}
        </div>
    )
}

// ── Cabeçalho de seção ────────────────────────────────────────────────────
function SectionHeader({ number, title, subtitle, done }) {
    return (
        <div className="mb-3 flex items-start gap-2.5">
            <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                {done ? <CheckIcon /> : number}
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
        </div>
    )
}

// ── Modal principal ───────────────────────────────────────────────────────
export default function GenerateMinutesModal({ meeting, organizationId, onClose, onSuccess }) {
    const [currentStep, setCurrentStep] = useState(1)

    // Seção 1 — Áudio
    const [audioFile, setAudioFile] = useState(null)
    const [converting, setConverting] = useState(false)
    const [convertProgress, setConvertProgress] = useState(0)
    const [transcribing, setTranscribing] = useState(false)
    const [audioError, setAudioError] = useState('')
    const audioInputRef = useRef(null)

    // Seção 2 — Transcrição
    const [transcript, setTranscript] = useState('')

    // Seção 3 — Participantes
    const [attendees, setAttendees] = useState('')

    // Seção 4 — Gerar ata
    const [generating, setGenerating] = useState(false)
    const [genError, setGenError] = useState('')

    const isBusy = converting || transcribing || generating

    // Fecha com Escape
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape' && !isBusy) onClose() }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isBusy, onClose])

    function handleAudioChange(e) {
        const file = e.target.files?.[0] ?? null
        setAudioError('')
        if (!file) { setAudioFile(null); return }
        if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
            setAudioError(`O arquivo excede o limite de ${MAX_AUDIO_MB} MB.`)
            setAudioFile(null)
            e.target.value = ''
            return
        }
        setAudioFile(file)
    }

    async function handleTranscribe() {
        if (!audioFile) return
        setAudioError('')
        setCurrentStep(2)

        let fileToTranscribe = audioFile

        if (needsConversion(audioFile)) {
            setConverting(true)
            setConvertProgress(0)
            try {
                fileToTranscribe = await convertToMp3(audioFile, setConvertProgress)
            } catch (err) {
                setAudioError(err.message || 'Falha na conversão do áudio.')
                setConverting(false)
                setCurrentStep(1)
                return
            }
            setConverting(false)
        }

        setTranscribing(true)
        try {
            const text = await transcribeAudio(fileToTranscribe)
            setTranscript(text)
            setCurrentStep((s) => Math.max(s, 3))
        } catch (err) {
            setAudioError(err.message || 'Falha na transcrição do áudio.')
            setCurrentStep(1)
        } finally {
            setTranscribing(false)
        }
    }

    async function handleGenerate() {
        if (transcript.trim().length < MIN_TRANSCRIPT_LENGTH) return
        setGenError('')
        setGenerating(true)
        setCurrentStep(4)
        try {
            const attendeeList = attendees.split(',').map((a) => a.trim()).filter(Boolean)
            const result = await generateMeetingMinutes({
                googleEventId: meeting.id,
                title: meeting.title,
                meetingType: meeting.meetingType,
                meetingAt: meeting.startAt,
                transcript: transcript.trim(),
                organizationId,
                attendees: attendeeList,
            })
            onSuccess(result)
        } catch (err) {
            setGenError(err.message || 'Erro ao gerar a ata. Tente novamente.')
        } finally {
            setGenerating(false)
        }
    }

    const transcriptReady = transcript.trim().length >= MIN_TRANSCRIPT_LENGTH

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isBusy) onClose() }}
        >
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">

                {/* Header */}
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Gerar ata</h2>
                        <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{meeting.title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isBusy}
                        className="mt-0.5 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                        aria-label="Fechar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                    </button>
                </div>

                {/* Stepper */}
                <StepperBar currentStep={currentStep} />

                <div className="space-y-3">

                    {/* ── Seção 1: Arquivo de áudio ── */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <SectionHeader
                            number="1"
                            title="Arquivo de áudio"
                            subtitle="MP3 · M4A · WAV · OGG · WEBM · FLAC · MP4 · até 200 MB"
                            done={currentStep > 1 && !converting && !transcribing}
                        />

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                ref={audioInputRef}
                                type="file"
                                accept={ACCEPTED_AUDIO_TYPES}
                                onChange={handleAudioChange}
                                disabled={isBusy}
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-600 hover:file:bg-slate-200 disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={handleTranscribe}
                                disabled={!audioFile || isBusy}
                                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {converting ? 'Convertendo…' : transcribing ? 'Transcrevendo…' : 'Transcrever →'}
                            </button>
                        </div>

                        {/* Progresso da conversão */}
                        {converting && (
                            <div className="mt-3">
                                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                    <span>Convertendo para MP3…</span>
                                    <span className="font-semibold text-blue-600">{convertProgress}%</span>
                                </div>
                                <ProgressBar value={convertProgress} />
                            </div>
                        )}

                        {/* Loading da transcrição */}
                        {transcribing && (
                            <div className="mt-3">
                                <div className="mb-1 text-xs text-slate-500">Transcrevendo com Azure Speech…</div>
                                <ProgressBar indeterminate />
                            </div>
                        )}

                        {audioError && (
                            <p className="mt-2 text-xs text-red-600">{audioError}</p>
                        )}

                        {!converting && !transcribing && (
                            <p className="mt-2.5 text-xs text-slate-400">
                                Já tem a transcrição?{' '}
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep((s) => Math.max(s, 2))}
                                    className="text-blue-500 underline-offset-2 hover:underline"
                                >
                                    Cole-a diretamente na seção abaixo
                                </button>.
                            </p>
                        )}
                    </div>

                    {/* ── Seção 2: Transcrição ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <SectionHeader
                            number="2"
                            title="Transcrição"
                            subtitle="Cole a transcrição ou aguarde o processamento do áudio"
                            done={transcriptReady && !transcribing}
                        />

                        {transcribing ? (
                            <div className="flex flex-col items-center gap-3 py-6">
                                <div className="size-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                                <p className="text-sm text-slate-500">Transcrevendo o áudio…</p>
                            </div>
                        ) : (
                            <>
                                <textarea
                                    value={transcript}
                                    onChange={(e) => {
                                        setTranscript(e.target.value)
                                        if (e.target.value.length > 0) setCurrentStep((s) => Math.max(s, 2))
                                    }}
                                    rows={7}
                                    placeholder="Cole aqui a transcrição completa da reunião…"
                                    disabled={generating}
                                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                                />
                                <div className="mt-1 flex items-center justify-between gap-2">
                                    {transcript.length > 0 && !transcriptReady ? (
                                        <p className="text-xs text-amber-500">Mínimo de {MIN_TRANSCRIPT_LENGTH} caracteres para gerar a ata.</p>
                                    ) : <span />}
                                    <span className="shrink-0 text-xs text-slate-400">{transcript.length} caracteres</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Seção 3: Participantes ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <SectionHeader
                            number="3"
                            title="Participantes"
                            subtitle="Opcional — separados por vírgula"
                            done={attendees.trim().length > 0}
                        />
                        <input
                            type="text"
                            value={attendees}
                            onChange={(e) => {
                                setAttendees(e.target.value)
                                if (e.target.value.length > 0) setCurrentStep((s) => Math.max(s, 3))
                            }}
                            placeholder="Ex: João Silva, Maria Santos, Pedro Oliveira"
                            disabled={generating}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </div>

                    {/* ── Seção 4: Gerar ata ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <SectionHeader
                            number="4"
                            title="Gerar ata"
                            subtitle="A ata será criada no Google Drive da organização"
                        />

                        {genError && (
                            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {genError}
                            </div>
                        )}

                        {generating && (
                            <div className="mb-3">
                                <div className="mb-1 text-xs text-slate-500">Gerando ata com IA…</div>
                                <ProgressBar indeterminate />
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isBusy}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={isBusy || !transcriptReady}
                                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {generating ? 'Gerando ata…' : 'Gerar ata →'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
