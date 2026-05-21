import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from './LangToggle.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { roleLabel } from '../../lib/format.js';
import styles from './Header.module.css';

const NAV_ITEMS = [
  { to: '/', key: 'nav.home' },
  { to: '/vision', key: 'nav.vision' },
  { to: '/themepark', key: 'nav.themepark' },
  { to: '/clone', key: 'nav.clone' },
  { to: '/map', key: 'nav.map' },
  { to: '/demo', key: 'nav.demo' },
  { to: '/investment', key: 'nav.investment' },
  { to: '/dataroom', key: 'nav.dataroom' },
  { to: '/contact', key: 'nav.contact' },
];

export default function Header() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onLogout = async () => {
    setUserMenu(false);
    await logout();
    navigate('/');
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
          <span className={styles.brandMark}>◐</span>
          <span className={styles.brandName}>JooJooLand</span>
        </Link>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <LangToggle />
          {user ? (
            <div className={styles.userWrap}>
              <button
                className={styles.userBadge}
                onClick={() => setUserMenu((v) => !v)}
                aria-expanded={userMenu}
              >
                <span className={styles.userAvatar}>
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </span>
                <span className={styles.userName}>{user.display_name || user.email.split('@')[0]}</span>
                <span className={styles.userRole}>{roleLabel(user.role)}</span>
              </button>
              {userMenu && (
                <div className={styles.userDropdown} role="menu">
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <Link to="/admin" className={styles.userMenuItem} onClick={() => setUserMenu(false)}>
                      어드민
                    </Link>
                  )}
                  {user.role === 'guest' && (
                    <Link to="/upgrade" className={styles.userMenuItem} onClick={() => setUserMenu(false)}>
                      투자자 등업
                    </Link>
                  )}
                  {(user.role === 'investor' || user.role === 'admin' || user.role === 'superadmin') && (
                    <Link to="/dataroom" className={styles.userMenuItem} onClick={() => setUserMenu(false)}>
                      DataRoom
                    </Link>
                  )}
                  <button className={styles.userMenuItem} onClick={onLogout}>로그아웃</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className={styles.loginCta}>로그인</Link>
          )}
          <button
            className={styles.menuToggle}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
