import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import Sidebar from '../components/Sidebar'
import ChatList from '../components/ChatList'
import ChatArea from '../components/ChatArea'
import ProfilePanel from '../components/ProfilePanel'
import DepartmentPanel from '../components/DepartmentPanel'

export default function ChatPage() {
  const { token } = useAuthStore()
  const { fetchChats, fetchUsers, fetchAllDepartments, connectWebSocket, disconnectWebSocket, activeChat } = useChatStore()
  const [showProfile, setShowProfile] = useState(false)
  const [showChatList, setShowChatList] = useState(true)
  // null = показываем обычный список чатов, объект = показываем панель отдела
  const [activeDept, setActiveDept] = useState(null)

  // Инициализация: загрузка чатов/пользователей и подключение WS
  useEffect(() => {
    if (token) {
      fetchChats(token)
      fetchUsers(token)
      fetchAllDepartments(token)
      connectWebSocket(token)
    }
    return () => disconnectWebSocket()
  }, [token])

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        onToggleChatList={() => setShowChatList(v => !v)}
        activeDept={activeDept}
        onDeptClick={setActiveDept}
        onAllChats={() => setActiveDept(null)}
      />
      <div style={{
        width: showChatList ? '330px' : '0px',
        minWidth: showChatList ? '330px' : '0px',
        overflow: 'hidden',
        transition: 'width 0.22s ease, min-width 0.22s ease',
        flexShrink: 0,
      }}>
        {activeDept
          ? <DepartmentPanel dept={activeDept} onClose={() => setActiveDept(null)} />
          : <ChatList />
        }
      </div>
      <ChatArea onShowProfile={() => setShowProfile(true)} />
      {showProfile && activeChat && (
        <ProfilePanel onClose={() => setShowProfile(false)} />
      )}
    </div>
  )
}
