import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import { ArrowLeft, Users, MessageSquare, CheckCheck } from 'lucide-react'

function MemberAvatar({ u, size = 44 }) {
  if (u.avatar_url) return <img src={u.avatar_url} alt={u.display_name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#5f6368' }}>{u.display_name?.charAt(0)?.toUpperCase() || '?'}</span>
    </div>
  )
}

export default function DepartmentPanel({ dept, onClose }) {
  const { token, user } = useAuthStore()
  const { fetchChatMembers, createChat, setActiveChat, fetchMessages, onlineUsers, chats, fetchChats } = useChatStore()
  const { chatListBg } = useSettingsStore()

  const [members, setMembers] = useState([])

  useEffect(() => {
    if (dept?.id && token) {
      fetchChatMembers(dept.id, token).then(m => setMembers(m || []))
    }
  }, [dept?.id])

  // Член ли текущий пользователь в этом отделе
  const isMember = chats.some(c => c.id === dept.id)

  // Открыть групповой чат отдела
  const openDeptChat = () => {
    // Обновляем объект чата из списка чатов (если пользователь является участником)
    const chat = chats.find(c => c.id === dept.id) || dept
    setActiveChat(chat)
    fetchMessages(dept.id, token)
  }

  // Открыть/создать личный чат с участником
  const openDirectChat = async (userId) => {
    // Ищем существующий чат
    const existing = chats.find(c => !c.is_group && c.other_user?.id === userId)
    if (existing) {
      setActiveChat(existing)
      fetchMessages(existing.id, token)
    } else {
      const chat = await createChat(userId, token)
      if (chat) {
        setActiveChat(chat)
        fetchMessages(chat.id, token)
      }
    }
  }

  const others = members.filter(m => m.id !== user?.id)

  return (
    <div style={{ width: '330px', height: '100%', display: 'flex', flexDirection: 'column', background: chatListBg, borderRight: '1px solid #e5e7eb' }}>
      {/* Шапка с кнопкой назад */}
      <div style={{ padding: '20px 20px 12px' }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#0059ff', fontSize: '13px', fontWeight: 500, padding: '4px 0', marginBottom: '10px' }}>
          <ArrowLeft size={15} /> Все чаты
        </button>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{dept.name}</h2>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Отдел · {members.length} участников</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
        {/* Групповой чат отдела — только для участников */}
        {isMember && (
          <>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 8px' }}>Чат отдела</p>
            <div
              onClick={openDeptChat}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 10px', borderRadius: '14px', cursor: 'pointer', marginBottom: '16px', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 48, height: 48, borderRadius: '14px', background: '#7c3aed18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={22} color="#7c3aed" />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>Общий чат</p>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>{others.length + 1} участников</p>
              </div>
            </div>
          </>
        )}

        {/* Список участников */}
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 8px' }}>Участники</p>
        {others.map(m => {
          const isOnline = onlineUsers.has(m.id)
          return (
            <div
              key={m.id}
              onClick={() => openDirectChat(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 10px', borderRadius: '14px', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Аватар с индикатором онлайн */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <MemberAvatar u={m} />
                {isOnline && (
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</p>
                  {m.is_admin && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#7c3aed18', color: '#7c3aed', flexShrink: 0 }}>Админ</span>}
                  {m.is_team_lead && !m.is_admin && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#fef3c718', color: '#d97706', flexShrink: 0 }}>Лид</span>}
                </div>
                <p style={{ fontSize: '12px', color: isOnline ? '#22c55e' : '#9ca3af' }}>{isOnline ? 'В сети' : 'Не в сети'}</p>
              </div>
              <MessageSquare size={16} color="#d1d5db" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
