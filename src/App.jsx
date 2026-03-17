import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getAccessToken, getValidAccessToken } from './utils/SpotifyAuth';
import { getStoredAuthToken, setStoredAuthToken, getMe } from './utils/backendApi';
import Home from './pages/Home';
import Login from './pages/Login';
import './App.css';

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [authToken, setAuthToken] = useState(() => getStoredAuthToken());
  const [tuneTierUser, setTuneTierUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for the authorization code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    const initializeAuth = async () => {
      try {
        if (code) {
          // Exchange code for tokens
          const data = await getAccessToken(code);
          setAccessToken(data.access_token);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // Try to get a valid token from storage
          const token = await getValidAccessToken();
          setAccessToken(token);
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      if (!authToken) {
        if (!cancelled) setTuneTierUser(null);
        return;
      }
      try {
        setStoredAuthToken(authToken);
        const data = await getMe();
        if (!cancelled) setTuneTierUser(data?.user || null);
      } catch {
        setStoredAuthToken(null);
        if (!cancelled) {
          setAuthToken(null);
          setTuneTierUser(null);
        }
      }
    };
    loadMe();
    return () => { cancelled = true; };
  }, [authToken]);

  // Handle user updates from UserSettings
  useEffect(() => {
    window.onUserUpdate = (updatedUser) => {
      setTuneTierUser(updatedUser);
    };
    
    return () => {
      window.onUserUpdate = null;
    };
  }, []);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <div className="App">
              <Home
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                authToken={authToken}
                setAuthToken={setAuthToken}
                tuneTierUser={tuneTierUser}
                setTuneTierUser={setTuneTierUser}
              />
            </div>
          )}
        />
        <Route
          path="/login"
          element={(
            <div className="App">
              <Login
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                authToken={authToken}
                setAuthToken={setAuthToken}
                tuneTierUser={tuneTierUser}
                setTuneTierUser={setTuneTierUser}
              />
            </div>
          )}
        />
        <Route
          path="/local/:songId"
          element={(
            <div className="App">
              <Home
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                authToken={authToken}
                setAuthToken={setAuthToken}
                tuneTierUser={tuneTierUser}
                setTuneTierUser={setTuneTierUser}
              />
            </div>
          )}
        />
        <Route
          path="/tierlists/:shortId"
          element={(
            <div className="App">
              <Home
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                authToken={authToken}
                setAuthToken={setAuthToken}
                tuneTierUser={tuneTierUser}
                setTuneTierUser={setTuneTierUser}
              />
            </div>
          )}
        />
        <Route
          path="*"
          element={(
            <div className="App">
              <Home
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                authToken={authToken}
                setAuthToken={setAuthToken}
                tuneTierUser={tuneTierUser}
                setTuneTierUser={setTuneTierUser}
              />
            </div>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
