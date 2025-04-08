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
    if (token) {
      setAccessToken(token);
    }
  }, []);

  // Handle setting or clearing the access token
  const handleAccessTokenChange = (token) => {
    setAccessToken(token);
    
    // If token is null (logout), clear any stored tokens
    if (token === null) {
      // Clear any stored tokens from localStorage if they exist
      localStorage.removeItem('spotify_access_token');
    }
  };

  return (
    <div className="App">
      <Home accessToken={accessToken} setAccessToken={handleAccessTokenChange} />
    </div>
  );
}

export default App;
