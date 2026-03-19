import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import BackButton from './buttons/BackButton';
import LoginButton from './buttons/LoginButton';
import LogoutButton from './buttons/LogoutButton';
import UserSettings from './UserSettings';
import './Header.css';

const Header = ({ tuneTierUser, onLogout, onBack }) => {
  const [headerText, setHeaderText] = useState(
    window.innerWidth <= 768 ? 'TuneTier' : 'TuneTier a Tierlist Maker for Spotify'
  );
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [iconsLoaded, setIconsLoaded] = useState(false);
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

  // Load Material Icons only when user is logged in
  useEffect(() => {
    if (tuneTierUser && !iconsLoaded) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=settings';
      document.head.appendChild(link);
      setIconsLoaded(true);
    }
  }, [tuneTierUser, iconsLoaded]);

  const isLoginPage = location.pathname === '/login';

  const handleUserUpdate = (updatedUser) => {
    // This will be handled by the parent component (App.js)
    if (window.onUserUpdate) {
      window.onUserUpdate(updatedUser);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-title">
          <img src="/logo.png" alt="Logo" className="app-header-logo" />
          <h1>{headerText}</h1>
        </div>
        <div className="header-controls">
          {tuneTierUser ? (
            <>
              <button 
                className="settings-button" 
                onClick={() => setShowUserSettings(true)}
                title="Account Settings"
              >
                {iconsLoaded ? (
                  <span className="material-symbols-outlined">settings</span>
                ) : (
                  '⚙️'
                )}
              </button>
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
      
      {showUserSettings && (
        <UserSettings
          tuneTierUser={tuneTierUser}
          onUserUpdate={handleUserUpdate}
          onClose={() => setShowUserSettings(false)}
          onLogout={onLogout}
        />
      )}
    </>
  );
};

export default Header;
