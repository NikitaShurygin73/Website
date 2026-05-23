import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { X, UserPlus, Search, Trash2, Crown, AlertTriangle } from 'lucide-react'

function Avatar({ u, size = 40 }) {
  if (u.avatar_url) return <img src={u.avatar_url} alt={u.display_name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#5f6368' }}>{u.display_name?.charAt(0)?.toUpperCase() || '?'}</span>
    </div>
  )
}

export default function GroupMembersPanel({ onClose }) {
  const { user, token } = useAuthStore()
  const { activeChat, users, fetchChatMembers, addChatMember, removeChatMember, deleteGroupChat } = useChatStore()

  const [members, setMembers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const isAdmin = activeChat?.admin_id === user?.id || user?.is_admin

  const load = async () => {
    const data = await fetchChatMembers(activeChat.id, token)
    setMembers(data)
  }

  useEffect(() => { if (activeChat?.id) load() }, [activeChat?.id])

  const nonMembers = users.filter(u =>
    u.id !== user?.id &&
    !members.find(m => m.id === u.id) &&
    (u.display_name.toLowerCase().includes(search.toLowerCase()) ||
     u.username.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAdd = async (userId) => {
    setLoading(true)
    try {
      await addChatMember(activeChat.id, userId, token)
      await load()
      setShowAdd(false)
      setSearch('')
    } catch (e) {
      alert(e.message)
    } finally { setLoading(false) }
  }

  const handleRemove = async (userId) => {
    if (!window.confirm('Удалить участника?')) return
    setLoading(true)
    try {
      await removeChatMember(activeChat.id, userId, token)
      await load()
    } catch (e) {
      alert(e.message)
    } finally { setLoading(false) }
  }

  const handleDeleteGroup = async () => {
    const word = activeChat.is_department ? 'отдел' : 'группу'
    if (!window.confirm(`Удалить ${word} «${activeChat.name}»? Это действие нельзя отменить.`)) return
    setLoading(true)
    await deleteGroupChat(activeChat.id, token)
    setLoading(false)
    onClose()
  }

  return (
    <div style={{ width: '290px', height: '100%', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Шапка панели */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Участники ({members.length})</span>
        <button onClick={onClose} style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <X size={16} color="#9ca3af" />
        </button>
      </div>

      {/* Кнопка удалить группу (только для создателя) */}
      {activeChat?.admin_id === user?.id && (
        <div style={{ padding: '10px 16px 0' }}>
          <button onClick={handleDeleteGroup} disabled={loading}
            style={{ width: '100%', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>
            <AlertTriangle size={13} /> Удалить {activeChat.is_department ? 'отдел' : 'группу'}
          </button>
        </div>
      )}

      {/* Кнопка добавить (только для админа) */}
      {isAdmin && (
        <div style={{ padding: '12px 16px 0' }}>
          <button onClick={() => { setShowAdd(v => !v); setSearch('') }}
            style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: showAdd ? '#eff6ff' : '#f5f5f5', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 500, color: '#0059ff', cursor: 'pointer' }}>
            <UserPlus size={15} /> Добавить участника
          </button>
        </div>
      )}

      {/* Поиск для добавления */}
      {showAdd && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px', background: '#f5f5f5', borderRadius: '10px', padding: '0 10px', marginBottom: '6px' }}>
            <Search size={13} color="#9ca3af" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
              style={{ background: 'transparent', flex: 1, fontSize: '13px', outline: 'none', border: 'none', color: '#111827' }} />
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {nonMembers.length === 0
              ? <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Нет доступных пользователей</p>
              : nonMembers.map(u => (
                <button key={u.id} onClick={() => handleAdd(u.id)} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Avatar u={u} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</p>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      )}

      {/* Список участников */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {members.map(m => {
          const isGroupAdmin = m.id === activeChat?.admin_id
          const canRemove = isAdmin && !isGroupAdmin
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '10px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Avatar u={m} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</p>
                  {isGroupAdmin && <Crown size={12} color="#f59e0b" />}
                </div>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>@{m.username}</p>
              </div>
              {canRemove && (
                <button onClick={() => handleRemove(m.id)}
                  style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Trash2 size={13} color="#ef4444" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
