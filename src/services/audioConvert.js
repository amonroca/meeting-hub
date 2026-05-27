import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let ffmpegInstance = null
let ffmpegLoaded = false

const MP3_EXTS = new Set(['.mp3'])
const MP3_TYPES = new Set(['audio/mp3', 'audio/mpeg'])

/**
 * Retorna `true` se o arquivo precisa ser convertido para MP3.
 * @param {File} file
 */
export function needsConversion(file) {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
    return !MP3_TYPES.has(file.type.toLowerCase()) && !MP3_EXTS.has(ext)
}

/**
 * Carrega e retorna a instância singleton do FFmpeg (single-thread).
 * O core é baixado do CDN via blob URL na primeira chamada (~30 MB).
 */
async function getFFmpeg() {
    if (!ffmpegInstance) {
        ffmpegInstance = new FFmpeg()
    }
    if (!ffmpegLoaded) {
        // SharedArrayBuffer é obrigatório para @ffmpeg/ffmpeg v0.12+.
        // Ele só fica disponível quando a página está cross-origin isolated
        // (headers COOP + COEP definidos no servidor).
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error(
                'Conversão de áudio não disponível: o servidor precisa enviar os headers ' +
                'Cross-Origin-Opener-Policy: same-origin e Cross-Origin-Embedder-Policy: credentialless.'
            )
        }
        try {
            await ffmpegInstance.load({ coreURL, wasmURL })
            ffmpegLoaded = true
        } catch (err) {
            ffmpegInstance = null // reseta para permitir nova tentativa
            throw new Error(`Falha ao carregar o conversor de áudio: ${err.message ?? err}`)
        }
    }
    return ffmpegInstance
}

/**
 * Converte um arquivo de áudio para MP3 usando ffmpeg.wasm no browser.
 *
 * @param {File} file  Arquivo de entrada (qualquer formato suportado pelo FFmpeg)
 * @param {(progress: number) => void} onProgress  Callback com 0–100 (inteiro)
 * @returns {Promise<File>}  Arquivo MP3 resultante
 */
export async function convertToMp3(file, onProgress) {
    const ff = await getFFmpeg()

    const progressHandler = ({ progress }) => {
        onProgress(Math.min(99, Math.round(progress * 100)))
    }
    ff.on('progress', progressHandler)

    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
    const inputName = `input.${ext}`
    const outputName = 'output.mp3'

    try {
        await ff.writeFile(inputName, await fetchFile(file))
        await ff.exec([
            '-i', inputName,
            '-vn',           // descarta faixas de vídeo
            '-ar', '44100',  // sample rate 44.1 kHz
            '-ac', '2',      // estéreo
            '-b:a', '128k',  // bitrate
            '-y',            // sobrescreve saída
            outputName,
        ])

        const data = await ff.readFile(outputName)
        onProgress(100)

        const mp3Name = file.name.replace(/\.[^.]+$/, '.mp3')
        return new File([data.buffer], mp3Name, { type: 'audio/mpeg' })
    } finally {
        ff.off('progress', progressHandler)
        try { await ff.deleteFile(inputName) } catch { /* ignora */ }
        try { await ff.deleteFile(outputName) } catch { /* ignora */ }
    }
}
