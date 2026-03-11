import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import BackButton from './buttons/BackButton';
import LoginButton from './buttons/LoginButton';
import LogoutButton from './buttons/LogoutButton';
import './Header.css';

const Header = ({ tuneTierUser, onLogout, onBack }) => {
  const [headerText, setHeaderText] = useState(
    window.innerWidth <= 768 ? 'TuneTier' : 'TuneTier a Tierlist Maker for Spotify'
  );
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      setHeaderText(
        window.innerWidth <= 768 ? 'TuneTier' : 'TuneTier a Tierlist Maker for Spotify'
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLoginPage = location.pathname === '/login';

  return (
    <header className="app-header">
      <div className="header-title">
        <img src="/logo.png" alt="Logo" className="app-header-logo" />
        <h1>{headerText}</h1>
      </div>
      <div className="header-controls">
        {tuneTierUser ? (
          <>
            <div className="user-profile">
              <div className="user-avatar-placeholder">
                {tuneTierUser.username ? tuneTierUser.username.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="user-name">{tuneTierUser.username}</span>
            </div>
            <LogoutButton onClick={onLogout} />
          </>
        ) : isLoginPage ? (
          <BackButton onClick={onBack} />
        ) : (
          <LoginButton onClick={onBack} />
        )}
      </div>
    </header>
  );
};

export default Header;
