import React, { useEffect } from "react";
import { getSpotifyAuthURL, getAccessToken } from "../utils/SpotifyAuth.js";
import "./AuthButton.css";

const AuthButton = () => {
  useEffect(() => {
    // Check for the authorization code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      // Exchange the code for tokens
      getAccessToken(code)
        .then(data => {
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          // Reload the page to use the new tokens
          window.location.reload();
        })
        .catch(error => {
          console.error('Error exchanging code for tokens:', error);
        });
    }
  }, []);

  const login = async () => {
    const authUrl = await getSpotifyAuthURL();
    window.location.href = authUrl;
  };

  return (
    <button onClick={login} className="auth-button">
      LOGIN WITH SPOTIFY
    </button>
  );
};

export default AuthButton;
