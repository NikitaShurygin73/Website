import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, X, Send, Shield } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  BackgroundPattern,
  AuthCard,
  AuthHeader,
  AuthInput,
  AuthButton,
  AuthLink,
  LogoIcon,
} from '../components/AuthLayout'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSending, setForgotSending] = useState(false)
  const INIT_MSG = { sender: 'admin', text: 'Привет! Укажите ваш логин и опишите проблему — администратор получит заявку и сможет ответить прямо здесь.' }
  const [chatMessages, setChatMessages] = useState([INIT_MSG])
  const [ticketId, setTicketId] = useState(null)
  const [seenReplyIds, setSeenReplyIds] = useState(new Set())
  const chatBottomRef = useRef(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!ticketId || !showForgot) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/support/${ticketId}/messages`)
        if (!res.ok) return
        const data = await res.json()
        setSeenReplyIds(prev => {
          const newIds = new Set(prev)
          const toAdd = data.replies.filter(r => !prev.has(r.id))
          if (!toAdd.length) return prev
          toAdd.forEach(r => newIds.add(r.id))
          setChatMessages(msgs => [...msgs, ...toAdd.map(r => ({ sender: 'admin', text: r.message }))])
          return newIds
        })
      } catch {}
    }
    const interval = setInterval(poll, 4000)
    return () => clearInterval(interval)
  }, [ticketId, showForgot])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleForgotSend = async () => {
    setForgotError('')
    if (!forgotUsername.trim() || !forgotMsg.trim()) { setForgotError('Заполните все поля'); return }
    setForgotSending(true)
    try {
      const res = await fetch('/api/auth/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername.trim(), message: forgotMsg.trim() }),
      })
      if (!res.ok) { const e = await res.json(); setForgotError(e.detail || 'Ошибка'); return }
      const data = await res.json()
      setTicketId(data.ticket_id)
      const userText = `Логин: ${forgotUsername.trim()}\n${forgotMsg.trim()}`
      setChatMessages(prev => [
        ...prev,
        { sender: 'user', text: userText },
        { sender: 'admin', text: 'Заявка принята! Ожидайте — администратор ответит прямо здесь.' },
      ])
      setForgotMsg('')
    } catch { setForgotError('Ошибка соединения') }
    finally { setForgotSending(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
      <BackgroundPattern />

      <AuthCard>
        <LogoIcon 
          className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px]" 
          style={{ marginBottom: '25px' }}
        />

        <div className="w-full max-w-[388px] flex flex-col items-start gap-10">
          <AuthHeader
            title="ВОЙТИ"
            subtitle="Для входа введите свой логин и пароль"
          />

          {error && (
            <div className="w-full p-3 bg-red-50 border border-red-200 rounded-[12px] text-red-600 text-[12px] leading-[16px] text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
            <AuthInput
              label="Логин"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
            />

            <AuthInput
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            >
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center justify-center text-[#999999] hover:text-[#121F24] transition shrink-0"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </AuthInput>

            <div className="pt-4">
              <AuthButton loading={loading}>
                Войти
              </AuthButton>
            </div>

            <div className="w-full flex flex-col items-center gap-2 pt-3">
              <button type="button" onClick={() => setShowForgot(true)}
                className="font-medium text-[13px] leading-[17px] text-[#0059FF] hover:underline bg-transparent border-none cursor-pointer"
                style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Забыл пароль
              </button>
              <AuthLink to="/register">Зарегистрироваться</AuthLink>
            </div>
          </form>
        </div>
      </AuthCard>

      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '390px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh' }}>
            {/* Шапка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={18} color="#0059ff" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Администратор</p>
                <p style={{ fontSize: '12px', color: '#22c55e' }}>Поддержка системы</p>
              </div>
              <button onClick={() => { setShowForgot(false); setForgotUsername(''); setForgotMsg(''); setForgotError(''); setChatMessages([{ sender: 'admin', text: 'Привет! Укажите ваш логин и опишите проблему — администратор получит заявку и сбросит пароль.' }]) }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={18} color="#6b7280" />
              </button>
            </div>

            {/* Сообщения чата поддержки */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fafb', minHeight: '200px', maxHeight: '280px' }}>
              {chatMessages.map((msg, i) => (
                msg.sender === 'admin' ? (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield size={12} color="#0059ff" />
                    </div>
                    <div style={{ background: '#fff', borderRadius: '4px 14px 14px 14px', padding: '9px 13px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', maxWidth: '78%' }}>
                      <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#0059ff', borderRadius: '14px 14px 4px 14px', padding: '9px 13px', maxWidth: '78%' }}>
                      <p style={{ fontSize: '13px', color: '#fff', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    </div>
                  </div>
                )
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Ввод заявки */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '7px', flexShrink: 0 }}>
              <input value={forgotUsername} onChange={e => setForgotUsername(e.target.value)}
                placeholder="Ваш логин"
                style={{ height: '34px', background: '#f5f5f5', borderRadius: '9px', padding: '0 12px', fontSize: '13px', border: '1.5px solid transparent', outline: 'none', color: '#111827' }}
                onFocus={e => e.target.style.border = '1.5px solid #0059ff'}
                onBlur={e => e.target.style.border = '1.5px solid transparent'} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea value={forgotMsg} onChange={e => setForgotMsg(e.target.value)}
                  placeholder="Опишите проблему..."
                  rows={2}
                  style={{ flex: 1, background: '#f5f5f5', borderRadius: '9px', padding: '7px 12px', fontSize: '13px', border: '1.5px solid transparent', outline: 'none', resize: 'none', color: '#111827', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.border = '1.5px solid #0059ff'}
                  onBlur={e => e.target.style.border = '1.5px solid transparent'}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleForgotSend() } }} />
                <button onClick={handleForgotSend} disabled={forgotSending}
                  style={{ width: '35px', height: '35px', borderRadius: '50%', border: 'none', background: '#0059ff', cursor: forgotSending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={14} color="#fff" />
                </button>
              </div>
              {forgotError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{forgotError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
