import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Check, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'

const CHAT_BG_PRESETS = [
  '#ffffff', '#e5e7eb', '#dbeafe', '#d1fae5',
  '#fef3c7', '#fce7f3', '#ede9fe', '#cffafe',
  '#fee2e2', '#fef9c3',
]

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>{title}</p>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width: '44px', height: '24px', borderRadius: '12px', background: value ? '#0059ff' : '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: value ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { token, user, updateUser } = useAuthStore()
  const { theme, setTheme, chatBg, setChatBg, chatPanelBg, setChatPanelBg, sidebarBg, setSidebarBg, chatListBg, setChatListBg, confirmDelete, setConfirmDelete } = useSettingsStore()

  // Смена логина
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const [savingUsername, setSavingUsername] = useState(false)

  const handleChangeUsername = async () => {
    setUsernameError('')
    setUsernameSuccess(false)
    const val = newUsername.trim().toLowerCase()
    if (!val) { setUsernameError('Введите новый логин'); return }
    if (val.length < 3) { setUsernameError('Минимум 3 символа'); return }
    if (!/^[a-z0-9_]+$/.test(val)) { setUsernameError('Только латинские буквы, цифры и _'); return }
    if (val === user?.username) { setUsernameError('Это уже ваш логин'); return }
    setSavingUsername(true)
    try {
      const res = await fetch('/api/auth/me/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: val }),
      })
      if (!res.ok) { const e = await res.json(); setUsernameError(e.detail || 'Ошибка'); return }
      const updated = await res.json()
      updateUser(updated)
      setUsernameSuccess(true)
      setNewUsername('')
    } catch { setUsernameError('Ошибка соединения') }
    finally { setSavingUsername(false) }
  }

  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [repPwd, setRepPwd] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const handleChangePassword = async () => {
    setPwdError('')
    setPwdSuccess(false)
    if (!curPwd || !newPwd || !repPwd) { setPwdError('Заполните все поля'); return }
    if (newPwd !== repPwd) { setPwdError('Пароли не совпадают'); return }
    if (newPwd.length < 6) { setPwdError('Минимум 6 символов'); return }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/auth/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: curPwd, new_password: newPwd }),
      })
      if (!res.ok) { const e = await res.json(); setPwdError(e.detail || 'Ошибка'); return }
      setPwdSuccess(true)
      setCurPwd(''); setNewPwd(''); setRepPwd('')
    } catch { setPwdError('Ошибка соединения') }
    finally { setSavingPwd(false) }
  }

  const inputStyle = (err) => ({
    width: '100%', height: '42px', background: '#f5f5f5', borderRadius: '12px',
    padding: '0 42px 0 14px', fontSize: '14px', border: err ? '1.5px solid #ef4444' : '1.5px solid transparent',
    outline: 'none', boxSizing: 'border-box', color: '#111827',
  })

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#ffffff', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Шапка */}
      <div style={{ height: '90px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 28px', gap: '16px', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
        <button onClick={() => navigate('/chat')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <ArrowLeft size={22} color="#6b7280" />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Настройки</h1>
      </div>

      <div style={{ maxWidth: '560px', width: '100%', margin: '32px auto', padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Аккаунт */}
        <Section title="Аккаунт">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Текущий логин:</p>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#0059ff', background: '#eff6ff', padding: '2px 10px', borderRadius: '8px' }}>@{user?.username}</span>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '5px' }}>Новый логин</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#9ca3af', pointerEvents: 'none' }}>@</span>
                <input
                  value={newUsername}
                  onChange={e => { setNewUsername(e.target.value.toLowerCase()); setUsernameError(''); setUsernameSuccess(false) }}
                  placeholder="новый_логин"
                  style={{ width: '100%', height: '42px', background: '#f5f5f5', borderRadius: '12px', padding: '0 14px 0 28px', fontSize: '14px', border: usernameError ? '1.5px solid #ef4444' : '1.5px solid transparent', outline: 'none', boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>Только латинские буквы, цифры и _ · Минимум 3 символа · Логины уникальны</p>
            {usernameError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{usernameError}</p>}
            {usernameSuccess && <p style={{ fontSize: '12px', color: '#16a34a' }}>Логин успешно изменён</p>}
            <button onClick={handleChangeUsername} disabled={savingUsername}
              style={{ height: '42px', borderRadius: '12px', border: 'none', background: savingUsername ? '#93c5fd' : '#0059ff', fontSize: '14px', fontWeight: 500, color: '#fff', cursor: savingUsername ? 'wait' : 'pointer' }}>
              {savingUsername ? 'Сохраняем...' : 'Изменить логин'}
            </button>
          </div>
        </Section>

        {/* Тема и цвета */}
        <Section title="Внешний вид">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Тема оформления</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Светлая или тёмная тема</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['light', 'Светлая', Sun], ['dark', 'Тёмная', Moon]].map(([val, label, Icon]) => (
                <button key={val} onClick={() => setTheme(val)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: theme === val ? '1.5px solid #0059ff' : '1.5px solid #e5e7eb', background: theme === val ? '#eff6ff' : '#fff', fontSize: '13px', fontWeight: 500, color: theme === val ? '#0059ff' : '#374151', cursor: 'pointer' }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Фон чата', value: chatBg, set: setChatBg },
            { label: 'Фон хедера и панели ввода', value: chatPanelBg, set: setChatPanelBg },
            { label: 'Фон списка чатов', value: chatListBg, set: setChatListBg },
            { label: 'Фон боковой панели', value: sidebarBg, set: setSidebarBg },
          ].map(({ label, value, set }) => (
            <div key={label} style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '10px' }}>{label}</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {CHAT_BG_PRESETS.map(color => (
                  <button key={color} onClick={() => set(color)}
                    style={{ width: '36px', height: '36px', borderRadius: '10px', background: color, border: value === color ? '2.5px solid #0059ff' : '2px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {value === color && <Check size={14} color="#0059ff" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Настройки чатов */}
        <Section title="Чаты">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Подтверждение удаления</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Спрашивать перед удалением сообщения</p>
            </div>
            <Toggle value={confirmDelete} onChange={setConfirmDelete} />
          </div>
        </Section>

        {/* Смена пароля */}
        <Section title="Безопасность">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Текущий пароль', value: curPwd, set: setCurPwd, show: showCur, setShow: setShowCur },
              { label: 'Новый пароль', value: newPwd, set: setNewPwd, show: showNew, setShow: setShowNew },
              { label: 'Повторите новый пароль', value: repPwd, set: setRepPwd, show: showNew, setShow: setShowNew },
            ].map(({ label, value, set, show, setShow }, i) => (
              <div key={i}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '5px' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input type={show ? 'text' : 'password'} value={value} onChange={e => { set(e.target.value); setPwdError(''); setPwdSuccess(false) }}
                    style={inputStyle(pwdError)} />
                  <button type="button" onClick={() => setShow(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                    {show ? <EyeOff size={15} color="#9ca3af" /> : <Eye size={15} color="#9ca3af" />}
                  </button>
                </div>
              </div>
            ))}

            {pwdError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{pwdError}</p>}
            {pwdSuccess && <p style={{ fontSize: '12px', color: '#16a34a' }}>Пароль успешно изменён</p>}

            <button onClick={handleChangePassword} disabled={savingPwd}
              style={{ marginTop: '4px', height: '42px', borderRadius: '12px', border: 'none', background: savingPwd ? '#93c5fd' : '#0059ff', fontSize: '14px', fontWeight: 500, color: '#fff', cursor: savingPwd ? 'wait' : 'pointer' }}>
              {savingPwd ? 'Сохраняем...' : 'Изменить пароль'}
            </button>
          </div>
        </Section>

      </div>
    </div>
  )
}
