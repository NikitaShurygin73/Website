import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import { Info, Paperclip, ArrowRight, Check, CheckCheck, Star, X, Download, Image, ChevronLeft, ChevronRight, CornerUpLeft, Pencil, Trash2, Share2, CheckSquare, UserCog, FileText, ArrowLeft, Users, Building2 } from 'lucide-react'
import GroupMembersPanel from './GroupMembersPanel'
import { avatarColor } from './ChatList'

const isImageType = (type) => type && type.startsWith('image/')

const getGridStyle = (count) => {
  if (count === 1) return { cols: 1, height: 'auto', maxHeight: '300px' }
  if (count === 2) return { cols: 2, height: '155px' }
  if (count === 4) return { cols: 2, height: '130px' }
  if (count <= 6) return { cols: 3, height: '115px' }
  return { cols: 3, height: '100px' }
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}

export default function ChatArea({ onShowProfile }) {
  const { user, token } = useAuthStore()
  const { activeChat, messages, hasMoreMessages, loadingMore, fetchOlderMessages, sendMessage, editMessage, deleteMessage, onlineUsers, chats, fetchChatMembers, users } = useChatStore()
  const { chatBg, chatPanelBg, confirmDelete, chatAliases, setChatAlias } = useSettingsStore()
  const isGroup = activeChat?.is_group && activeChat?.name !== 'Избранное'

  // Состояние @меншена
  const [groupMembers, setGroupMembers] = useState([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMention, setShowMention] = useState(false)
  const [mentionStart, setMentionStart] = useState(-1)
  const textareaRef = useRef(null)

  const autoResizeTextarea = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineH = 20
    const maxH = lineH * 10 + 16
    ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px'
  }

  const resetTextarea = () => {
    const ta = textareaRef.current
    if (ta) ta.style.height = '36px'
  }
  const [infoPanel, setInfoPanel] = useState(false)
  const [infoPanelView, setInfoPanelView] = useState('main')
  const [aliasInput, setAliasInput] = useState('')
  const [editingAlias, setEditingAlias] = useState(false)

  const alias = activeChat ? (chatAliases[String(activeChat.id)] || '') : ''
  const [photos, setPhotos] = useState([])
  const [chatFiles, setChatFiles] = useState([])

  const fetchMedia = (chatId) => {
    if (!chatId || !token) return
    fetch(`/api/chats/${chatId}/media`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPhotos(d.photos || []); setChatFiles(d.files || []) } })
      .catch(() => {})
  }

  useEffect(() => {
    if (!activeChat || !token) return
    setPhotos([]); setChatFiles([])
    fetchMedia(activeChat.id)
  }, [activeChat?.id])

  useEffect(() => {
    const hasDeletedMedia = messages.some(m => m.is_deleted && (m.file_url || m.files?.length))
    if (hasDeletedMedia && activeChat) fetchMedia(activeChat.id)
  }, [messages])

  useEffect(() => {
    if (!activeChat || !token) return
    // Загружаем участников для @меншена (только для групп)
    if (activeChat.is_group && activeChat.name !== 'Избранное') {
      fetchChatMembers(activeChat.id, token).then(m => setGroupMembers(m || []))
    } else {
      setGroupMembers([])
    }
  }, [activeChat?.id])
  const [text, setText] = useState('')
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [forwardDialog, setForwardDialog] = useState(null)
  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const prevScrollHeightRef = useRef(null)
  const isRestoringScrollRef = useRef(false)
  const dragSelectRef = useRef(false)
  const holdTimerRef = useRef(null)

  // Восстанавливаем позицию скролла после добавления старых сообщений
  useEffect(() => {
    if (prevScrollHeightRef.current !== null && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
    }
  }, [messages.length])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el || loadingMore || !hasMoreMessages) return
    if (el.scrollTop < 80) {
      isRestoringScrollRef.current = true
      prevScrollHeightRef.current = el.scrollHeight
      fetchOlderMessages(activeChat?.id, token)
    }
  }

  useEffect(() => {
    const onUp = () => {
      dragSelectRef.current = false
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const startDragSelect = (e, id) => {
    if (e.button !== 0) return
    if (selectionMode) return
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null
      dragSelectRef.current = true
      setSelectionMode(true)
      setSelectedIds(new Set([id]))
    }, 150)
  }

  const onMsgEnter = (id) => {
    if (!dragSelectRef.current) return
    setSelectedIds(prev => { const n = new Set(prev); n.add(id); return n })
  }

  useEffect(() => {
    if (!lightbox) return
    const handler = (e) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox(lb => lb && lb.index < lb.images.length - 1 ? { ...lb, index: lb.index + 1 } : lb)
      if (e.key === 'ArrowLeft') setLightbox(lb => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])
  const fileInputRef = useRef(null)
  const dragCounterRef = useRef(0)

  useEffect(() => {
    if (isRestoringScrollRef.current) {
      isRestoringScrollRef.current = false
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!activeChat) return
    if (editingMsg) {
      if (!text.trim()) return
      await editMessage(editingMsg.id, text.trim(), token)
      setEditingMsg(null)
      setText('')
      resetTextarea()
      return
    }
    if ((!text.trim() && !pendingFile) || !activeChat) return
    if (pendingFile) return
    sendMessage(activeChat.id, text.trim(), null, replyTo?.id || null)
    setReplyTo(null)
    setText('')
    resetTextarea()
  }

  const startEdit = (msg) => {
    setEditingMsg(msg)
    setText(msg.content)
    setReplyTo(null)
  }

  const cancelCompose = () => {
    setEditingMsg(null)
    setReplyTo(null)
    setText('')
  }

  // Вставка @меншена: заменяем @... на @username 
  const insertMention = (member) => {
    const tag = `@${member.username} `
    const before = text.slice(0, mentionStart)
    const after = text.slice(textareaRef.current?.selectionStart || mentionStart)
    const newText = before + tag + after
    setText(newText)
    setShowMention(false)
    setTimeout(() => {
      const ta = textareaRef.current
      if (ta) { const pos = before.length + tag.length; ta.focus(); ta.setSelectionRange(pos, pos) }
    }, 0)
  }

  const deleteMsg = (msgId) => {
    if (confirmDelete) {
      setConfirmDeleteDialog({ ids: [msgId], onConfirm: async () => { await deleteMessage(msgId, token) } })
    } else {
      deleteMessage(msgId, token)
    }
  }

  const deleteManyMsg = (ids) => {
    if (confirmDelete) {
      setConfirmDeleteDialog({ ids, onConfirm: async () => { for (const id of ids) await deleteMessage(id, token); cancelSelection() } })
    } else {
      ids.forEach(id => deleteMessage(id, token))
      cancelSelection()
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) cancelSelection()
  }, [selectedIds.size])

  const closeCtx = () => setCtxMenu(null)

  const openForward = (ids) => {
    setForwardDialog({ ids })
    cancelSelection()
  }

  const doForward = (targetChatId) => {
    const msgs = messages.filter(m => forwardDialog.ids.includes(m.id))
    msgs.forEach(m => {
      if (m.files) sendMessage(targetChatId, m.content, { files: m.files })
      else if (m.file_url) sendMessage(targetChatId, m.content, { file_url: m.file_url, file_name: m.file_name, file_size: m.file_size, file_type: m.file_type, is_file_attachment: m.is_file_attachment })
      else sendMessage(targetChatId, m.content)
    })
    setForwardDialog(null)
  }

  const BATCH_SIZE = 10

  const processFiles = (fileList) => {
    const files = Array.from(fileList)
    if (files.length === 1 && isImageType(files[0].type)) {
      setPendingFile({ file: files[0] })
    } else {
      uploadBatches(files)
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    e.target.value = ''
    processFiles(files)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounterRef.current++
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragOver(false)
  }
  const handleDragOver = (e) => { e.preventDefault() }
  const handleDrop = (e) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) processFiles(files)
  }

  const uploadFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Ошибка загрузки')
    }
    return res.json()
  }

  const uploadBatches = async (files) => {
    setUploading(true)
    setPendingFile(null)
    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE)
        const uploaded = await Promise.all(
          batch.map(async (file) => {
            const data = await uploadFile(file)
            return { url: data.url, name: data.name, size: data.size, type: data.type, is_attachment: !isImageType(file.type) }
          })
        )
        sendMessage(activeChat.id, i === 0 ? text.trim() : '', { files: uploaded }, i === 0 ? (replyTo?.id || null) : null)
      }
      setText('')
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  const uploadAndSend = async (file, asPhoto) => {
    setUploading(true)
    setPendingFile(null)
    try {
      const data = await uploadFile(file)
      sendMessage(activeChat.id, text.trim(), {
        file_url: data.url,
        file_name: data.name,
        file_size: data.size,
        file_type: data.type,
        is_file_attachment: !asPhoto,
      }, replyTo?.id || null)
      setReplyTo(null)
      setText('')
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateDivider = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Сегодня'
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  const getDateGroups = () => {
    const groups = []
    let currentDate = null

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ type: 'divider', date: msg.created_at })
      }
      groups.push({ type: 'message', ...msg })
    })

    return groups
  }

  if (!activeChat) {
    return (
      <div style={{ flex: 1, background: chatBg, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{ width: '300px', height: '300px', display: 'block', filter: 'grayscale(100%) opacity(0.35)', marginBottom: '16px' }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <p style={{ color: '#6b7280', fontSize: '15px' }}>Выберете, кому хотели</p>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>бы написать</p>
        </div>
      </div>
    )
  }

  const isFavorites = activeChat.name === 'Избранное'
  const otherUser = activeChat.other_user
  const isOnline = otherUser && onlineUsers.has(otherUser.id)
  const items = getDateGroups()

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: chatBg, height: '100%', position: 'relative', overflow: 'hidden' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Оверлей при перетаскивании файлов */}
      {dragOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,89,255,0.08)', border: '2.5px dashed #0059ff', borderRadius: '12px', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Paperclip size={40} color="#0059ff" />
            <p style={{ fontSize: '18px', fontWeight: 600, color: '#0059ff' }}>Отпустите файлы</p>
          </div>
        </div>
      )}
      {/* Шапка чата */}
      <div className="h-[90px] flex items-center justify-between px-6" style={{ background: chatPanelBg, borderBottom: '1px solid #e5e7eb' }}>
        <div className="flex items-center gap-3">
          {isFavorites ? (
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '12px' }}>
              <Star size={24} color="#0059ff" fill="#0059ff" />
            </div>
          ) : isGroup ? (
            <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: activeChat.is_department ? '#7c3aed18' : '#0059ff18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '12px' }}>
              {activeChat.is_department ? <Building2 size={24} color="#7c3aed" /> : <Users size={24} color="#0059ff" />}
            </div>
          ) : (
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '12px' }}>
              <span className="text-lg font-semibold text-gray-600">
                {otherUser?.display_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <h3 className="text-[17px] font-semibold text-gray-900">
                {isFavorites ? 'Избранное' : (isGroup ? activeChat.name : (alias || otherUser?.display_name || activeChat.name || 'Чат'))}
              </h3>
              {!isFavorites && !isGroup && otherUser?.is_admin && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: '#7c3aed18', color: '#7c3aed', flexShrink: 0 }}>Администратор</span>
              )}
              {!isFavorites && !isGroup && otherUser?.is_team_lead && !otherUser?.is_admin && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: '#fef3c718', color: '#d97706', flexShrink: 0 }}>Тимлид</span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: isFavorites ? '#0059ff' : isGroup ? '#9ca3af' : (isOnline ? '#0059ff' : '#9ca3af') }}>
              {isFavorites ? 'Личные заметки' : isGroup ? (activeChat.is_department ? 'Отдел' : 'Группа') : (isOnline ? 'В сети' : 'Не в сети')}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setInfoPanel(v => !v); setInfoPanelView('main') }}
          style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: infoPanel ? '#eff6ff' : 'transparent', cursor: 'pointer', marginRight: '20px' }}
          onMouseEnter={e => { if (!infoPanel) e.currentTarget.style.background = '#f3f4f6' }}
          onMouseLeave={e => { if (!infoPanel) e.currentTarget.style.background = 'transparent' }}
        >
          <Info size={28} color={infoPanel ? '#0059ff' : '#9ca3af'} />
        </button>
      </div>

      {/* Область сообщений */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Водяной знак */}
        <img
          src="/logo.png"
          alt=""
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            filter: 'grayscale(100%) opacity(0.12)',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <div ref={scrollContainerRef} onScroll={handleScroll} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflowY: 'auto', padding: '16px 24px 16px 16px', zIndex: 1 }}>
        {/* Индикатор загрузки старых сообщений */}
        {loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: '20px', height: '20px', border: '2.5px solid #e5e7eb', borderTopColor: '#0059ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
        {hasMoreMessages && !loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Прокрутите вверх для загрузки</span>
          </div>
        )}
        {items.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <div key={`div-${idx}`} className="flex items-center gap-6 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{formatDateDivider(item.date)}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )
          }

          const isMine = item.sender_id === user?.id
          const isSelected = selectedIds.has(item.id)
          return (
            <div
              key={item.id}
              style={{ display: 'flex', marginBottom: '16px', alignItems: selectionMode ? 'center' : 'flex-start', gap: '8px', justifyContent: isMine ? 'flex-end' : 'flex-start', position: 'relative' }}
              onMouseDown={(e) => startDragSelect(e, item.id)}
              onMouseEnter={() => onMsgEnter(item.id)}
              onContextMenu={(e) => {
                if (selectionMode) return
                e.preventDefault()
                setCtxMenu({ x: e.clientX, y: e.clientY, msg: item, isMine })
              }}
            >
              {/* Чекбокс — слева для своих сообщений */}
              {selectionMode && isMine && (
                <div onClick={() => toggleSelect(item.id)} style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #d1d5db', background: isSelected ? '#0059ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                </div>
              )}
              {!isMine && (() => {
                const senderUser = isGroup
                  ? (users || []).find(u => u.id === item.sender_id)
                  : otherUser
                const senderName = senderUser?.display_name || '?'
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, marginTop: selectionMode ? 0 : '-4px' }}>
                    {senderUser?.avatar_url
                      ? <img src={senderUser.avatar_url} alt={senderName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#5f6368' }}>{senderName.charAt(0).toUpperCase()}</span>
                        </div>
                    }
                  </div>
                )
              })()}
              <div
                style={{
                  maxWidth: '55%',
                  borderRadius: isMine ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  background: isMine ? '#fafafa' : '#f4f4f7',
                  boxShadow: isSelected
                    ? '0 0 0 2px #93c5fd, 0 2px 8px rgba(0,0,0,0.10)'
                    : '0 2px 8px rgba(0,0,0,0.13)',
                  overflow: 'hidden',
                  padding: (item.file_url && !item.is_file_attachment && !item.reply_to) ? '0' : '7px 12px',
                  cursor: selectionMode ? 'pointer' : 'default',
                  position: 'relative',
                }}
                onClick={selectionMode ? () => toggleSelect(item.id) : undefined}
              >
                {/* Цитата ответа */}
                {/* Имя отправителя в группе — над сообщением */}
                {isGroup && !isMine && (() => {
                  const senderUser = (users || []).find(u => u.id === item.sender_id)
                  return senderUser ? (
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#0059ff', marginBottom: '3px' }}>
                      {senderUser.display_name}
                    </p>
                  ) : null
                })()}

                {item.reply_to && !item.is_deleted && (
                  <div style={{ borderLeft: '3px solid #0059ff', paddingLeft: '8px', marginBottom: '6px', opacity: 0.85 }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#0059ff', marginBottom: '2px' }}>
                      {item.reply_to.sender_id === user?.id ? 'Вы' : ((users || []).find(u => u.id === item.reply_to.sender_id)?.display_name || otherUser?.display_name || 'Пользователь')}
                    </p>
                    <p style={{ fontSize: '12px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                      {item.reply_to.content || (item.reply_to.file_name ? `${isImageType(item.reply_to.file_type) ? 'Фото' : 'Файл'}: ${item.reply_to.file_name}` : '')}
                    </p>
                  </div>
                )}
                {/* Удалённое сообщение */}
                {item.is_deleted && (
                  <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Сообщение удалено</p>
                )}
                {/* Встроенное изображение */}
                {item.file_url && !item.is_file_attachment && isImageType(item.file_type) && (
                  <div>
                    <img
                      src={item.file_url}
                      alt={item.file_name || 'image'}
                      style={{ display: 'block', maxWidth: '320px', maxHeight: '300px', width: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setLightbox({ images: [{ url: item.file_url, name: item.file_name }], index: 0 })}
                    />
                    {item.content && (
                      <p style={{ fontSize: '14px', color: '#111827', wordBreak: 'break-word', lineHeight: '1.5', fontWeight: 450, padding: '6px 12px 2px' }}>{item.content}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 10px 6px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatTime(item.created_at)}</span>
                      {isMine && <CheckCheck size={12} style={{ color: item.read ? '#0059ff' : '#9aa0a6' }} />}
                    </div>
                  </div>
                )}
                {/* Карточка файла */}
                {item.file_url && item.is_file_attachment && (
                  <div>
                    <a href={item.file_url} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
                    >
                      <img src="/icon_file.svg" alt="file" style={{ width: '38px', height: '38px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{item.file_name}</p>
                        <p style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatFileSize(item.file_size)}</p>
                      </div>
                      <a href={item.file_url} download={item.file_name} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexShrink: 0 }}>
                        <Download size={16} color="#9ca3af" />
                      </a>
                    </a>
                    {item.content && <p style={{ fontSize: '14px', color: '#111827', wordBreak: 'break-word', lineHeight: '1.5', marginTop: '6px' }}>{item.content}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatTime(item.created_at)}</span>
                      {isMine && <CheckCheck size={12} style={{ color: item.read ? '#0059ff' : '#9aa0a6' }} />}
                    </div>
                  </div>
                )}
                {/* Несколько файлов */}
                {item.files && item.files.length > 0 && (() => {
                  const imgs = item.files.filter(f => !f.is_attachment && isImageType(f.type))
                  const docs = item.files.filter(f => f.is_attachment || !isImageType(f.type))
                  const grid = getGridStyle(imgs.length)
                  return (
                    <div>
                      {imgs.length > 0 && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                          gap: '3px',
                          width: '320px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}>
                          {imgs.map((f, fi) => {
                            const isLast = fi === imgs.length - 1
                            const isAloneInRow = imgs.length % grid.cols === 1 && isLast
                            return (
                              <div key={fi} style={{ position: 'relative', height: grid.height === 'auto' ? undefined : grid.height, maxHeight: grid.maxHeight, overflow: 'hidden', cursor: 'pointer', gridColumn: isAloneInRow ? `1 / -1` : undefined }}
                                onClick={() => setLightbox({ images: imgs.map(i => ({ url: i.url, name: i.name })), index: fi })}
                              >
                                <img src={f.url} alt={f.name}
                                  style={{ width: '100%', height: grid.height === 'auto' ? 'auto' : '100%', maxHeight: grid.maxHeight, objectFit: 'cover', display: 'block' }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {docs.map((f, fi) => (
                        <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '6px 0', borderTop: (imgs.length > 0 || fi > 0) ? '1px solid rgba(0,0,0,0.06)' : 'none', marginTop: imgs.length > 0 && fi === 0 ? '6px' : 0 }}
                        >
                          <img src="/icon_file.svg" alt="file" style={{ width: '32px', height: '32px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{f.name}</p>
                            <p style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatFileSize(f.size)}</p>
                          </div>
                          <a href={f.url} download={f.name} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexShrink: 0 }}>
                            <Download size={14} color="#9ca3af" />
                          </a>
                        </a>
                      ))}
                      {item.content && <p style={{ fontSize: '14px', color: '#111827', wordBreak: 'break-word', lineHeight: '1.5', marginTop: '6px', padding: '0 2px' }}>{item.content}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                        <span style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatTime(item.created_at)}</span>
                        {isMine && <CheckCheck size={12} style={{ color: item.read ? '#0059ff' : '#9aa0a6' }} />}
                      </div>
                    </div>
                  )
                })()}
                {/* Обычное текстовое сообщение */}
                {!item.file_url && !item.files && !item.is_deleted && (
                  <div>
                    <p style={{ fontSize: '14px', color: '#111827', wordBreak: 'break-word', lineHeight: '1.5', fontWeight: 450 }}>
                      {item.content.split(/(@\S+)/g).map((part, i) =>
                        part.startsWith('@') && groupMembers.some(m => `@${m.username}` === part)
                          ? <span key={i} style={{ color: '#0059ff', fontWeight: 600 }}>{part}</span>
                          : part
                      )}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      {item.edited_at && <span style={{ fontSize: '10px', color: '#9aa0a6', fontStyle: 'italic' }}>изм.</span>}
                      <span style={{ fontSize: '11px', color: '#9aa0a6' }}>{formatTime(item.created_at)}</span>
                      {isMine && <CheckCheck size={12} style={{ color: item.read ? '#0059ff' : '#9aa0a6' }} />}
                    </div>
                  </div>
                )}
              </div>
              {/* Чекбокс — справа для входящих сообщений */}
              {selectionMode && !isMine && (
                <div onClick={() => toggleSelect(item.id)} style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #d1d5db', background: isSelected ? '#0059ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Контекстное меню */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500 }}
          onClick={closeCtx}
          onContextMenu={e => { e.preventDefault(); closeCtx() }}
        >
          <div
            style={{
              position: 'fixed',
              top: Math.min(ctxMenu.y, window.innerHeight - 220),
              left: Math.min(ctxMenu.x, window.innerWidth - 200),
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              padding: '6px',
              minWidth: '180px',
              zIndex: 501,
            }}
            onClick={e => e.stopPropagation()}
          >
            {[
              { icon: <CornerUpLeft size={15} />, label: '\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c', onClick: () => { setReplyTo(ctxMenu.msg); setEditingMsg(null); closeCtx() } },
              { icon: <Share2 size={15} />, label: '\u041f\u0435\u0440\u0435\u0441\u043b\u0430\u0442\u044c', onClick: () => { openForward([ctxMenu.msg.id]); closeCtx() } },
              { icon: <CheckSquare size={15} />, label: '\u0412\u044b\u0431\u0440\u0430\u0442\u044c', onClick: () => { setSelectionMode(true); toggleSelect(ctxMenu.msg.id); closeCtx() } },
              ...(ctxMenu.isMine && !ctxMenu.msg.is_deleted ? [{ icon: <Pencil size={15} />, label: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c', onClick: () => { startEdit(ctxMenu.msg); closeCtx() } }] : []),
              ...(ctxMenu.isMine ? [{ icon: <Trash2 size={15} color="#ef4444" />, label: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c', red: true, onClick: () => { deleteMsg(ctxMenu.msg.id); closeCtx() } }] : []),
            ].map((item, i) => (
              <button key={i} onClick={item.onClick}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontSize: '14px', color: item.red ? '#ef4444' : '#111827', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = item.red ? '#fef2f2' : '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: item.red ? '#ef4444' : '#6b7280', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Лайтбокс просмотра фото */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          <button onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
            style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
            <X size={22} color="#fff" />
          </button>
          <span style={{ position: 'absolute', top: '26px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 500 }}>
            {lightbox.index + 1} / {lightbox.images.length}
          </span>
          {lightbox.index > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index - 1 })) }}
              style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={28} color="#fff" />
            </button>
          )}
          <img
            src={lightbox.images[lightbox.index].url}
            alt={lightbox.images[lightbox.index].name}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '8px', userSelect: 'none' }}
          />
          {lightbox.index < lightbox.images.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index + 1 })) }}
              style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={28} color="#fff" />
            </button>
          )}
          <p style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.55)', fontSize: '13px', maxWidth: '60vw', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lightbox.images[lightbox.index].name}
          </p>
        </div>
      )}

      {/* Диалог выбора типа отправки изображения */}
      {pendingFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '320px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Отправить изображение</h3>
              <button onClick={() => setPendingFile(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} color="#9ca3af" /></button>
            </div>
            <img src={URL.createObjectURL(pendingFile.file)} alt="preview"
              style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }}
            />
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', textAlign: 'center' }}>{pendingFile.file.name} · {formatFileSize(pendingFile.file.size)}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => uploadAndSend(pendingFile.file, true)}
                style={{ flex: 1, height: '40px', borderRadius: '12px', border: 'none', background: '#0059ff', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              ><Image size={15} /> Как фото</button>
              <button onClick={() => uploadAndSend(pendingFile.file, false)}
                style={{ flex: 1, height: '40px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              ><img src="/icon_file.svg" alt="" style={{ width: '16px', height: '16px' }} /> Как файл</button>
            </div>
          </div>
        </div>
      )}

      {/* Панель мультивыбора */}
      {selectionMode && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: '12px', margin: '0 12px 8px', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#1e40af', fontSize: '13px', fontWeight: 500 }}>
            {selectedIds.size > 0 ? `Выбрано: ${selectedIds.size}` : 'Выберите сообщения'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {selectedIds.size > 0 && (
              <>
                {selectedIds.size === 1 && (() => {
                  const msg = messages.find(m => m.id === Array.from(selectedIds)[0])
                  return msg ? (
                    <button onClick={() => { setReplyTo(msg); setEditingMsg(null); cancelSelection() }}
                      style={{ color: '#1e40af', background: 'rgba(0,89,255,0.08)', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CornerUpLeft size={13} /> Ответить
                    </button>
                  ) : null
                })()}
                <button onClick={() => openForward(Array.from(selectedIds))}
                  style={{ color: '#1e40af', background: 'rgba(0,89,255,0.08)', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Share2 size={13} /> Переслать
                </button>
                <button onClick={() => deleteManyMsg(Array.from(selectedIds))}
                  style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Trash2 size={13} /> Удалить
                </button>
              </>
            )}
            <button onClick={cancelSelection}
              style={{ color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Диалог пересылки */}
      {forwardDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '340px', maxHeight: '480px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Переслать в чат</h3>
              <button onClick={() => setForwardDialog(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} color="#9ca3af" /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {chats.filter(c => c.id !== activeChat?.id).map(c => (
                <button key={c.id} onClick={() => doForward(c.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '10px', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    {(c.name || c.other_user?.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                    {c.name || c.other_user?.display_name || 'Чат'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Панель ответа/редактирования */}
      {(replyTo || editingMsg) && !selectionMode && (
        <div style={{ background: '#f8faff', borderTop: '1px solid #e5e7eb', borderLeft: '3px solid #0059ff', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#0059ff', marginBottom: '2px' }}>
              {editingMsg ? 'Редактирование' : `Ответ ${replyTo?.sender_id === user?.id ? 'себе' : (otherUser?.display_name || '')}`}
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {editingMsg ? editingMsg.content : (replyTo?.content || (replyTo?.file_name ? replyTo.file_name : ''))}
            </p>
          </div>
          <button onClick={cancelCompose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Поле ввода сообщения */}
      <div style={{ background: chatPanelBg, borderTop: '1px solid #e5e7eb', padding: '10px 16px' }}>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ width: '40px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: uploading ? 'wait' : 'pointer', flexShrink: 0 }}
          >
            <Paperclip size={20} color={uploading ? '#0059ff' : '#9ca3af'} />
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Дропдаун @меншена */}
            {showMention && (() => {
              const filtered = groupMembers.filter(m =>
                m.id !== user?.id &&
                (m.username.toLowerCase().includes(mentionQuery) ||
                 m.display_name.toLowerCase().includes(mentionQuery))
              )
              if (filtered.length === 0) return null
              return (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '6px', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.14)', border: '1px solid #e5e7eb', zIndex: 100, overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
                  {filtered.map(m => {
                    return (
                      <button key={m.id} onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt={m.display_name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 600, color: '#5f6368' }}>{m.display_name?.charAt(0)?.toUpperCase()}</span></div>
                        }
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{m.display_name}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af' }}>@{m.username}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            <textarea
              ref={textareaRef}
              value={uploading ? 'Загрузка файла...' : text}
              onChange={(e) => {
                if (uploading) return
                const val = e.target.value
                setText(val)
                autoResizeTextarea()
                // Обнаружение @меншена в групповом чате
                if (isGroup && groupMembers.length > 0) {
                  const pos = e.target.selectionStart
                  const before = val.slice(0, pos)
                  const m = before.match(/@(\S*)$/)
                  if (m) {
                    setMentionStart(pos - m[0].length)
                    setMentionQuery(m[1].toLowerCase())
                    setShowMention(true)
                  } else {
                    setShowMention(false)
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowMention(false); return }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              disabled={uploading}
              placeholder="Сообщение..."
              rows={1}
              style={{ width: '100%', minHeight: '36px', maxHeight: '216px', background: '#f9fafb', borderRadius: '12px', padding: '8px 16px', fontSize: '14px', border: 'none', outline: 'none', boxSizing: 'border-box', color: uploading ? '#9ca3af' : '#111827', resize: 'none', lineHeight: '20px', overflowY: 'auto', fontFamily: 'inherit' }}
            />
          </div>
          <button
            type="submit"
            disabled={(!text.trim() && !editingMsg) || uploading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 500, color: (text.trim() && !uploading) ? '#0059ff' : '#9ca3af', border: 'none', background: 'transparent', cursor: (text.trim() && !uploading) ? 'pointer' : 'default', flexShrink: 0, height: '36px' }}
          >
            Отправить
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* Инфопанель группы */}
      {infoPanel && !isFavorites && isGroup && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <GroupMembersPanel onClose={() => setInfoPanel(false)} />
        </div>
      )}

      {/* Инфопанель */}
      {infoPanel && !isFavorites && !isGroup && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '290px', background: '#fff', borderLeft: '1px solid #e5e7eb', zIndex: 20, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Шапка инфопанели */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            {infoPanelView !== 'main' ? (
              <button onClick={() => setInfoPanelView('main')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0059ff', fontSize: '13px', fontWeight: 500, padding: 0 }}>
                <ArrowLeft size={16} /> Назад
              </button>
            ) : (
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                {infoPanelView === 'photos' ? 'Фотографии' : infoPanelView === 'files' ? 'Файлы' : 'Информация'}
              </span>
            )}
            <button onClick={() => setInfoPanel(false)} style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X size={16} color="#9ca3af" />
            </button>
          </div>

          {infoPanelView === 'main' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Информация о собеседнике */}
              <div style={{ padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '22px', fontWeight: 600, color: '#5f6368' }}>
                    {otherUser?.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{alias || otherUser?.display_name || activeChat.name}</p>
                    <p style={{ fontSize: '12px', color: isOnline ? '#22c55e' : '#9ca3af', marginTop: '2px' }}>{isOnline ? 'В сети' : 'Не в сети'}</p>
                </div>
                {/* Переименование чата */}
                <div style={{ width: '100%', marginTop: '4px' }}>
                  {editingAlias ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        autoFocus
                        value={aliasInput}
                        onChange={e => setAliasInput(e.target.value)}
                        placeholder={otherUser?.display_name || 'Псевдоним...'}
                        style={{ flex: 1, height: '32px', background: '#f5f5f5', borderRadius: '8px', padding: '0 10px', fontSize: '13px', border: '1.5px solid #0059ff', outline: 'none' }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { setChatAlias(activeChat.id, aliasInput); setEditingAlias(false) }
                          if (e.key === 'Escape') { setEditingAlias(false) }
                        }}
                      />
                      <button onClick={() => { setChatAlias(activeChat.id, aliasInput); setEditingAlias(false) }}
                        style={{ height: '32px', padding: '0 10px', background: '#0059ff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                        Сохранить
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setAliasInput(alias); setEditingAlias(true) }}
                      style={{ width: '100%', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#f5f5f5', border: 'none', borderRadius: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                      <UserCog size={14} color="#0059ff" />
                      {alias ? 'Изменить псевдоним' : 'Задать псевдоним'}
                    </button>
                  )}
                  {alias && !editingAlias && (
                    <button onClick={() => { setChatAlias(activeChat.id, ''); setAliasInput('') }}
                      style={{ width: '100%', marginTop: '4px', height: '26px', background: 'transparent', border: 'none', fontSize: '11px', color: '#9ca3af', cursor: 'pointer' }}>
                      Сбросить псевдоним
                    </button>
                  )}
                </div>
              </div>

              {/* Строка фотографий */}
              <div onClick={() => setInfoPanelView('photos')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={18} color="#0059ff" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Фотографии</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>{photos.length} фото</p>
                </div>
                <ChevronRight size={16} color="#9ca3af" />
              </div>

              {/* Строка файлов */}
              <div onClick={() => setInfoPanelView('files')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#22c55e" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Файлы</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>{chatFiles.length} файлов</p>
                </div>
                <ChevronRight size={16} color="#9ca3af" />
              </div>
            </div>
          )}

          {infoPanelView === 'photos' && (
            <div style={{ padding: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '10px' }}>Фотографии</p>
              {photos.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '30px' }}>Нет фотографий</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                  {photos.map((p, i) => (
                    <div key={i} onClick={() => setLightbox({ images: photos.map(x => ({ url: x.url, name: x.name })), index: i })}
                      style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: '6px', cursor: 'pointer' }}>
                      <img src={p.url} alt={p.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {infoPanelView === 'files' && (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Файлы</p>
              {chatFiles.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '30px' }}>Нет файлов</p>
              ) : (
                chatFiles.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: '#f9fafb', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}>
                    <img src="/icon_file.svg" alt="" style={{ width: '30px', height: '30px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name || 'Файл'}</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af' }}>{formatFileSize(f.size)}</p>
                    </div>
                    <a href={f.url} download={f.name} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexShrink: 0 }}>
                      <Download size={14} color="#9ca3af" />
                    </a>
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {confirmDeleteDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '300px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Удалить {confirmDeleteDialog.ids.length > 1 ? `${confirmDeleteDialog.ids.length} сообщения` : 'сообщение'}?</p>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Это действие нельзя отменить.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmDeleteDialog(null)}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>Отмена</button>
              <button onClick={async () => { await confirmDeleteDialog.onConfirm(); setConfirmDeleteDialog(null) }}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: 'none', background: '#ef4444', fontSize: '13px', fontWeight: 500, color: '#fff', cursor: 'pointer' }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
