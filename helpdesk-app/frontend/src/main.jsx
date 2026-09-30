import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthBootstrap } from './app/AuthBootstrap.jsx';
import { Providers } from './app/providers.jsx';
import { createAppRouter } from './app/router.jsx';
import './styles/global.css';

const router = createAppRouter();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </Providers>
  </StrictMode>,
);
