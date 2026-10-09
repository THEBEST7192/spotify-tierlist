import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getStoredAuthToken, setStoredAuthToken, getMe } from './utils/backendApi';
import Home from './pages/Home';
import Login from './pages/Login';
import './App.css';

function App() {
  const accessToken = null;
  const [authToken, setAuthToken] = useState(() => getStoredAuthToken());
  const [tuneTierUser, setTuneTierUser] = useState(null);

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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <div className="App">
              <Home
                accessToken={accessToken}
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
