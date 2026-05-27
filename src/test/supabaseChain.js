import { vi } from 'vitest'

/**
 * Cria um objeto que simula o encadeamento de queries do Supabase.
 * É thenable (pode ser usado com await) e possui os métodos mais comuns.
 */
export function createChain(result = { data: null, error: null }) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
        single: vi.fn().mockResolvedValue(result),
        // Torna a chain awaitable (para padrões como: const { data } = await query)
        then: (r, e) => Promise.resolve(result).then(r, e),
        catch: (fn) => Promise.resolve(result).catch(fn),
        finally: (fn) => Promise.resolve(result).finally(fn),
    }
    return chain
}
