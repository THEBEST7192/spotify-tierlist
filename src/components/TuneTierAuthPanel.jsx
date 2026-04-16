import React, { useCallback, useState } from 'react';
import { loginUser, registerUser, setStoredAuthToken } from '../utils/backendApi';
import './TuneTierAuthPanel.css';

const TuneTierAuthPanel = ({ setAuthToken, tuneTierUser, setTuneTierUser }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');


  const submit = useCallback(async () => {
    setError('');
    try {
      const payload = { username, password };
      const data = mode === 'register' ? await registerUser(payload) : await loginUser(payload);
      const token = data?.token;
      const user = data?.user;
      if (!token || !user) {
        throw new Error('Invalid auth response');
      }
      setStoredAuthToken(token);
      setAuthToken(token);
      setTuneTierUser(user);
      setPassword('');
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to authenticate';
      setError(errorMessage);
    }
  }, [mode, password, setAuthToken, setTuneTierUser, username]);

  const logout = useCallback(() => {
    setStoredAuthToken(null);
    setAuthToken(null);
    setTuneTierUser(null);
  }, [setAuthToken, setTuneTierUser]);

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
            />
            <input 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Password" 
              type="password" 
              className="auth-input"
            />
          </div>
          <button onClick={submit} className="auth-button auth-button-primary">
            {mode === 'register' ? 'Create Account' : 'Login'}
          </button>
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
};

export default TuneTierAuthPanel;
