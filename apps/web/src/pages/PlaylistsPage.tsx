import type { FC } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const PlaylistsPage: FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the edit playlists page
    navigate('/playlists/edit', { replace: true });
  }, [navigate]);

  return null;
};
