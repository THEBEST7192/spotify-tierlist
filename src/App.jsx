import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getAccessToken, getValidAccessToken } from './utils/SpotifyAuth';
import Home from './pages/Home';
import './App.css';

function App() {
  const [accessToken, setAccessToken] = useState(null);
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
              />
            </div>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
