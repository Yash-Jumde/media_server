'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Film, Lock, User, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/');
    } catch (err) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            <Film size={28} />
          </div>
          <h1 className={styles.brand}>MediaVault</h1>
          <p className={styles.tagline}>Your personal media experience</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <User size={18} className={styles.inputIcon} />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              autoFocus
            />
          </div>
          <div className={styles.inputWrap}>
            <Lock size={18} className={styles.inputIcon} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
          </div>
          {error && <p className={`${styles.error} ${error === 'Pending Approval' ? styles.pending : ''}`}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className={styles.footerLinks}>
          <p>Don't have an account?</p>
          <Link href="/register" className={styles.link}>Register here</Link>
        </div>
      </div>
    </div>
  );
}
