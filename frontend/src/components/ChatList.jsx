import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import { Search, ChevronDown, Edit, CheckCheck, Star, Check, Users } from 'lucide-react'
import NewChatModal from './NewChatModal'

const SORT_OPTIONS = [
  { key: 'recent',   label: 'Недавние' },
  { key: 'unread',   label: 'Непрочитанные' },
  { key: 'alpha',    label: 'По алфавиту' },
  { key: 'online',   label: 'Сначала в сети' },
]

// Единый нейтральный цвет для всех аватаров
export function avatarColor(_name = '') {
  return '#6b7280'
}

export default function ChatList() {
  const { token, user } = useAuthStore()
  const { chats, activeChat, setActiveChat, fetchMessages, markAsRead, onlineUsers, openFavoritesChat } = useChatStore()
  const { chatListBg, chatAliases } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [sortKey, setSortKey] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const sortedChats = [...chats]
    .filter((chat) => {
      if (chat.name === 'Избранное') return false
      // Отделы доступны через сайдбар, в основном списке их не показываем
      if (chat.is_department) return false
      const name = chat.other_user?.display_name || chat.name || ''
      return name.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      if (sortKey === 'recent') {
        const aU = (a.unread_count || 0) > 0, bU = (b.unread_count || 0) > 0
        if (aU !== bU) return bU ? -1 : 1
        return new Date(b.last_message_time || b.created_at) - new Date(a.last_message_time || a.created_at)
      }
      if (sortKey === 'unread') {
        if ((b.unread_count > 0) !== (a.unread_count > 0)) return (b.unread_count > 0) ? 1 : -1
        return new Date(b.last_message_time || b.created_at) - new Date(a.last_message_time || a.created_at)
      }
      if (sortKey === 'alpha') {
        const na = (a.other_user?.display_name || a.name || '').toLowerCase()
        const nb = (b.other_user?.display_name || b.name || '').toLowerCase()
        return na.localeCompare(nb, 'ru')
      }
      if (sortKey === 'online') {
        const ao = a.other_user && onlineUsers.has(a.other_user.id)
        const bo = b.other_user && onlineUsers.has(b.other_user.id)
        if (ao !== bo) return ao ? -1 : 1
        return new Date(b.last_message_time || b.created_at) - new Date(a.last_message_time || a.created_at)
      }
      return 0
    })

  const filteredChats = sortedChats
  const currentSort = SORT_OPTIONS.find(o => o.key === sortKey)

  const handleSelectChat = (chat) => {
    setActiveChat(chat)
    fetchMessages(chat.id, token)
    if (chat.unread_count > 0) {
      markAsRead(chat.id, token)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="w-[330px] h-full border-r border-gray-200 flex flex-col" style={{ background: chatListBg }}>
      {/* Шапка */}
      <div style={{ padding: '24px 20px 12px 20px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <h2 className="text-[23px] font-semibold text-black">Чаты</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="text-[#0059ff] hover:bg-blue-50 p-1.5 rounded-lg transition"
          >
            <Edit size={18} />
          </button>
        </div>

        {/* Поиск */}
        <div className="flex items-center gap-4 bg-[#eee] rounded-xl" style={{ height: '32px', padding: '0 12px' }}>
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-sm outline-none placeholder-gray-400"
          />
        </div>

        {/* Сортировка */}
        <div className="flex items-center gap-1" style={{ marginTop: '16px', position: 'relative' }} ref={sortRef}>
          <span className="text-sm text-gray-400">Сортировать:</span>
          <button
            onClick={() => setShowSortMenu(v => !v)}
            className="flex items-center gap-0.5 text-sm text-[#0059ff] font-medium"
          >
            {currentSort?.label}
            <ChevronDown size={13} style={{ transition: 'transform 0.15s', transform: showSortMenu ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showSortMenu && (
            <div style={{ position: 'absolute', top: '100%', left: '72px', marginTop: '6px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.13)', padding: '6px', minWidth: '170px', zIndex: 50 }}>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => { setSortKey(opt.key); setShowSortMenu(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontSize: '13px', color: sortKey === opt.key ? '#0059ff' : '#111827', fontWeight: sortKey === opt.key ? 600 : 400 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {opt.label}
                  {sortKey === opt.key && <Check size={14} color="#0059ff" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Избранное */}
        <div
          onClick={() => openFavoritesChat(token)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
            background: activeChat?.name === 'Избранное' ? '#f0f5ff' : 'transparent',
          }}
          onMouseEnter={e => { if (activeChat?.name !== 'Избранное') e.currentTarget.style.background = '#f9fafb' }}
          onMouseLeave={e => { if (activeChat?.name !== 'Избранное') e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={22} color="#0059ff" fill="#0059ff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>Избранное</span>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>Личные заметки</p>
          </div>
        </div>
        {filteredChats.map((chat) => {
          const otherUser = chat.other_user
          const isOnline = otherUser && onlineUsers.has(otherUser.id)
          const isActive = activeChat?.id === chat.id

          return (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
              className={`flex items-center gap-3 rounded-xl cursor-pointer transition ${
                isActive ? 'bg-[#f0f5ff]' : 'hover:bg-gray-50'
              }`}
              style={{ padding: '10px 12px' }}
            >
              {/* Аватар */}
              <div className="relative shrink-0">
                {chat.is_group ? (
                    <div style={{ width: 48, height: 48, borderRadius: '14px', background: '#0059ff18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={22} color="#0059ff" />
                    </div>
                ) : otherUser?.avatar_url ? (
                  <img src={otherUser.avatar_url} alt={otherUser.display_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (() => {
                  return (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: '#5f6368' }}>{(otherUser?.display_name || '?').charAt(0).toUpperCase()}</span>
                    </div>
                  )
                })()}
              </div>

              {/* Имя и превью */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                    <span className="text-[15px] font-medium text-gray-800 truncate">
                      {chatAliases[String(chat.id)] || otherUser?.display_name || chat.name || 'Чат'}
                    </span>
                    {!chat.is_group && otherUser?.is_admin && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#7c3aed18', color: '#7c3aed', flexShrink: 0 }}>Админ</span>
                    )}
                    {!chat.is_group && otherUser?.is_team_lead && !otherUser?.is_admin && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#fef3c718', color: '#d97706', flexShrink: 0 }}>Лид</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {formatTime(chat.last_message_time)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm text-gray-400 truncate">
                    {chat.last_message || 'Нет сообщений'}
                  </span>
                  {chat.unread_count > 0 ? (
                    <span className="shrink-0 ml-2 w-2.5 h-2.5 bg-[#0059ff] rounded-full" />
                  ) : (
                    <CheckCheck size={14} className="shrink-0 ml-2 text-gray-300" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </div>
  )
}
