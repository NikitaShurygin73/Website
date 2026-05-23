import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { X, Search, Check, Users, Building2, MessageSquare } from 'lucide-react'

function UserAvatar({ u, size = 40 }) {
  if (u.avatar_url) return <img src={u.avatar_url} alt={u.display_name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#5f6368' }}>{u.display_name?.charAt(0)?.toUpperCase() || '?'}</span>
    </div>
  )
}

export default function NewChatModal({ onClose }) {
  const { token, user } = useAuthStore()
  const { users, createChat, createGroup, setActiveChat, fetchMessages, fetchChats } = useChatStore()

  const canCreateDept = user?.is_admin || user?.is_team_lead

  // вкладки: 'direct' | 'group' | 'department'
  const [tab, setTab] = useState('direct')
  const [search, setSearch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const otherUsers = users.filter(u => u.id !== user?.id)
  const filtered = otherUsers.filter(u =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  const toggleUser = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const handleDirect = async (userId) => {
    const chat = await createChat(userId, token)
    if (chat) { setActiveChat(chat); fetchMessages(chat.id, token) }
    onClose()
  }

  const handleCreateGroup = async () => {
    setError('')
    if (!groupName.trim()) { setError('Введите название'); return }
    if (selectedIds.size === 0) { setError('Выберите хотя бы одного участника'); return }
    setLoading(true)
    try {
      const chat = await createGroup(groupName.trim(), [...selectedIds], tab === 'department', token)
      if (chat) { setActiveChat(chat); fetchMessages(chat.id, token) }
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { key: 'direct', label: 'Личный', icon: <MessageSquare size={15} /> },
    { key: 'group', label: 'Группа', icon: <Users size={15} /> },
    ...(canCreateDept ? [{ key: 'department', label: 'Отдел', icon: <Building2 size={15} /> }] : []),
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ width: '500px', background: '#fff', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>Новый чат</h3>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* Вкладки */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 24px 0', borderBottom: '1px solid #f0f0f0' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginBottom: '-1px',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#0059ff' : '#6b7280',
                borderBottom: tab === t.key ? '2px solid #0059ff' : '2px solid transparent',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Тело */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 20px' }}>
          {/* Название группы/отдела */}
          {(tab === 'group' || tab === 'department') && (
            <input
              autoFocus
              placeholder={tab === 'department' ? 'Название отдела...' : 'Название группы...'}
              value={groupName}
              onChange={e => { setGroupName(e.target.value); setError('') }}
              style={{ width: '100%', height: '42px', background: '#f5f5f5', borderRadius: '12px', padding: '0 14px', fontSize: '14px', border: '1.5px solid transparent', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', color: '#111827' }}
              onFocus={e => e.target.style.border = '1.5px solid #0059ff'}
              onBlur={e => e.target.style.border = '1.5px solid transparent'}
            />
          )}

          {/* Поиск пользователей */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '38px', background: '#f5f5f5', borderRadius: '12px', padding: '0 14px', marginBottom: '10px' }}>
            <Search size={14} color="#9ca3af" />
            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', flex: 1, fontSize: '14px', outline: 'none', border: 'none', color: '#111827' }}
              autoFocus={tab === 'direct'}
            />
          </div>

          {/* Выбранные (для группы) */}
          {(tab === 'group' || tab === 'department') && selectedIds.size > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {[...selectedIds].map(id => {
                const u = users.find(x => x.id === id)
                if (!u) return null
                return (
                  <span key={id} onClick={() => toggleUser(id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: '#eff6ff', borderRadius: '20px', fontSize: '12px', color: '#0059ff', cursor: 'pointer', fontWeight: 500 }}>
                    {u.display_name} <X size={11} />
                  </span>
                )
              })}
            </div>
          )}

          {/* Список пользователей */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtered.length === 0
              ? <p style={{ textAlign: 'center', fontSize: '14px', color: '#9ca3af', padding: '24px 0' }}>Пользователи не найдены</p>
              : filtered.map(u => {
                  const isSelected = selectedIds.has(u.id)
                  return (
                    <button key={u.id}
                      onClick={() => tab === 'direct' ? handleDirect(u.id) : toggleUser(u.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 8px', borderRadius: '12px', border: 'none',
                        background: isSelected ? '#eff6ff' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <UserAvatar u={u} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{u.display_name}</p>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#0059ff', background: '#eff6ff', padding: '1px 6px', borderRadius: '6px', flexShrink: 0 }}>@{u.username}</span>
                        </div>
                      </div>
                      {(tab === 'group' || tab === 'department') && isSelected && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0059ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })
            }
          </div>
        </div>

        {/* Кнопка создания группы/отдела */}
        {(tab === 'group' || tab === 'department') && (
          <div style={{ padding: '0 24px 20px', borderTop: '1px solid #f0f0f0', paddingTop: '14px' }}>
            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>{error}</p>}
            <button onClick={handleCreateGroup} disabled={loading}
              style={{ width: '100%', height: '42px', borderRadius: '12px', border: 'none', background: loading ? '#93c5fd' : '#0059ff', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Создаём...' : `Создать ${tab === 'department' ? 'отдел' : 'группу'}${selectedIds.size > 0 ? ` (${selectedIds.size + 1})` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
