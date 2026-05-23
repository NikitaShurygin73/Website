import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  BackgroundPattern,
  AuthCard,
  AuthHeader,
  AuthInput,
  AuthButton,
  AuthLink,
  LogoIcon,
} from '../components/AuthLayout'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setLoading(true)
    try {
      await register(username, username, password)
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
      <BackgroundPattern />

      <AuthCard>
        <LogoIcon className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px]" style={{ marginBottom: '25px' }} />

        <div className="w-full max-w-[388px] flex flex-col items-start gap-10">
          <AuthHeader
            title="РЕГИСТРАЦИЯ"
            subtitle="Создайте аккаунт для мессенджера"
          />

          {error && (
            <p className="w-full text-red-500 text-[12px] leading-[16px] text-center font-semibold">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
            <AuthInput
              label="Логин"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
            />

            <AuthInput
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            >
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center justify-center text-[#999999] hover:text-[#121F24] transition shrink-0"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </AuthInput>

            <AuthInput
              label="Подтвердите пароль"
              type={showPassword ? 'text' : 'password'}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Повторите пароль"
              required
            >
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center justify-center text-[#999999] hover:text-[#121F24] transition shrink-0"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </AuthInput>

            <div className="pt-4">
              <AuthButton loading={loading}>
                Зарегистрироваться
              </AuthButton>
            </div>

            <div className="w-full flex justify-center pt-3">
              <AuthLink to="/login">Уже есть аккаунт? Войти</AuthLink>
            </div>
          </form>
        </div>
      </AuthCard>
    </div>
  )
}
