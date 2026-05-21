import { Link } from 'react-router-dom';
import styles from './CTAButton.module.css';

export default function CTAButton({
  to,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}) {
  const className = `${styles.btn} ${styles[variant]} ${styles[size]}`;

  if (to) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
