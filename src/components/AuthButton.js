import React from "react";
import { getSpotifyAuthURL } from "../utils/SpotifyAuth.js";
import "./AuthButton.css";

const AuthButton = () => {
  const login = () => {
    window.location.href = getSpotifyAuthURL();
  };

  return (
    <button onClick={login} className="auth-button">
      LOGIN WITH SPOTIFY
    </button>
  );
};

export default AuthButton;
