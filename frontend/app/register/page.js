'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/api';
import { Film, Lock, User, Image as ImageIcon, ArrowRight, CheckCircle } from 'lucide-react';
import styles from '../login/page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, password, avatarUrl);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.glow} />
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <div className={`${styles.logo} ${styles.successLogo}`}>
              <CheckCircle size={28} />
            </div>
            <h1 className={styles.brand}>Success!</h1>
            <p className={styles.tagline}>Your account has been created.</p>
          </div>
          <div className={styles.footerLinks}>
            <p className={styles.successText}>Please wait for an administrator to approve your account before signing in.</p>
            <Link href="/login" className={styles.link}>Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            <Film size={28} />
          </div>
          <h1 className={styles.brand}>Create Account</h1>
          <p className={styles.tagline}>Join your personal media vault</p>
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
              required
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
              required
            />
          </div>
          <div className={styles.inputWrap}>
            <ImageIcon size={18} className={styles.inputIcon} />
            <input
              type="text"
              placeholder="Avatar URL (Optional)"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={styles.input}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className={styles.footerLinks}>
          <p>Already have an account?</p>
          <Link href="/login" className={styles.link}>Sign in instead</Link>
        </div>
      </div>
    </div>
  );
}
