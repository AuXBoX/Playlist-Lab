import type { FC } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthCallbackPage: FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Plex redirects back here after authorization
    // The PIN info is in sessionStorage, so just redirect to login
    // The login page will detect it and complete the auth
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Completing authentication...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Please wait</p>
      </div>
    </div>
  );
};
