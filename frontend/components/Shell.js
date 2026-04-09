'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import styles from './Shell.module.css';

export default function Shell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

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
        {children}
      </div>
    </div>
  );
}
