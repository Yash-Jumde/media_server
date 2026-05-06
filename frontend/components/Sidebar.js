'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, Film, Tv, Music, Image as ImageIcon, Heart,
  RefreshCw, LogOut, X, Users, Settings, User as UserIcon
} from 'lucide-react';
import { clearToken, scanLibrary, getCurrentUser } from '@/lib/api';
import { useState, useEffect } from 'react';
import TranscodeQueue from './TranscodeQueue';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutGrid },
  { href: '/movies', label: 'Movies', icon: Film },
  { href: '/tv-shows', label: 'TV Shows', icon: Tv },
  { href: '/audio', label: 'Audio', icon: Music },
  { href: '/images', label: 'Images', icon: ImageIcon },
  { href: '/favorites', label: 'Favorites', icon: Heart },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const [scanning, setScanning] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanLibrary();
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoText}>MediaVault</span>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <span className={styles.navLabel}>Browse</span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Library</span>
            <button
              className={styles.navItem}
              onClick={handleScan}
              disabled={scanning}
            >
              <RefreshCw size={20} className={scanning ? styles.spinning : ''} />
              <span>{scanning ? 'Scanning...' : 'Refresh Library'}</span>
            </button>
          </div>

          <div className={styles.queueWrapper}>
            <TranscodeQueue compact={true} />
          </div>

          {user && user.role === 'admin' && (
            <div className={styles.navSection}>
              <span className={styles.navLabel}>Admin</span>
              <Link
                href="/admin"
                className={`${styles.navItem} ${pathname === '/admin' ? styles.active : ''}`}
              >
                <Users size={20} />
                <span>User Management</span>
              </Link>
            </div>
          )}

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Account</span>
            <Link
              href="/profile"
              className={`${styles.navItem} ${pathname === '/profile' ? styles.active : ''}`}
            >
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        <div className={styles.footer}>
          {user && (
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className={styles.avatarImage} />
                ) : (
                  <div className={styles.defaultAvatar}>
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.username}>{user.username}</span>
                <span className={styles.userRole}>{user.role}</span>
              </div>
            </div>
          )}
          <button className={styles.navItem} onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
