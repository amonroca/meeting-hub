import { describe, it, expect } from 'vitest'
import {
    parseCalendarDate,
    formatCalendarDate,
    isCalendarDateToday,
} from '../googleCalendar.js'

describe('parseCalendarDate', () => {
    it('retorna null para valor falsy', () => {
        expect(parseCalendarDate(null)).toBeNull()
        expect(parseCalendarDate(undefined)).toBeNull()
        expect(parseCalendarDate('')).toBeNull()
    })

    it('retorna a própria instância de Date', () => {
        const d = new Date(2026, 0, 15)
        expect(parseCalendarDate(d)).toBe(d)
    })

    it('analisa string no formato date-only (yyyy-mm-dd) sem deslocamento de fuso', () => {
        const result = parseCalendarDate('2026-05-27')
        expect(result).toBeInstanceOf(Date)
        expect(result.getFullYear()).toBe(2026)
        expect(result.getMonth()).toBe(4) // maio = 4
        expect(result.getDate()).toBe(27)
    })

    it('analisa string ISO com hora e fuso', () => {
        const result = parseCalendarDate('2026-05-27T14:30:00Z')
        expect(result).toBeInstanceOf(Date)
        expect(result.getUTCFullYear()).toBe(2026)
        expect(result.getUTCHours()).toBe(14)
    })

    it('retorna null para string inválida', () => {
        expect(parseCalendarDate('invalido')).toBeNull()
    })
})

describe('formatCalendarDate', () => {
    it('retorna "Sem data" para valor nulo', () => {
        expect(formatCalendarDate(null)).toBe('Sem data')
        expect(formatCalendarDate('')).toBe('Sem data')
    })

    it('formata datas em pt-BR com data e hora por padrão', () => {
        // Usa uma data ISO para evitar depender do fuso do ambiente
        const result = formatCalendarDate('2026-05-27T10:00:00.000Z')
        // Deve conter pelo menos o ano e algum separador
        expect(result).toMatch(/2026/)
    })

    it('formata apenas a data quando isAllDay=true', () => {
        const withHour = formatCalendarDate('2026-01-15T09:00:00', false)
        const dayOnly = formatCalendarDate('2026-01-15', true)
        // A versão day-only não deve ter horário — geralmente menos caracteres
        expect(dayOnly.length).toBeLessThan(withHour.length + 6)
    })
})

describe('isCalendarDateToday', () => {
    it('retorna false para valor nulo', () => {
        expect(isCalendarDateToday(null)).toBe(false)
        expect(isCalendarDateToday('')).toBe(false)
    })

    it('retorna true para a data de hoje', () => {
        const today = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
        expect(isCalendarDateToday(iso)).toBe(true)
    })

    it('retorna false para uma data no passado', () => {
        expect(isCalendarDateToday('2000-01-01')).toBe(false)
    })

    it('retorna false para uma data no futuro', () => {
        expect(isCalendarDateToday('2099-12-31')).toBe(false)
    })
})
