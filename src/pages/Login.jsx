import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TuneTierAuthPanel from '../components/TuneTierAuthPanel';
import Header from '../components/Header';
import './Login.css';

const Login = ({ setAuthToken, tuneTierUser, setTuneTierUser }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleLogout = () => {
    // Clear all cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Reset state
    setAuthToken(null);
    setTuneTierUser(null);
  };

  // Navigate back to home when user successfully logs in
  useEffect(() => {
    if (tuneTierUser) {
      navigate('/');
    }
  }, [tuneTierUser, navigate]);

  return (
    <div className="home-container">
      <Header 
        tuneTierUser={tuneTierUser} 
        onLogout={handleLogout} 
        onBack={handleBack} 
      />
      <div className="login-container">
        <div className="login-content">
          <h2>Login / Create Account</h2>
          <TuneTierAuthPanel
            setAuthToken={setAuthToken}
            tuneTierUser={tuneTierUser}
            setTuneTierUser={setTuneTierUser}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
