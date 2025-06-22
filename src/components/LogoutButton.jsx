import React from "react";
import "./LogoutButton.css";

const LogoutButton = ({ onLogout }) => {
  const handleLogout = () => {
    // Clear the access token
    onLogout();
  };

  return (
    <button onClick={handleLogout} className="logout-button">
      LOGOUT
    </button>
  );
};

export default LogoutButton; 