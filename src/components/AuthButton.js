import React from "react";
import { getSpotifyAuthURL } from "../utils/SpotifyAuth.js";

const AuthButton = () => {
  const login = () => {
    window.location.href = getSpotifyAuthURL();
  };

  return <button onClick={login}>Login with Spotify</button>;
};

export default AuthButton;
