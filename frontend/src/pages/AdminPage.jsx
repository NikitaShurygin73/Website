import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Users, Shield, Trash2, ArrowLeft, UserPlus, Bell, KeyRound, Building2, Send, CheckCircle2, X } from 'lucide-react'

function Avatar({ name, avatarUrl, size = 38 }) {
  const letter = (name || '?').charAt(0).toUpperCase()
  const colors = ['#0059ff', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']
  const bg = colors[name ? name.charCodeAt(0) % colors.length : 0]
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.4, fontWeight: 700, color: bg }}>{letter}</span>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { token, user: currentUser } = useAuthStore()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [activeTab, setActiveTab] = useState('users')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateDept, setShowCreateDept] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', display_name: '', password: '', is_admin: false })
  const [newDept, setNewDept] = useState({ name: '', description: '' })
  const [tickets, setTickets] = useState([])
  const [replyTexts, setReplyTexts] = useState({})
  const [userError, setUserError] = useState('')
  const [deptError, setDeptError] = useState('')
  const [resetPasswordFor, setResetPasswordFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const ticketPollRef = useRef(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchUsers()
    fetchDepartments()
    fetchTickets()
    ticketPollRef.current = setInterval(fetchTickets, 30000)
    return () => clearInterval(ticketPollRef.current)
  }, [])

  const fetchTickets = async () => {
    const res = await fetch('/api/auth/support', { headers })
    if (res.ok) setTickets(await res.json())
  }

  const resolveTicket = async (id) => {
    await fetch(`/api/auth/support/${id}`, { method: 'DELETE', headers })
    fetchTickets()
  }

  const sendReply = async (ticketId) => {
    const msg = (replyTexts[ticketId] || '').trim()
    if (!msg) return
    await fetch(`/api/auth/support/${ticketId}/reply`, {
      method: 'POST', headers,
      body: JSON.stringify({ message: msg }),
    })
    setReplyTexts(prev => ({ ...prev, [ticketId]: '' }))
  }

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users', { headers })
    if (res.ok) setUsers(await res.json())
  }

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments', { headers })
    if (res.ok) setDepartments(await res.json())
  }

  const createUser = async (e) => {
    e.preventDefault()
    setUserError('')
    const res = await fetch('/api/admin/users', { method: 'POST', headers, body: JSON.stringify(newUser) })
    if (res.ok) {
      setShowCreateUser(false)
      setNewUser({ username: '', display_name: '', password: '', is_admin: false })
      fetchUsers()
    } else {
      const err = await res.json()
      setUserError(err.detail || 'Ошибка создания')
    }
  }

  const deleteUser = async (id) => {
    if (!confirm('Удалить пользователя?')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers })
    fetchUsers()
  }

  const toggleAdmin = async (id, isAdmin) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ is_admin: !isAdmin }),
    })
    fetchUsers()
  }

  const toggleTeamLead = async (id, isTeamLead) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ is_team_lead: !isTeamLead }),
    })
    fetchUsers()
  }

  const resetPassword = async (userId) => {
    setResetError('')
    if (!newPassword.trim()) { setResetError('Введите пароль'); return }
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ password: newPassword.trim() }),
    })
    if (res.ok) {
      setResetPasswordFor(null)
      setNewPassword('')
    } else {
      const err = await res.json()
      setResetError(err.detail || 'Ошибка')
    }
  }

  const createDepartment = async (e) => {
    e.preventDefault()
    setDeptError('')
    const res = await fetch('/api/departments', { method: 'POST', headers, body: JSON.stringify(newDept) })
    if (res.ok) {
      setShowCreateDept(false)
      setNewDept({ name: '', description: '' })
      fetchDepartments()
    } else {
      const err = await res.json()
      setDeptError(err.detail || 'Ошибка')
    }
  }

  const deleteDepartment = async (id) => {
    if (!confirm('Удалить отдел?')) return
    await fetch(`/api/departments/${id}`, { method: 'DELETE', headers })
    fetchDepartments()
  }

  const NAV = [
    { key: 'users', label: 'Пользователи', icon: <Users size={17} />, count: users.length },
    { key: 'departments', label: 'Отделы', icon: <Building2 size={17} />, count: departments.length },
    { key: 'tickets', label: 'Заявки', icon: <Bell size={17} />, count: tickets.length, badge: true },
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
      {/* Шапка */}
      <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
        <button onClick={() => navigate('/chat')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: '#374151', fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft size={15} /> Назад
        </button>
        <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0059ff18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={17} color="#0059ff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Панель администратора</span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Боковое меню */}
        <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 10px', marginBottom: 8 }}>Меню</p>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setActiveTab(n.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: 13.5, fontWeight: activeTab === n.key ? 600 : 500,
                background: activeTab === n.key ? '#0059ff' : 'transparent',
                color: activeTab === n.key ? '#fff' : '#374151',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (activeTab !== n.key) e.currentTarget.style.background = '#f3f4f6' }}
              onMouseLeave={e => { if (activeTab !== n.key) e.currentTarget.style.background = 'transparent' }}
            >
              {n.icon}
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge && n.count > 0 && (
                <span style={{ background: activeTab === n.key ? '#fff' : '#ef4444', color: activeTab === n.key ? '#0059ff' : '#fff', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>
                  {n.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Основной контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

          {/* Статистика */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard icon={<Users size={22} color="#0059ff" />} label="Пользователей" value={users.length} color="#0059ff" />
            <StatCard icon={<Building2 size={22} color="#7c3aed" />} label="Отделов" value={departments.length} color="#7c3aed" />
            <StatCard icon={<Bell size={22} color={tickets.length ? '#ef4444' : '#059669'} />} label="Заявок" value={tickets.length} color={tickets.length ? '#ef4444' : '#059669'} />
          </div>

          {/* Вкладка пользователи */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Пользователи</h2>
                <button onClick={() => { setShowCreateUser(v => !v); setUserError('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#0059ff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <UserPlus size={15} /> Создать пользователя
                </button>
              </div>

              {showCreateUser && (
                <form onSubmit={createUser} style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Новый пользователь</h3>
                  {userError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{userError}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <input placeholder="Логин" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required
                      style={{ height: 40, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none' }}
                      onFocus={e => e.target.style.border = '1.5px solid #0059ff'} onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'} />
                    <input placeholder="Отображаемое имя" value={newUser.display_name} onChange={e => setNewUser({ ...newUser, display_name: e.target.value })} required
                      style={{ height: 40, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none' }}
                      onFocus={e => e.target.style.border = '1.5px solid #0059ff'} onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'} />
                    <input type="password" placeholder="Пароль" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required
                      style={{ height: 40, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none' }}
                      onFocus={e => e.target.style.border = '1.5px solid #0059ff'} onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })} />
                      <span style={{ fontSize: 13, color: '#374151' }}>Администратор</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" style={{ padding: '8px 20px', background: '#0059ff', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Создать</button>
                    <button type="button" onClick={() => setShowCreateUser(false)} style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Отмена</button>
                  </div>
                </form>
              )}

              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Пользователь', 'Логин', 'Роль', 'Действия'].map((h, i) => (
                        <th key={h} style={{ padding: '12px 20px', textAlign: i === 3 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, idx) => (
                      <tr key={u.id} style={{ borderBottom: idx < users.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={u.display_name} avatarUrl={u.avatar_url} size={36} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{u.display_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>@{u.username}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                              background: u.is_admin ? '#7c3aed18' : '#f3f4f6', color: u.is_admin ? '#7c3aed' : '#6b7280' }}>
                              {u.is_admin && <Shield size={11} />}
                              {u.is_admin ? 'Администратор' : 'Пользователь'}
                            </span>
                            {u.is_team_lead && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#fef3c718', color: '#d97706' }}>
                                Тимлид
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            {resetPasswordFor === u.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input autoFocus value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                  placeholder="Новый пароль" type="password"
                                  style={{ height: 32, background: '#f9fafb', border: '1.5px solid #0059ff', borderRadius: 8, padding: '0 10px', fontSize: 12, outline: 'none', width: 140 }}
                                  onKeyDown={e => e.key === 'Enter' && resetPassword(u.id)} />
                                <button onClick={() => resetPassword(u.id)}
                                  style={{ height: 32, padding: '0 10px', background: '#0059ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Сохранить</button>
                                <button onClick={() => { setResetPasswordFor(null); setNewPassword(''); setResetError('') }}
                                  style={{ height: 32, width: 32, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <X size={14} color="#6b7280" />
                                </button>
                                {resetError && <span style={{ fontSize: 11, color: '#ef4444' }}>{resetError}</span>}
                              </div>
                            ) : (
                              <button onClick={() => { setResetPasswordFor(u.id); setNewPassword(''); setResetError('') }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 10px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                                <KeyRound size={13} /> Пароль
                              </button>
                            )}
                            <button onClick={() => u.id !== currentUser?.id && toggleAdmin(u.id, u.is_admin)}
                              disabled={u.id === currentUser?.id}
                              title={u.id === currentUser?.id ? 'Нельзя изменить свою роль' : ''}
                              style={{ height: 32, padding: '0 10px', background: u.is_admin ? '#7c3aed18' : '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', color: u.is_admin ? '#7c3aed' : '#374151', opacity: u.id === currentUser?.id ? 0.4 : 1 }}>
                              {u.is_admin ? 'Снять' : 'Админ'}
                            </button>
                            <button onClick={() => toggleTeamLead(u.id, u.is_team_lead)}
                              style={{ height: 32, padding: '0 10px', background: u.is_team_lead ? '#fef3c718' : '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: u.is_team_lead ? '#d97706' : '#374151' }}>
                              {u.is_team_lead ? 'Снять лида' : 'Лид'}
                            </button>
                            <button onClick={() => u.id !== currentUser?.id && deleteUser(u.id)}
                              disabled={u.id === currentUser?.id}
                              title={u.id === currentUser?.id ? 'Нельзя удалить себя' : ''}
                              style={{ height: 32, width: 32, background: '#fef2f2', border: 'none', borderRadius: 8, cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: u.id === currentUser?.id ? 0.4 : 1 }}>
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Вкладка отделы */}
          {activeTab === 'departments' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Отделы</h2>
                <button onClick={() => { setShowCreateDept(v => !v); setDeptError('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <UserPlus size={15} /> Создать отдел
                </button>
              </div>

              {showCreateDept && (
                <form onSubmit={createDepartment} style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Новый отдел</h3>
                  {deptError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{deptError}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <input placeholder="Название" value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} required
                      style={{ height: 40, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none' }}
                      onFocus={e => e.target.style.border = '1.5px solid #7c3aed'} onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'} />
                    <input placeholder="Описание (необязательно)" value={newDept.description} onChange={e => setNewDept({ ...newDept, description: e.target.value })}
                      style={{ height: 40, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none' }}
                      onFocus={e => e.target.style.border = '1.5px solid #7c3aed'} onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" style={{ padding: '8px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Создать</button>
                    <button type="button" onClick={() => setShowCreateDept(false)} style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Отмена</button>
                  </div>
                </form>
              )}

              {departments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>Нет отделов</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {departments.map(dept => (
                    <div key={dept.id} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#7c3aed18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building2 size={20} color="#7c3aed" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.name}</p>
                            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{dept.description || 'Без описания'}</p>
                          </div>
                        </div>
                        <button onClick={() => deleteDepartment(dept.id)}
                          style={{ width: 32, height: 32, background: '#fef2f2', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280' }}>
                        {dept.member_count || 0} участников
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Вкладка заявки */}
          {activeTab === 'tickets' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Заявки на восстановление доступа</h2>
                <button onClick={fetchTickets}
                  style={{ padding: '7px 14px', background: '#f3f4f6', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                  Обновить
                </button>
              </div>
              {tickets.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={28} color="#059669" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Нет новых заявок</p>
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>Все заявки обработаны</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {tickets.map(t => (
                    <div key={t.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid #f3f4f6' }}>
                        <Avatar name={t.username} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{t.username}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(t.created_at).toLocaleString('ru-RU')}</span>
                          </div>
                          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{t.message}</p>
                        </div>
                        <button onClick={() => resolveTicket(t.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                          <CheckCircle2 size={14} /> Закрыть
                        </button>
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
                        <input
                          value={replyTexts[t.id] || ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && sendReply(t.id)}
                          placeholder="Ответить пользователю..."
                          style={{ flex: 1, height: 36, background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0 12px', fontSize: 13, outline: 'none' }}
                          onFocus={e => e.target.style.border = '1.5px solid #0059ff'}
                          onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'}
                        />
                        <button onClick={() => sendReply(t.id)}
                          style={{ height: 36, width: 36, background: '#0059ff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Send size={15} color="#fff" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
