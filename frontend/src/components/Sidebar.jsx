import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import { MessageSquare, Star, Settings, LogOut, Shield, Building2, BarChart2, Palette, Megaphone, ShoppingBag, Code2 } from 'lucide-react'
import EditProfilePanel from './EditProfilePanel'

export default function Sidebar({ onToggleChatList, activeDept, onDeptClick, onAllChats }) {
  const { user, logout, token } = useAuthStore()
  const { openFavoritesChat, allDepartments } = useChatStore()
  const { sidebarBg } = useSettingsStore()
  const navigate = useNavigate()
  const [showEditProfile, setShowEditProfile] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Все отделы компании
  const deptChats = allDepartments

  // Уникальные иконки для каждого отдела по индексу
  const DEPT_ICONS = [BarChart2, Palette, Megaphone, ShoppingBag, Code2]

  return (
    <div className="w-[93px] h-full flex flex-col items-center justify-between" style={{ borderRight: '1px solid #e5e7eb', paddingTop: '20px', paddingBottom: '20px', background: sidebarBg }}>
      {/* Верхняя часть (прокручиваемая) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1, overflowY: 'auto', width: '100%', paddingBottom: '8px' }}>
        {/* Логотип — скрыть/показать список чатов */}
        <button
          onClick={onToggleChatList}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '12px', marginBottom: '4px', flexShrink: 0 }}
          title="Скрыть/показать список чатов"
        >
          <img
            src="/logo.png"
            alt=""
            style={{ width: '50px', height: '50px', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.target.style.visibility = 'hidden' }}
          />
        </button>

        {/* Аватар пользователя */}
        <button
          onClick={() => setShowEditProfile(true)}
          title="Редактировать профиль"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', flexShrink: 0 }}
        >
          <div className="w-[55px] h-[55px] rounded-full bg-gray-300 overflow-hidden flex items-center justify-center" style={{ transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="text-lg font-semibold text-gray-600">{user?.display_name?.charAt(0)?.toUpperCase() || '?'}</span>}
          </div>
        </button>

        {/* Разделитель */}
        <div className="w-[62px] h-px bg-gray-200" style={{ flexShrink: 0 }} />

        {/* Избранное */}
        <button
          onClick={() => { openFavoritesChat(token); navigate('/chat') }}
          className="w-[55px] h-[55px] rounded-xl hover:bg-[#eff6ff] flex items-center justify-center transition"
          title="Избранное"
          style={{ flexShrink: 0 }}
        >
          <Star size={22} color="#0059ff" fill="#0059ff" />
        </button>

        {/* Тонкий разделитель */}
        <div className="w-[62px] h-px bg-gray-200" style={{ flexShrink: 0 }} />

        {/* Кнопка «Все чаты» */}
        <button
          onClick={onAllChats}
          title="Все чаты"
          className="w-[55px] h-[55px] rounded-xl flex items-center justify-center transition"
          style={{ background: !activeDept ? '#0059ff' : 'transparent', color: !activeDept ? '#fff' : '#0059ff', flexShrink: 0 }}
          onMouseEnter={e => { if (activeDept) e.currentTarget.style.background = '#eff6ff' }}
          onMouseLeave={e => { if (activeDept) e.currentTarget.style.background = 'transparent' }}
        >
          <MessageSquare size={22} />
        </button>

        {/* Индивидуальные кнопки отделов */}
        {deptChats.length > 0 && (
          <>
            <div className="w-[62px] h-px bg-gray-200" style={{ flexShrink: 0 }} />
            {deptChats.map((dept, idx) => {
              const isActive = activeDept?.id === dept.id
              const Icon = DEPT_ICONS[idx % DEPT_ICONS.length]
              return (
                <button
                  key={dept.id}
                  onClick={() => onDeptClick(dept)}
                  title={dept.name}
                  style={{
                    width: '55px', height: '55px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? '#7c3aed' : 'transparent',
                    color: isActive ? '#fff' : '#7c3aed',
                    flexShrink: 0, transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3e8ff' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon size={20} />
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* Нижние кнопки */}
      <div className="flex flex-col items-center gap-3" style={{ flexShrink: 0, paddingTop: '8px' }}>
        {user?.is_admin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-[42px] h-[42px] rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
            title="Админ панель"
          >
            <Shield size={20} />
          </button>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="w-[42px] h-[42px] rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
          title="Настройки"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={handleLogout}
          className="w-[42px] h-[42px] rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
          title="Выйти"
        >
          <LogOut size={20} />
        </button>
      </div>
      {showEditProfile && <EditProfilePanel onClose={() => setShowEditProfile(false)} />}
    </div>
  )
}
