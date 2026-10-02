import logoHorizontal from '../assets/ref2.png'
import logoIcon from '../assets/ref1.png'
import logoDark from '../assets/ref4.png'

interface LogoProps {
  variant?: 'horizontal' | 'icon' | 'dark'
  className?: string
}

export default function Logo({ variant = 'horizontal', className = '' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <img
        src={logoIcon}
        alt="Procópio Express"
        className={className || 'h-10 w-10 object-contain'}
      />
    )
  }
  if (variant === 'dark') {
    return (
      <img
        src={logoDark}
        alt="Procópio Express"
        className={className || 'h-12 object-contain'}
      />
    )
  }
  return (
    <img
      src={logoHorizontal}
      alt="Procópio Express"
      className={className || 'h-10 object-contain'}
    />
  )
}
