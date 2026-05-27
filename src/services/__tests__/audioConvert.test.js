import { describe, it, expect, vi, beforeEach } from 'vitest'

// Módulos ffmpeg precisam ser mockados: usam WASM e Workers que não existem em jsdom
vi.mock('@ffmpeg/ffmpeg', () => {
    function FFmpegMock() {
        this.load = vi.fn().mockResolvedValue(undefined)
        this.on = vi.fn()
        this.off = vi.fn()
        this.writeFile = vi.fn().mockResolvedValue(undefined)
        this.exec = vi.fn().mockResolvedValue(undefined)
        this.readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
        this.deleteFile = vi.fn().mockResolvedValue(undefined)
    }
    return { FFmpeg: FFmpegMock }
})
vi.mock('@ffmpeg/util', () => ({ fetchFile: vi.fn().mockResolvedValue(new Uint8Array()) }))
vi.mock('@ffmpeg/core?url', () => ({ default: 'mock-core-url' }))
vi.mock('@ffmpeg/core/wasm?url', () => ({ default: 'mock-wasm-url' }))

import { needsConversion, convertToMp3 } from '../audioConvert.js'

describe('needsConversion', () => {
    it('retorna false para arquivo com tipo MIME audio/mpeg', () => {
        const file = new File([''], 'gravacao.mp3', { type: 'audio/mpeg' })
        expect(needsConversion(file)).toBe(false)
    })

    it('retorna false para arquivo com tipo MIME audio/mp3', () => {
        const file = new File([''], 'gravacao.mp3', { type: 'audio/mp3' })
        expect(needsConversion(file)).toBe(false)
    })

    it('retorna false para extensão .mp3 mesmo sem tipo MIME', () => {
        const file = new File([''], 'gravacao.mp3', { type: '' })
        expect(needsConversion(file)).toBe(false)
    })

    it('retorna true para arquivo WAV', () => {
        const file = new File([''], 'gravacao.wav', { type: 'audio/wav' })
        expect(needsConversion(file)).toBe(true)
    })

    it('retorna true para arquivo OGG', () => {
        const file = new File([''], 'gravacao.ogg', { type: 'audio/ogg' })
        expect(needsConversion(file)).toBe(true)
    })

    it('retorna true para arquivo M4A', () => {
        const file = new File([''], 'gravacao.m4a', { type: 'audio/mp4' })
        expect(needsConversion(file)).toBe(true)
    })

    it('retorna true para arquivo WEBM', () => {
        const file = new File([''], 'gravacao.webm', { type: 'audio/webm' })
        expect(needsConversion(file)).toBe(true)
    })

    it('trata extensão em maiúsculas como case-insensitive', () => {
        const file = new File([''], 'gravacao.MP3', { type: '' })
        expect(needsConversion(file)).toBe(false)
    })
})

describe('convertToMp3', () => {
    // O módulo mantém singletons (ffmpegInstance / ffmpegLoaded) entre chamadas.
    // Cada test isola o estado do módulo para evitar interferências.
    let convertToMp3Isolated

    beforeEach(async () => {
        vi.resetModules()
        const mod = await import('../audioConvert.js')
        convertToMp3Isolated = mod.convertToMp3
        // Garante que SharedArrayBuffer está disponível (como estaria com os headers COOP/COEP)
        if (typeof globalThis.SharedArrayBuffer === 'undefined') {
            globalThis.SharedArrayBuffer = ArrayBuffer
        }
    })

    it('lança erro quando SharedArrayBuffer não está disponível', async () => {
        const original = globalThis.SharedArrayBuffer
        // @ts-expect-error simula ambiente sem cross-origin isolation
        delete globalThis.SharedArrayBuffer

        const input = new File([''], 'audio.wav', { type: 'audio/wav' })
        await expect(convertToMp3Isolated(input, vi.fn())).rejects.toThrow(
            'Cross-Origin-Opener-Policy'
        )

        globalThis.SharedArrayBuffer = original
    })

    it('retorna um File com tipo audio/mpeg e nome .mp3', async () => {
        const input = new File(['audio-data'], 'reuniao.wav', { type: 'audio/wav' })
        const onProgress = vi.fn()

        const result = await convertToMp3Isolated(input, onProgress)

        expect(result).toBeInstanceOf(File)
        expect(result.type).toBe('audio/mpeg')
        expect(result.name).toBe('reuniao.mp3')
    })

    it('chama onProgress com 100 ao final da conversão', async () => {
        const input = new File(['audio-data'], 'reuniao.ogg', { type: 'audio/ogg' })
        const onProgress = vi.fn()

        await convertToMp3Isolated(input, onProgress)

        expect(onProgress).toHaveBeenCalledWith(100)
    })
})
