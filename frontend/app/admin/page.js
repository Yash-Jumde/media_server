'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPendingUsers, fetchAllUsers, approveUser, denyUser, deleteUser, updateUserRole, getCurrentUser } from '@/lib/api';
import { UserCheck, UserX, User as UserIcon, ShieldAlert, Users, Trash2, Shield, ShieldOff } from 'lucide-react';
import styles from './admin.module.css';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'all'

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    setCurrentUser(user);
    setIsAdmin(true);
    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, all] = await Promise.all([
        fetchPendingUsers(),
        fetchAllUsers()
      ]);
      setPendingUsers(pending);
      setActiveUsers(all.filter(u => u.is_approved));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveUser(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to approve user');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently remove this user? This action cannot be undone.')) return;
    try {
      await deleteUser(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${user.username}'s role to ${newRole}?`)) return;
    try {
      await updateUserRole(user.id, newRole);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to update role');
    }
  };

  const handleDeny = async (id) => {
    if (!confirm('Are you sure you want to deny and remove this user registration?')) return;
    try {
      await denyUser(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to deny user');
    }
  };

  if (!isAdmin) return null;

  const displayUsers = activeTab === 'pending' ? pendingUsers : activeUsers;

  // Default avatar generator using name initials if no avatar
  const getAvatar = (user) => {
    if (user.avatar_url) {
      return <img src={user.avatar_url} alt={user.username} className={styles.avatarImage} />;
    }
    const initials = user.username.substring(0, 2).toUpperCase();
    return (
      <div className={styles.defaultAvatar} style={{ 
        background: `linear-gradient(135deg, var(--accent) 0%, #1e3a8a 100%)` 
      }}>
        {initials}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <ShieldAlert className={styles.titleIcon} size={24} />
          <h1 className={styles.title}>User Management</h1>
        </div>
        <p className={styles.subtitle}>Manage access, roles, and review new registrations</p>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'pending' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingUsers.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Active Users ({activeUsers.length})
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading users...</div>
      ) : displayUsers.length === 0 ? (
        <div className={styles.empty}>
          {activeTab === 'pending' ? <UserCheck size={48} className={styles.emptyIcon} /> : <Users size={48} className={styles.emptyIcon} />}
          <p>{activeTab === 'pending' ? 'No pending registrations' : 'No active users found'}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {displayUsers.map(user => {
            const isMe = currentUser && currentUser.id === user.id;
            
            return (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {getAvatar(user)}
                  </div>
                  <div className={styles.userDetails}>
                    <div className={styles.usernameRow}>
                      <span className={styles.username}>{user.username} {isMe && '(You)'}</span>
                      <span className={`${styles.badge} ${user.role === 'admin' ? styles.adminBadge : styles.userBadge}`}>
                        {user.role}
                      </span>
                    </div>
                    <span className={styles.date}>Registered on {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {user.is_approved === 0 || !user.is_approved ? (
                    <>
                      <button 
                        className={`${styles.actionButton} ${styles.approveButton}`}
                        onClick={() => handleApprove(user.id)}
                        title="Approve User"
                      >
                        <UserCheck size={18} />
                        <span>Approve</span>
                      </button>
                      <button 
                        className={`${styles.actionButton} ${styles.denyButton}`}
                        onClick={() => handleDeny(user.id)}
                        title="Deny User"
                      >
                        <UserX size={18} />
                        <span>Deny</span>
                      </button>
                    </>
                  ) : (
                    <div className={styles.activeActions}>
                      {!isMe && (
                        <>
                          <button 
                            className={`${styles.iconButton} ${user.role === 'admin' ? styles.demoteButton : styles.promoteButton}`}
                            onClick={() => handleToggleRole(user)}
                            title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            {user.role === 'admin' ? <ShieldOff size={18} /> : <Shield size={18} />}
                          </button>
                          <button 
                            className={`${styles.iconButton} ${styles.deleteButton}`}
                            onClick={() => handleDelete(user.id)}
                            title="Remove User"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      {isMe && <span className={styles.statusActive}>Active</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
