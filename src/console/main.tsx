import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './console.css';
import { ConsoleApp } from './ConsoleApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/console">
      <ConsoleApp />
    </BrowserRouter>
  </StrictMode>,
);
