import React from 'react';
import './LogoutButton.css';

const LogoutButton = ({ onClick }) => {
  return (
    <button onClick={onClick} className="logout-button">
      LOGOUT
    </button>
  );
};

export default LogoutButton;
