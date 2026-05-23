import { useState, useRef } from 'react'
import { X, Camera } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function EditProfilePanel({ onClose }) {
  const { user, token, updateUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
    setPendingAvatarFile(file)
  }

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Имя не может быть пустым'); return }
    setSaving(true)
    setError('')
    try {
      let avatarUrl = user?.avatar_url || null

      if (pendingAvatarFile) {
        const formData = new FormData()
        formData.append('file', pendingAvatarFile)
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!uploadRes.ok) throw new Error('Ошибка загрузки аватарки')
        const uploadData = await uploadRes.json()
        avatarUrl = uploadData.url
      }

      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName.trim(), avatar_url: avatarUrl }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Ошибка сохранения')
      }
      const updated = await res.json()
      updateUser(updated)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '360px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#111827' }}>Редактировать профиль</h3>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={18} color="#6b7280" />
          </button>
        </div>

        <div style={{ padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Аватар */}
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#d1d5db', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '32px', fontWeight: 600, color: '#4b5563' }}>{user?.display_name?.charAt(0)?.toUpperCase() || '?'}</span>}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', borderRadius: '50%', background: '#0059ff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
              <Camera size={14} color="#fff" />
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />

          {/* Имя */}
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '6px', display: 'block' }}>Имя</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Введите имя"
              style={{ width: '100%', height: '42px', background: '#f5f5f5', borderRadius: '12px', padding: '0 14px', fontSize: '14px', border: error ? '1.5px solid #ef4444' : '1.5px solid transparent', outline: 'none', boxSizing: 'border-box', color: '#111827' }}
              onFocus={e => { if (!error) e.target.style.border = '1.5px solid #0059ff' }}
              onBlur={e => { e.target.style.border = error ? '1.5px solid #ef4444' : '1.5px solid transparent' }}
            />
            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{error}</p>}
          </div>

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button onClick={onClose}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: '#fff', fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
              Отмена
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: 'none', background: saving ? '#93c5fd' : '#0059ff', fontSize: '14px', fontWeight: 500, color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
