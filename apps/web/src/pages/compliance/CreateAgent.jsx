import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Mail, Lock, User, ArrowLeft } from 'lucide-react';

export default function CreateAgent() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  function validateForm() {
    const newErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreateAgent(e) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/users', {
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        role: 'compliance_agent',
        // company_id is null/not included (BizTrix-internal only)
      });

      if (response.data.user) {
        toast.success(`Compliance agent "${formData.full_name}" created successfully`);
        navigate('/compliance');
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
      const message = error.response?.data?.error || 'Failed to create compliance agent';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/compliance')}
          className="p-2 hover:bg-cream-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">
            Create Compliance Agent
          </h2>
          <p className="text-primary-600 dark:text-primary-400 text-sm mt-1">
            Add a new compliance agent to your team
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-8 border border-cream-200/50 dark:border-dark-700/50 max-w-2xl">
        <form onSubmit={handleCreateAgent} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name *
              </div>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => {
                setFormData({ ...formData, full_name: e.target.value });
                if (errors.full_name) setErrors({ ...errors, full_name: '' });
              }}
              placeholder="John Doe"
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.full_name
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-cream-300 dark:border-dark-600'
              } bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
            />
            {errors.full_name && (
              <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email *
              </div>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="agent@example.com"
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.email
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-cream-300 dark:border-dark-600'
              } bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password (8+ characters) *
              </div>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              placeholder="••••••••"
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.password
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-cream-300 dark:border-dark-600'
              } bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirm Password *
              </div>
            </label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) => {
                setFormData({ ...formData, confirm_password: e.target.value });
                if (errors.confirm_password) setErrors({ ...errors, confirm_password: '' });
              }}
              placeholder="••••••••"
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.confirm_password
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-cream-300 dark:border-dark-600'
              } bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
            />
            {errors.confirm_password && (
              <p className="text-red-500 text-sm mt-1">{errors.confirm_password}</p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mt-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> The agent will receive a password reset email and can set their own password on first login.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
            >
              {submitting ? 'Creating...' : 'Create Agent'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/compliance')}
              className="px-6 py-2 bg-cream-200 dark:bg-dark-700 text-primary-900 dark:text-primary-100 rounded-lg transition-colors hover:bg-cream-300 dark:hover:bg-dark-600 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
