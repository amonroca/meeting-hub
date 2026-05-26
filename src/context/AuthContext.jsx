import { createContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(undefined)

function formatAuthError(error) {
  const message = error?.message || 'Falha na autenticação.'
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Email ou senha inválidos.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirme o email antes de entrar.'
  }

  if (normalized.includes('user already registered')) {
    return 'Usuário já cadastrado. Faça login.'
  }

  return message
}

async function buildUserProfile(sessionUser) {
  if (!supabase || !sessionUser) {
    return null
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role, organization_id, avatar_url, is_active')
    .eq('id', sessionUser.id)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao carregar perfil do usuário:', error)
  }

  return {
    id: sessionUser.id,
    email: data?.email || sessionUser.email,
    name:
      data?.full_name ||
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split('@')[0] ||
      'Usuário',
    role: data?.role || 'user',
    organizationId: data?.organization_id || null,
    avatarUrl: data?.avatar_url || null,
    isActive: data?.is_active ?? true,
  }
}

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutos

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Timer de inatividade: desloga após 30 min sem interação
  useEffect(() => {
    if (!session || !supabase) return undefined

    let timer

    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void supabase.auth.signOut()
      }, INACTIVITY_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [session])

  useEffect(() => {
    let isMounted = true

    const syncSession = async (nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)

      if (!nextSession?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      const profile = await buildUserProfile(nextSession.user)

      if (isMounted) {
        setUser(profile)
        setLoading(false)
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao recuperar sessão:', error)
      }

      void syncSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error('Informe email e senha.')
    }

    if (!supabase) {
      throw new Error('Configure o Supabase para habilitar o login.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error(formatAuthError(error))
    }

    return data
  }

  const register = async (fullName, email, password) => {
    if (!fullName || !email || !password) {
      throw new Error('Informe nome completo, email e senha.')
    }

    if (!supabase) {
      throw new Error('Configure o Supabase para habilitar o cadastro.')
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/email-confirmation`
            : undefined,
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      throw new Error(formatAuthError(error))
    }

    return data
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setSession(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      isConfigured: isSupabaseConfigured,
      isAuthenticated: Boolean(session?.user),
      login,
      register,
      logout,
    }),
    [session, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
