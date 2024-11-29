import React, { useState } from 'react';
import axios from 'axios';

const Auth = () => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:3000/webauthn/initiate-registration', { username });
      console.log("response", response.data)
      const options = response.data;

      console.log("Registration options:", options);

      // If you need to use these options for WebAuthn, you can implement that logic here
      alert('Registration successful');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Error during registration');
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:3001/webauthn/login', { username });
      const options = response.data;

      console.log("Login options:", options);
      const assertion = await navigator.credentials.get({ publicKey: options });

      await axios.post('http://localhost:3001/webauthn/validate-login', {
        username,
        credential: assertion,
      });

      alert('Login successful');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Error during login');
    }
  };

  return (
    <div>
      <h1>WebAuthn with Keycloak</h1>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <button onClick={handleRegister}>Register Passkey</button>
      <button onClick={handleLogin}>Login</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default Auth;