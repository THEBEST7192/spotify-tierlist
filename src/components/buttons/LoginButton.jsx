import React from "react";
import "./LoginButton.css";

const LoginButton = ({ onClick }) => {
  return (
    <button onClick={onClick} className="login-button">
      LOGIN
    </button>
  );
};

export default LoginButton;
