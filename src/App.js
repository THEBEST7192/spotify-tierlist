import React, { useEffect, useState } from "react";
import Home from "./pages/Home";
import { refreshAccessToken, calculateExpiryTime, isTokenExpired } from "./utils/auth";
import "./App.css";

// Spotify client ID (normally would be in .env file)
const SPOTIFY_CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  useEffect(() => {
    // Set document title
    document.title = "Tierlist Maker for Spotify";
    
    // Check the URL hash for the Spotify tokens
    const hash = window.location.hash;
    let token = null;
    let expiry = null;
    let refresh = null;
    
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      token = params.get("access_token");
      const expiresIn = params.get("expires_in");
      refresh = params.get("refresh_token");
      
      if (token && expiresIn) {
        expiry = calculateExpiryTime(parseInt(expiresIn));
      }
      
      window.location.hash = ""; // Clean the URL
    }
    
    // Check if tokens exist in localStorage
    const storedToken = localStorage.getItem('spotify_access_token');
    const storedExpiry = localStorage.getItem('spotify_token_expiry');
    const storedRefresh = localStorage.getItem('spotify_refresh_token');
    
    if (token) {
      // New token from URL hash
      setAccessToken(token);
      setTokenExpiryTime(expiry);
      if (refresh) setRefreshToken(refresh);
      
      // Store tokens
      localStorage.setItem('spotify_access_token', token);
      if (expiry) localStorage.setItem('spotify_token_expiry', expiry.toString());
      if (refresh) localStorage.setItem('spotify_refresh_token', refresh);
    } else if (storedToken) {
      // Use stored token, but check if it's expired
      const expiryTime = storedExpiry ? parseInt(storedExpiry) : null;
      
      if (expiryTime && !isTokenExpired(expiryTime)) {
        // Token still valid
        setAccessToken(storedToken);
        setTokenExpiryTime(expiryTime);
        if (storedRefresh) setRefreshToken(storedRefresh);
      } else if (storedRefresh) {
        // Token expired, refresh it
        refreshTokenAndUpdate(storedRefresh);
      } else {
        // No refresh token, can't refresh
        setAccessToken(storedToken);
      }
    }
  }, []);

  // Set up a timer to refresh the token before it expires
  useEffect(() => {
    if (!tokenExpiryTime || !refreshToken) return;
    
    // Calculate time until we need to refresh (5 minutes before expiry)
    const timeUntilRefresh = tokenExpiryTime - Date.now() - 300000;
    
    // Only set up timer if we need to refresh in the future
    if (timeUntilRefresh <= 0) {
      // Token already expired or about to expire, refresh now
      refreshTokenAndUpdate(refreshToken);
      return;
    }
    
    // Set up timer to refresh token
    const refreshTimer = setTimeout(() => {
      refreshTokenAndUpdate(refreshToken);
    }, timeUntilRefresh);
    
    // Clean up timer
    return () => clearTimeout(refreshTimer);
  }, [tokenExpiryTime, refreshToken]);

  // Function to refresh token and update state/storage
  const refreshTokenAndUpdate = async (refresh) => {
    if (!refresh || !SPOTIFY_CLIENT_ID) return;
    
    try {
      const result = await refreshAccessToken(refresh, SPOTIFY_CLIENT_ID);
      
      // Update state with new tokens
      setAccessToken(result.access_token);
      if (result.refresh_token) setRefreshToken(result.refresh_token);
      
      // Calculate and store new expiry time
      const newExpiryTime = calculateExpiryTime(result.expires_in);
      setTokenExpiryTime(newExpiryTime);
      
      // Update localStorage
      localStorage.setItem('spotify_access_token', result.access_token);
      localStorage.setItem('spotify_token_expiry', newExpiryTime.toString());
      if (result.refresh_token) {
        localStorage.setItem('spotify_refresh_token', result.refresh_token);
      }
      
      console.log('Spotify token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Keep the existing token
    }
  };

  // Handle setting or clearing the access token
  const handleAccessTokenChange = (token, newRefreshToken, expiresIn) => {
    setAccessToken(token);
    
    // If token is null (logout), clear any stored tokens
    if (token === null) {
      // Clear state
      setRefreshToken(null);
      setTokenExpiryTime(null);
      
      // Clear any stored tokens from localStorage
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      localStorage.removeItem('spotify_token_expiry');
      sessionStorage.removeItem('spotify_access_token');
      
      // Clear all cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
    } else {
      // Store the new token
      localStorage.setItem('spotify_access_token', token);
      
      // Handle refresh token if provided
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
        localStorage.setItem('spotify_refresh_token', newRefreshToken);
      }
      
      // Handle expiry time if provided
      if (expiresIn) {
        const expiryTime = calculateExpiryTime(expiresIn);
        setTokenExpiryTime(expiryTime);
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());
      }
    }
  };

  return (
    <div className="App">
      <Home 
        accessToken={accessToken} 
        refreshToken={refreshToken}
        setAccessToken={handleAccessTokenChange} 
      />
    </div>
  );
}

export default App;
