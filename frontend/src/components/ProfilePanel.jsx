import { useEffect, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { X, Image, File } from 'lucide-react'

export default function ProfilePanel({ onClose }) {
  const { activeChat, onlineUsers } = useChatStore()
  const { token } = useAuthStore()
  const otherUser = activeChat?.other_user
  const isOnline = otherUser && onlineUsers.has(otherUser.id)

  // Счётчики медиа для панели профиля
  const [photoCount, setPhotoCount] = useState(0)
  const [fileCount, setFileCount] = useState(0)

  useEffect(() => {
    if (!activeChat?.id || !token) return
    fetch(`/api/chats/${activeChat.id}/media`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPhotoCount(d.photos?.length || 0); setFileCount(d.files?.length || 0) } })
      .catch(() => {})
  }, [activeChat?.id])

  if (!otherUser) return null

  return (
    <div style={{ width: '300px', height: '100%', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
      {/* Кнопка закрытия */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 0 16px' }}>
        <button
          onClick={onClose}
          style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <X size={20} color="#6b7280" />
        </button>
      </div>

      {/* Аватар и имя */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 24px 24px' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          {otherUser.avatar_url
            ? <img src={otherUser.avatar_url} alt={otherUser.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '36px', fontWeight: 600, color: '#5f6368' }}>{otherUser.display_name?.charAt(0)?.toUpperCase() || '?'}</span>}
        </div>
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>{otherUser.display_name}</h3>
        <p style={{ fontSize: '13px', color: isOnline ? '#0059ff' : '#9ca3af' }}>
          {isOnline ? 'В сети' : 'Не в сети'}
        </p>
      </div>

      {/* Статистика медиа */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image size={18} color="#0059ff" />
          <span style={{ fontSize: '14px', color: '#374151' }}>{photoCount} фото</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <File size={18} color="#0059ff" />
          <span style={{ fontSize: '14px', color: '#374151' }}>{fileCount} файлов</span>
        </div>
      </div>
    </div>
  )
}
