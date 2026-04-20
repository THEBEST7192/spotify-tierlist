import React, { useCallback, useState, useRef } from 'react';
import { loginUser, registerUser, setStoredAuthToken, sendTwoFactorCode } from '../utils/backendApi';
import './TuneTierAuthPanel.css';

const TuneTierAuthPanel = ({ setAuthToken, tuneTierUser, setTuneTierUser }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const passwordInputRef = useRef(null);

  // 2FA state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSentMessage, setCodeSentMessage] = useState('');
  const twoFactorInputRef = useRef(null);


  const submit = useCallback(async () => {
    setError('');
    setCodeSentMessage('');
    try {
      if (mode === 'login' && requiresTwoFactor) {
        // Login with 2FA code
        const payload = { username, password, twoFactorCode };
        const data = await loginUser(payload);
        const token = data?.token;
        const user = data?.user;
        if (!token || !user) {
          throw new Error('Invalid auth response');
        }
        setStoredAuthToken(token);
        setAuthToken(token);
        setTuneTierUser(user);
        setPassword('');
        setTwoFactorCode('');
        setRequiresTwoFactor(false);
      } else {
        // Normal login or register
        const payload = { username, password };
        const data = mode === 'register' ? await registerUser(payload) : await loginUser(payload);

        // Check if 2FA is required
        if (data?.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setError('');
          setCodeSentMessage('Two-factor authentication required. A code has been sent to your email.');
          // Focus on 2FA input
          setTimeout(() => {
            if (twoFactorInputRef.current) {
              twoFactorInputRef.current.focus();
            }
          }, 100);
          return;
        }

        const token = data?.token;
        const user = data?.user;
        if (!token || !user) {
          throw new Error('Invalid auth response');
        }
        setStoredAuthToken(token);
        setAuthToken(token);
        setTuneTierUser(user);
        setPassword('');
      }
    } catch (err) {
      // Check if this is a 2FA requirement response
      if (err?.response?.data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setCodeSentMessage('Two-factor authentication required. A code has been sent to your email.');
        // Focus on 2FA input
        setTimeout(() => {
          if (twoFactorInputRef.current) {
            twoFactorInputRef.current.focus();
          }
        }, 100);
        return;
      }
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to authenticate';
      setError(errorMessage);
    }
  }, [mode, password, setAuthToken, setTuneTierUser, username, requiresTwoFactor, twoFactorCode]);

  const logout = useCallback(() => {
    setStoredAuthToken(null);
    setAuthToken(null);
    setTuneTierUser(null);
  }, [setAuthToken, setTuneTierUser]);

  const handleResendCode = useCallback(async () => {
    setError('');
    setCodeSentMessage('');
    setIsSendingCode(true);
    try {
      await sendTwoFactorCode({ username });
      setCodeSentMessage('New code sent to your email');
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to send code';
      setError(errorMessage);
    } finally {
      setIsSendingCode(false);
    }
  }, [username]);

  const handleCancelTwoFactor = useCallback(() => {
    setRequiresTwoFactor(false);
    setTwoFactorCode('');
    setError('');
    setCodeSentMessage('');
  }, []);

  const handleKeyDown = useCallback((e, inputType) => {
    if (e.key === 'Enter') {
      if (inputType === 'username') {
        // Focus password input when Enter is pressed on username
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      } else if (inputType === 'password') {
        // Submit when Enter is pressed on password
        submit();
      } else if (inputType === 'twoFactor') {
        // Submit when Enter is pressed on 2FA code
        submit();
      }
    }
  }, [submit]);

  return (
    <div className="tune-tier-auth-panel">
      {tuneTierUser ? (
        <div className="auth-user-info">
          <div className="auth-welcome">Signed in as <strong>{tuneTierUser.username}</strong></div>
          <button onClick={logout} className="auth-button auth-button-secondary">Logout</button>
        </div>
      ) : (
        <div className="auth-form">
          <div className="auth-mode-toggle">
            <button 
              onClick={() => setMode('login')} 
              className={`auth-mode-button ${mode === 'login' ? 'active' : ''}`}
            >
              Login
            </button>
            <button 
              onClick={() => setMode('register')} 
              className={`auth-mode-button ${mode === 'register' ? 'active' : ''}`}
            >
              Create Account
            </button>
          </div>
          <div className="auth-inputs">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="auth-input"
              onKeyDown={(e) => handleKeyDown(e, 'username')}
              disabled={requiresTwoFactor}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="auth-input"
              ref={passwordInputRef}
              onKeyDown={(e) => handleKeyDown(e, 'password')}
              disabled={requiresTwoFactor}
            />
            {requiresTwoFactor && (
              <input
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="Enter 6-digit code"
                type="text"
                className="auth-input"
                ref={twoFactorInputRef}
                onKeyDown={(e) => handleKeyDown(e, 'twoFactor')}
                maxLength={6}
              />
            )}
          </div>
          {requiresTwoFactor && (
            <div className="auth-2fa-actions">
              <button 
                onClick={handleResendCode} 
                className="auth-button auth-button-secondary auth-button-small"
                disabled={isSendingCode}
              >
                {isSendingCode ? 'Sending...' : 'Resend Code'}
              </button>
              <button 
                onClick={handleCancelTwoFactor} 
                className="auth-button auth-button-secondary auth-button-small"
              >
                Cancel
              </button>
            </div>
          )}
          <button onClick={submit} className="auth-button auth-button-primary auth-submit-button">
            {requiresTwoFactor ? 'Verify & Login' : (mode === 'register' ? 'Create Account' : 'Login')}
          </button>
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
      {codeSentMessage && <div className="auth-success">{codeSentMessage}</div>}
    </div>
  );
};

export default TuneTierAuthPanel;
