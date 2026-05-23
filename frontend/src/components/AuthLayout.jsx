import { Link } from 'react-router-dom'

export function BackgroundPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="logoPattern1" width="300" height="300" patternUnits="userSpaceOnUse"
            patternTransform="rotate(30)">
            <image href="/logo.png" x="84" y="84" width="132.84" height="132.84" opacity="0.07" />
          </pattern>
          <filter id="grayscale">
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#logoPattern1)" filter="url(#grayscale)" />
      </svg>
    </div>
  )
}

export function AuthCard({ children, className = '' }) {
  return (
    <div 
      className={`relative z-10 w-[calc(100%-32px)] sm:w-[520px] bg-white rounded-[32px] shadow-sm flex flex-col items-center ${className}`}
      style={{ paddingTop: '50px', paddingBottom: '50px', paddingLeft: '56px', paddingRight: '56px' }}
    >
      {children}
    </div>
  )
}

export function AuthHeader({ title, subtitle }) {
  return (
    <div className="w-full flex flex-col items-start gap-2">
      <h1
        className="w-full text-center uppercase font-semibold text-[18px] sm:text-[20px] leading-[24px] sm:leading-[27px] text-[#121F24]"
        style={{ fontFamily: "'Open Sans', sans-serif" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="w-full text-center font-normal text-[11px] leading-[14px] text-[#4E4E4E]"
          style={{ fontFamily: "'Open Sans', sans-serif" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function AuthInput({ label, type = 'text', value, onChange, placeholder, required, children }) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <label
        className="font-normal text-[14px] leading-[19px] text-[#121F24]"
        style={{ fontFamily: "'Open Sans', sans-serif" }}
      >
        {label}
      </label>
      <div
        className="w-full h-10 flex items-center rounded-[12px] bg-[#F2F2F2]"
        style={{
          padding: children ? '10px 12px' : '10px 12px 10px 16px',
          gap: children ? '12px' : '6px',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          className="flex-1 bg-transparent text-[13px] leading-[17px] text-[#121F24] placeholder-[#999999] outline-none"
          style={{ fontFamily: "'Open Sans', sans-serif" }}
          placeholder={placeholder}
          required={required}
        />
        {children}
      </div>
    </div>
  )
}

export function AuthButton({ children, loading, type = 'submit' }) {
  return (
    <button
      type={type}
      disabled={loading}
      className="w-full h-[44px] bg-[#0059FF] rounded-[24px] flex items-center justify-center text-white font-medium text-[15px] leading-[20px] hover:bg-[#0047CC] transition disabled:opacity-50"
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      {loading ? 'Загрузка...' : children}
    </button>
  )
}

export function AuthLink({ to, children }) {
  return (
    <Link
      to={to}
      className="font-medium text-[13px] leading-[17px] text-[#0059FF] hover:underline"
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      {children}
    </Link>
  )
}

export function LogoIcon({ className, style }) {
  return (
    <img
      src="/logo.png"
      alt="Logo"
      className={className}
      style={style}
      onError={(e) => {
        e.target.style.display = 'none'
      }}
    />
  )
}
