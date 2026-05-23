import { create } from 'zustand'
import { useAuthStore } from './authStore'

const API_URL = '/api'

export const useChatStore = create((set, get) => ({
  chats: [],
  allDepartments: [],
  activeChat: null,
  messages: [],
  hasMoreMessages: false,
  loadingMore: false,
  users: [],
  ws: null,
  onlineUsers: new Set(),

  // ---- Загрузка данных ----
  fetchAllDepartments: async (token) => {
    const res = await fetch(`${API_URL}/chats/departments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      set({ allDepartments: data })
    }
  },

  fetchChats: async (token) => {
    const res = await fetch(`${API_URL}/chats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      set({ chats: data })
    }
  },

  fetchMessages: async (chatId, token) => {
    const res = await fetch(`${API_URL}/chats/${chatId}/messages?limit=75`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      set({ messages: data, hasMoreMessages: data.length === 75 })
    }
  },

  // Подгрузка старых сообщений при скролле вверх
  fetchOlderMessages: async (chatId, token) => {
    const { messages, loadingMore } = get()
    if (loadingMore || !messages.length) return
    const before = messages[0].id
    set({ loadingMore: true })
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}/messages?before=${before}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const older = await res.json()
        set(state => ({
          messages: [...older, ...state.messages],
          hasMoreMessages: older.length === 100,
          loadingMore: false,
        }))
      } else {
        set({ loadingMore: false })
      }
    } catch {
      set({ loadingMore: false })
    }
  },

  fetchUsers: async (token) => {
    const res = await fetch(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      set({ users: data })
    }
  },

  setActiveChat: (chat) => {
    set({ activeChat: chat, messages: [] })
  },

  openFavoritesChat: async (token) => {
    const res = await fetch(`${API_URL}/chats/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const chat = await res.json()
      set({ activeChat: chat, messages: [] })
      const msgsRes = await fetch(`${API_URL}/chats/${chat.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (msgsRes.ok) set({ messages: await msgsRes.json() })
      return chat
    }
  },

  createChat: async (userId, token) => {
    const res = await fetch(`${API_URL}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      const chat = await res.json()
      await get().fetchChats(token)
      return chat
    }
  },

  // ---- WebSocket ----
  connectWebSocket: (token) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?token=${token}`
    const ws = new WebSocket(wsUrl)
    set({ _wsToken: token })

    ws.onopen = () => {
      console.log('WebSocket подключён')
    }

    // Обработка входящих сообщений
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        const { activeChat } = get()
        if (activeChat && data.chat_id === activeChat.id) {
          set((state) => ({ messages: [...state.messages, data.message] }))
        }
        // Обновляем превью последнего сообщения в списке чатов
        const preview = (() => {
          const m = data.message
          if (m.content) return m.content
          if (m.files?.length) {
            const allImages = m.files.every(f => f.type?.startsWith('image/'))
            return allImages ? (m.files.length > 1 ? `Фото (${m.files.length})` : 'Фото') : `Файлов: ${m.files.length}`
          }
          if (m.file_url) return (m.file_type?.startsWith('image/') && !m.is_file_attachment) ? 'Фото' : `Файл: ${m.file_name || ''}`
          return ''
        })()
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === data.chat_id
              ? { ...c, last_message: preview, last_message_time: data.message.created_at, unread_count: activeChat?.id === data.chat_id ? 0 : (c.unread_count || 0) + 1 }
              : c
          ),
        }))
      }

      if (data.type === 'message_edited') {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === data.message_id
              ? { ...m, content: data.content, edited_at: data.edited_at }
              : m
          ),
        }))
      }

      if (data.type === 'message_deleted') {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === data.message_id ? { ...m, is_deleted: true, content: '' } : m
          ),
        }))
      }

      if (data.type === 'new_chat') {
        // \u0427\u0430\u0442 \u043f\u043e\u044f\u0432\u0438\u043b\u0441\u044f \u0443 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044f \u043f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0432\u0445\u043e\u0434\u044f\u0449\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f
        set((state) => {
          const exists = state.chats.some(c => c.id === data.chat.id)
          if (exists) return {}
          return { chats: [data.chat, ...state.chats] }
        })
      }

      if (data.type === 'online_status') {
        set((state) => {
          const onlineUsers = new Set(state.onlineUsers)
          if (data.online) {
            onlineUsers.add(data.user_id)
          } else {
            onlineUsers.delete(data.user_id)
          }
          return { onlineUsers }
        })
      }

      if (data.type === 'online_users') {
        set({ onlineUsers: new Set(data.user_ids) })
      }

    }

    ws.onclose = () => {
      console.log('WebSocket отключён, переподключение через 3с')
      setTimeout(() => {
        // Берём токен из authStore, т.к. в chatStore он не хранится
        const authToken = useAuthStore.getState().token
        if (authToken) get().connectWebSocket(authToken)
      }, 3000)
    }

    set({ ws })
  },

  // ---- Группы ----
  createGroup: async (name, memberIds, isDepartment, token) => {
    const res = await fetch(`${API_URL}/chats/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, member_ids: memberIds, is_department: isDepartment }),
    })
    if (res.ok) {
      const chat = await res.json()
      await get().fetchChats(token)
      return chat
    }
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка создания группы')
  },

  fetchChatMembers: async (chatId, token) => {
    const res = await fetch(`${API_URL}/chats/${chatId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
    return []
  },

  addChatMember: async (chatId, userId, token) => {
    const res = await fetch(`${API_URL}/chats/${chatId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Ошибка') }
    return true
  },

  removeChatMember: async (chatId, userId, token) => {
    const res = await fetch(`${API_URL}/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Ошибка') }
    return true
  },

  // ---- Отправка и редактирование сообщений ----
  sendMessage: (chatId, content, fileData = null, replyToId = null) => {
    const { ws } = get()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message',
        chat_id: chatId,
        content: content || '',
        ...(fileData || {}),
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      }))
    }
  },

  editMessage: async (messageId, content, token) => {
    const res = await fetch(`${API_URL}/messages/${messageId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    return res.ok
  },

  deleteMessage: async (messageId, token) => {
    const res = await fetch(`${API_URL}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  },

  // Удаление группового чата/отдела
  deleteGroupChat: async (chatId, token) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const { activeChat } = get()
      if (activeChat?.id === chatId) set({ activeChat: null, messages: [] })
      set(state => ({ chats: state.chats.filter(c => c.id !== chatId) }))
    }
    return res.ok
  },

  // Закрытие соединения (при выходе)
  disconnectWebSocket: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null })
    }
  },

  // Пометить чат как прочитанный
  markAsRead: async (chatId, token) => {
    await fetch(`${API_URL}/chats/${chatId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    }))
  },
}))
