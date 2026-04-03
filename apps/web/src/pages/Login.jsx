import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { EyeIcon, EyeOffIcon, SparklesIcon } from 'lucide-animated';
import { Building2, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    const result = await login(email, password);

    if (result.totpRequired) {
      navigate('/totp-verify');
    } else if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 via-cream-200 to-cream-300 dark:from-dark-950 dark:via-dark-900 dark:to-dark-800 px-4 transition-colors duration-300">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-300/30 dark:bg-primary-600/10 rounded-full blur-3xl transition-colors" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-300/20 dark:bg-accent-600/10 rounded-full blur-3xl transition-colors" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-600 dark:to-primary-800 mb-4 shadow-lg shadow-primary-400/30 dark:shadow-primary-800/30 transition-all">
            <Building2 className="w-10 h-10 text-white animate-pulse-slow" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent">
            BizTrixVenture
          </h1>
          <p className="text-primary-600/80 dark:text-primary-400/80 mt-2 flex items-center justify-center gap-2">
            <SparklesIcon size={16} />
            Customer Relationship Management
            <SparklesIcon size={16} />
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-primary-400/10 dark:shadow-primary-900/20 p-8 border border-cream-300/50 dark:border-dark-800/50 transition-colors">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100 placeholder-primary-400/60 dark:placeholder-primary-600/60 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-dark-800 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100 placeholder-primary-400/60 dark:placeholder-primary-600/60 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-dark-800 transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeOffIcon size={20} />
                  ) : (
                    <EyeIcon size={20} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3.5 bg-gradient-to-r from-primary-500 to-primary-400 hover:from-primary-600 hover:to-primary-500 disabled:from-primary-300 disabled:to-primary-200 dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-500 dark:hover:to-primary-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-400/30 dark:shadow-primary-900/30 hover:shadow-xl hover:shadow-primary-400/40 dark:hover:shadow-primary-900/40 transform hover:-translate-y-0.5 active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-primary-500/70 dark:text-primary-400/70 mt-6">
          BizTrixVenture CRM v1.0
        </p>
      </div>
    </div>
  );
}
