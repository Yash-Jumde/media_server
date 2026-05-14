'use client';

import { useState, useEffect } from 'react';
import { fetchProfile, updateProfile } from '@/lib/api';
import { User as UserIcon, Settings, Save, CheckCircle, AlertCircle } from 'lucide-react';
import styles from './profile.module.css';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const data = await fetchProfile();
      setProfile(data);
      setUsername(data.username);
      setAvatarUrl(data.avatar_url || '');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateProfile({ username, avatar_url: avatarUrl });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      // Update local state to reflect change immediately
      setProfile(prev => ({ ...prev, username, avatar_url: avatarUrl }));
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading profile...</div>;

  if (!profile) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={`${styles.message} ${styles.error}`}>
            <AlertCircle size={18} />
            <span>{message.text || 'Profile could not be loaded.'}</span>
          </div>
          <button className={styles.saveButton} onClick={loadProfile} style={{ marginTop: '20px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <Settings className={styles.titleIcon} size={24} />
          <h1 className={styles.title}>Account Settings</h1>
        </div>
        <p className={styles.subtitle}>Manage your profile and preferences</p>
      </header>

      <div className={styles.card}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarPreview}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className={styles.previewImage} />
            ) : (
              <div className={styles.defaultAvatar}>
                {username.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className={styles.profileMeta}>
            <h2 className={styles.profileName}>{profile.username}</h2>
            <span className={styles.roleBadge}>{profile.role}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Avatar URL</label>
            <input
              type="text"
              className={styles.input}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <p className={styles.fieldHint}>Enter a link to an image for your profile picture</p>
          </div>

          {message.text && (
            <div className={`${styles.message} ${styles[message.type]}`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          <button type="submit" className={styles.saveButton} disabled={saving}>
            {saving ? 'Saving...' : (
              <>
                <Save size={18} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>

        <div className={styles.infoSection}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Account Status</span>
            <span className={styles.infoValue}>
              {profile.is_approved ? 'Approved' : 'Pending Approval'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Joined</span>
            <span className={styles.infoValue}>
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
