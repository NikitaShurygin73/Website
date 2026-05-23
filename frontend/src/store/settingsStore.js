import { create } from 'zustand'

// Хелпер: читает значение из localStorage или возвращает fallback
const get = (key, fallback) => {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v
}

// Сброс старого некорректного дефолта chatBg (#ffffff → #fafafa)
if (localStorage.getItem('chatBg') === '#ffffff') {
  localStorage.removeItem('chatBg')
}

// Хранилище настроек: тема, цвета фонов, алиасы чатов, подтверждение удаления
export const useSettingsStore = create((set) => ({
  theme: get('theme', 'light'),
  chatBg: get('chatBg', '#fafafa'),
  chatPanelBg: get('chatPanelBg', '#ffffff'),
  sidebarBg: get('sidebarBg', '#ffffff'),
  chatListBg: get('chatListBg', '#ffffff'),
  confirmDelete: get('confirmDelete', 'true') === 'true',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },

  setChatBg: (color) => {
    localStorage.setItem('chatBg', color)
    set({ chatBg: color })
  },

  setChatPanelBg: (color) => {
    localStorage.setItem('chatPanelBg', color)
    set({ chatPanelBg: color })
  },

  setSidebarBg: (color) => {
    localStorage.setItem('sidebarBg', color)
    set({ sidebarBg: color })
  },

  setChatListBg: (color) => {
    localStorage.setItem('chatListBg', color)
    set({ chatListBg: color })
  },

  setConfirmDelete: (val) => {
    localStorage.setItem('confirmDelete', String(val))
    set({ confirmDelete: val })
  },

  chatAliases: JSON.parse(localStorage.getItem('chatAliases') || '{}'),
  setChatAlias: (chatId, alias) => {
    const aliases = JSON.parse(localStorage.getItem('chatAliases') || '{}')
    if (alias && alias.trim()) aliases[String(chatId)] = alias.trim()
    else delete aliases[String(chatId)]
    localStorage.setItem('chatAliases', JSON.stringify(aliases))
    set({ chatAliases: { ...aliases } })
  },
}))
