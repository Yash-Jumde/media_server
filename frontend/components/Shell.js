'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import { useSearch } from '@/lib/SearchContext';
import Sidebar from './Sidebar';
import styles from './Shell.module.css';

const titleMap = {
  '/': 'Library',
  '/movies': 'Movies',
  '/tv-shows': 'TV Shows',
  '/audio': 'Audio',
  '/images': 'Images',
  '/favorites': 'Favorites',
  '/admin': 'User Management',
  '/profile': 'Account Settings',
};

export default function Shell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useSearch();

  // Get current page title
  const pageTitle = titleMap[pathname] || 'Library';

  // Close sidebar when navigating on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className={styles.layout}>
      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <div className={styles.logo}>
          <span className={styles.logoText}>MediaVault</span>
        </div>
        <button className={styles.menuButton} onClick={toggleSidebar}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <div className={styles.searchWrap}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        <div className={styles.scrollContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
