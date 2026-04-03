import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserIcon,
  CheckIcon,
  XIcon,
  SquarePenIcon as EditIcon,
  ArrowLeftIcon,
  ActivityIcon,
} from 'lucide-animated';
import { Building2, Phone, TrendingUp, Clock, Mail, Calendar, Shield } from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  async function fetchProfile() {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = isOwnProfile ? '/users/me/profile' : `/users/${userId}/profile`;
      const res = await api.get(endpoint);
      setProfile(res.data.user);
      setStats(res.data.stats || {});
      setCanEdit(res.data.canEdit !== false);
      setFullName(res.data.user.full_name);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return;
    }

    setSaving(true);
    try {
      if (isOwnProfile) {
        await api.patch('/users/me/profile', { full_name: fullName.trim() });
      } else {
        await api.patch(`/users/${userId}`, { full_name: fullName.trim() });
      }
      setProfile({ ...profile, full_name: fullName.trim() });
      setEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'readonly_admin':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'company_admin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'closer':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'fronter':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
    }
  };

  const formatRole = (role) => {
    return role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 animate-pulse space-y-6">
        <div className="h-8 bg-cream-300 dark:bg-dark-700 rounded-xl w-48" />
        <div className="h-64 bg-cream-200 dark:bg-dark-800 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-2xl">
          <XIcon className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isOwnProfile && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-cream-200 dark:bg-dark-700 hover:bg-cream-300 dark:hover:bg-dark-600 rounded-xl transition-all"
            >
              <ArrowLeftIcon size={20} className="text-primary-600 dark:text-primary-400" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent">
              {isOwnProfile ? 'My Profile' : 'User Profile'}
            </h1>
            <p className="text-primary-600/70 dark:text-primary-400/70 mt-1">
              {isOwnProfile ? 'View and manage your account' : `Viewing ${profile?.full_name}'s profile`}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-dark-900/80 rounded-2xl shadow-lg shadow-primary-200/50 dark:shadow-dark-950/50 border border-cream-200/50 dark:border-dark-800/50 overflow-hidden">
        {/* Header with avatar */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-700 dark:to-primary-600 p-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center">
              <UserIcon size={48} className="text-white" />
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-xl font-bold"
                    placeholder="Full Name"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 bg-green-500 hover:bg-green-600 rounded-xl transition-all disabled:opacity-50"
                  >
                    <CheckIcon size={20} className="text-white" />
                  </button>
                  <button
                    onClick={() => { setEditing(false); setFullName(profile.full_name); }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                  >
                    <XIcon size={20} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{profile?.full_name}</h2>
                  {canEdit && (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                    >
                      <EditIcon size={16} className="text-white" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-white/80 mt-1">{profile?.email}</p>
              <span className={cn('inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full', getRoleBadgeColor(profile?.role))}>
                {formatRole(profile?.role)}
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Mail size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-primary-500 dark:text-primary-400">Email</p>
                <p className="font-medium text-primary-800 dark:text-primary-200">{profile?.email}</p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <ShieldIcon size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-primary-500 dark:text-primary-400">Role</p>
                <p className="font-medium text-primary-800 dark:text-primary-200">{formatRole(profile?.role)}</p>
              </div>
            </div>

            {/* Company */}
            {profile?.companies && (
              <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <Building2 size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-primary-500 dark:text-primary-400">Company</p>
                  <p className="font-medium text-primary-800 dark:text-primary-200">{profile.companies.display_name}</p>
                </div>
              </div>
            )}

            {/* Joined */}
            <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Calendar size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-primary-500 dark:text-primary-400">Joined</p>
                <p className="font-medium text-primary-800 dark:text-primary-200">
                  {new Date(profile?.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* 2FA Status */}
            <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                profile?.totp_enabled 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              )}>
                <ShieldIcon size={20} className={profile?.totp_enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
              </div>
              <div>
                <p className="text-xs text-primary-500 dark:text-primary-400">Two-Factor Auth</p>
                <p className={cn(
                  'font-medium',
                  profile?.totp_enabled 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {profile?.totp_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            {/* Last Login */}
            {profile?.last_login && (
              <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
                <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center">
                  <Clock size={20} className="text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-primary-500 dark:text-primary-400">Last Login</p>
                  <p className="font-medium text-primary-800 dark:text-primary-200">
                    {new Date(profile.last_login).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-4 p-4 bg-cream-50 dark:bg-dark-800/50 rounded-xl">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                profile?.is_active 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              )}>
                <ActivityIcon size={20} className={profile?.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
              </div>
              <div>
                <p className="text-xs text-primary-500 dark:text-primary-400">Account Status</p>
                <p className={cn(
                  'font-medium',
                  profile?.is_active 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          {Object.keys(stats).length > 0 && (
            <div className="pt-4 border-t border-cream-200 dark:border-dark-700">
              <h3 className="text-lg font-bold text-primary-800 dark:text-primary-200 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-primary-500" />
                Activity Stats
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {stats.totalTransfers !== undefined && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                      <Phone size={16} />
                      <span className="text-xs font-medium">Total Transfers</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{stats.totalTransfers}</p>
                  </div>
                )}
                {stats.totalOutcomes !== undefined && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                      <ActivityIcon size={16} />
                      <span className="text-xs font-medium">Total Outcomes</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.totalOutcomes}</p>
                  </div>
                )}
                {stats.totalSales !== undefined && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200/50 dark:border-green-700/50">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                      <TrendingUp size={16} />
                      <span className="text-xs font-medium">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.totalSales}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
