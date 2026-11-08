import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './site/site.css';
import { Site } from './site/Site';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
