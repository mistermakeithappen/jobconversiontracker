'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { postData } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { 
  AlertCircle, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Shield, 
  Bell, 
  Download, 
  Calendar, 
  Clock, 
  Settings, 
  Edit3, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  Camera,
  Check,
  Smartphone,
  Globe,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Editing states
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Form data
  const [profileData, setProfileData] = useState({
    full_name: '',
    display_name: '',
    phone: '',
    avatar_url: ''
  });
  const [emailData, setEmailData] = useState({ new_email: '' });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Account info
  const [accountInfo, setAccountInfo] = useState({
    created_at: null as string | null,
    last_sign_in_at: null as string | null,
    email_confirmed_at: null as string | null,
    phone_confirmed_at: null as string | null
  });
  
  // Notification preferences
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    marketing_emails: false,
    security_alerts: true,
    product_updates: true
  });
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.user_metadata?.full_name || '',
        display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || '',
        phone: user.phone || '',
        avatar_url: user.user_metadata?.avatar_url || ''
      });
      
      setAccountInfo({
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        phone_confirmed_at: user.phone_confirmed_at || null
      });
      
      // Load notification preferences from user metadata
      const savedNotifications = user.user_metadata?.notification_preferences;
      if (savedNotifications) {
        setNotifications(savedNotifications);
      }
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url
        },
        phone: profileData.phone
      });
      
      if (error) throw error;
      
      setSuccess('Profile updated successfully!');
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        email: emailData.new_email
      });
      
      if (error) throw error;
      
      setSuccess('Email update initiated! Please check your new email for confirmation.');
      setEditingEmail(false);
      setEmailData({ new_email: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      });
      
      if (error) throw error;
      
      setSuccess('Password changed successfully!');
      setChangingPassword(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotifications = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          notification_preferences: notifications
        }
      });
      
      if (error) throw error;
      
      setSuccess('Notification preferences updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notifications');
    } finally {
      setLoading(false);
    }
  };

  const exportUserData = async () => {
    try {
      const userData = {
        email: user?.email,
        created_at: user?.created_at,
        user_metadata: user?.user_metadata,
        app_metadata: user?.app_metadata,
        last_sign_in_at: user?.last_sign_in_at
      };
      
      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('User data exported successfully!');
    } catch (err) {
      setError('Failed to export user data');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const redirectToCustomerPortal = async () => {
    try {
      const response = await fetch('/api/auth/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redirect to customer portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to customer portal');
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'account', label: 'Account Info', icon: Settings },
    { id: 'billing', label: 'Billing', icon: RefreshCw },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 border border-blue-200">
        <div className="flex items-center space-x-6">
          <div className="relative">
            {profileData.avatar_url ? (
              <img
                src={profileData.avatar_url}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                {getInitials(profileData.display_name || profileData.full_name || 'U')}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profileData.display_name || profileData.full_name || 'Welcome'}
            </h1>
            <p className="text-lg text-gray-600">{user?.email}</p>
            <div className="flex items-center space-x-4 mt-2">
              {user?.email_confirmed_at ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Check className="w-3 h-3 mr-1" />
                  Email Verified
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Email Unverified
                </span>
              )}
              <span className="text-sm text-gray-500">
                Member since {formatDate(accountInfo.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Profile Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-gray-900 py-2">{profileData.full_name || 'Not set'}</p>
                        <button
                          onClick={() => setEditingProfile(true)}
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileData.display_name}
                        onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="How you'd like to be called"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{profileData.display_name || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    {editingProfile ? (
                      <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    ) : (
                      <div className="flex items-center space-x-2">
                        <p className="text-gray-900 py-2">{profileData.phone || 'Not set'}</p>
                        {accountInfo.phone_confirmed_at ? (
                          <div className="relative group">
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Phone verified
                            </span>
                          </div>
                        ) : profileData.phone ? (
                          <div className="relative group">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Phone not verified
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar URL
                    </label>
                    {editingProfile ? (
                      <input
                        type="url"
                        value={profileData.avatar_url}
                        onChange={(e) => setProfileData({ ...profileData, avatar_url: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/avatar.jpg"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{profileData.avatar_url || 'Using default avatar'}</p>
                    )}
                  </div>
                </div>

                {editingProfile && (
                  <div className="flex space-x-3 mt-6">
                    <Button
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </h2>

                {/* Email Section */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <Mail className="w-5 h-5 mr-2" />
                        Email Address
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Your primary email address for account access and notifications
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingEmail(true)}
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Change</span>
                    </button>
                  </div>

                  {editingEmail ? (
        <div className="space-y-4">
          <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Email
                        </label>
                        <p className="text-gray-900 font-medium">{user?.email}</p>
          </div>
          <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Email Address
                        </label>
                        <input
                          type="email"
                          value={emailData.new_email}
                          onChange={(e) => setEmailData({ new_email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="new@example.com"
                        />
                      </div>
                      <div className="flex space-x-3">
                        <Button
                          onClick={handleUpdateEmail}
                          disabled={loading || !emailData.new_email}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {loading ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Update Email
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingEmail(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <p className="text-gray-900 font-medium">{user?.email}</p>
                      {user?.email_confirmed_at ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Unverified
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Password Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <Lock className="w-5 h-5 mr-2" />
                        Password
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Keep your account secure with a strong password
                      </p>
                    </div>
                    <button
                      onClick={() => setChangingPassword(true)}
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Change Password</span>
                    </button>
                  </div>

                  {changingPassword && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordData.new_password}
                            onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showNewPassword ? (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordData.confirm_password}
                            onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <Button
                          onClick={handleChangePassword}
                          disabled={loading || !passwordData.new_password || !passwordData.confirm_password}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {loading ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Change Password
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setChangingPassword(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Preferences
                </h2>

                <div className="space-y-4">
                  {[
                    { key: 'email_notifications', label: 'Email Notifications', description: 'Receive important updates via email' },
                    { key: 'marketing_emails', label: 'Marketing Emails', description: 'Get news about product updates and features' },
                    { key: 'security_alerts', label: 'Security Alerts', description: 'Important security notifications' },
                    { key: 'product_updates', label: 'Product Updates', description: 'Learn about new features and improvements' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          setNotifications({
                            ...notifications,
                            [item.key]: !notifications[item.key as keyof typeof notifications]
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifications[item.key as keyof typeof notifications]
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notifications[item.key as keyof typeof notifications]
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <Button
                    onClick={handleUpdateNotifications}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Preferences
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Account Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-900">Account Created</h3>
                    </div>
                    <p className="text-gray-700">{formatDate(accountInfo.created_at)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-900">Last Sign In</h3>
                    </div>
                    <p className="text-gray-700">{formatDate(accountInfo.last_sign_in_at)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Mail className="w-5 h-5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-900">Email Confirmed</h3>
                    </div>
                    <p className="text-gray-700">{formatDate(accountInfo.email_confirmed_at)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Smartphone className="w-5 h-5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-900">Phone Confirmed</h3>
                    </div>
                    <p className="text-gray-700">{formatDate(accountInfo.phone_confirmed_at)}</p>
          </div>
        </div>
        
        <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data & Privacy</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-4 border border-gray-200 rounded-lg px-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Export Your Data</h4>
                        <p className="text-sm text-gray-500">Download a copy of your account data</p>
                      </div>
                      <Button
                        onClick={exportUserData}
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Billing & Subscription
                </h2>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Customer Portal</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Manage your subscription, billing information, and payment methods
                      </p>
                    </div>
                    <Button
                      onClick={redirectToCustomerPortal}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Open Portal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-900 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Danger Zone
          </h2>
          <p className="text-sm text-red-700 mt-1">
            Irreversible and destructive actions
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Delete Account</h3>
              <p className="text-sm text-gray-500">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full">
            <h2 className="text-xl font-bold text-gray-900">Are you sure?</h2>
            <p className="mt-2 text-gray-600">
              This action is permanent and cannot be undone. All your data will be
              deleted.
            </p>
            <div className="mt-6">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Please enter your password to confirm
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            {error && (
              <div className="mt-4 flex items-center text-red-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!password}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
