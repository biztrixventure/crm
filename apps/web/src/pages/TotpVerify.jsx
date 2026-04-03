import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Loader2, Shield } from 'lucide-react';

export default function TotpVerify() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const { verifyTotp, isLoading, error, clearError, intermediateToken } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if no intermediate token
  useEffect(() => {
    if (!intermediateToken) {
      navigate('/login');
    }
  }, [intermediateToken, navigate]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleSubmit(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    
    setCode(newCode);
    
    if (pasted.length === 6) {
      handleSubmit(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleSubmit = async (codeString) => {
    clearError();
    const fullCode = codeString || code.join('');
    
    if (fullCode.length !== 6) return;

    const result = await verifyTotp(fullCode);

    if (result.success) {
      navigate('/');
    } else {
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary-100 dark:bg-primary-900/50 mb-4">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Code input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-3 mb-8">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-14 text-center text-2xl font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                disabled={isLoading}
              />
            ))}
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || code.join('').length !== 6}
            className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full mt-4 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
