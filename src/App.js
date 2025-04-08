import React, { useEffect, useState } from "react";
import Home from "./pages/Home";
import "./App.css";

function App() {
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    // Set document title
    document.title = "Tierlist Maker for Spotify";
    
    // Check the URL hash for the Spotify token
    const hash = window.location.hash;
    let token = null;
    if (hash) {
      token = new URLSearchParams(hash.substring(1)).get("access_token");
      window.location.hash = ""; // Clean the URL
    }
    
    // Check if token exists in localStorage
    const storedToken = localStorage.getItem('spotify_access_token');
    
    if (token) {
      // New token from URL hash
      setAccessToken(token);
      localStorage.setItem('spotify_access_token', token);
    } else if (storedToken) {
      // Use stored token
      setAccessToken(storedToken);
    }
  }, []);

  // Handle setting or clearing the access token
  const handleAccessTokenChange = (token) => {
    setAccessToken(token);
    
    // If token is null (logout), clear any stored tokens
    if (token === null) {
      // Clear any stored tokens from localStorage if they exist
      localStorage.removeItem('spotify_access_token');
      sessionStorage.removeItem('spotify_access_token');
      
      // Clear all cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
    } else {
      // Store the new token
      localStorage.setItem('spotify_access_token', token);
    }
  };

  return (
    <div className="App">
      <Home accessToken={accessToken} setAccessToken={handleAccessTokenChange} />
    </div>
  );
}

export default App;
