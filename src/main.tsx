/**
 * Browser entry point: mounts the app inside the query client, the auth and
 * theme providers, and the toast host.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Fonts ship with the app rather than coming from Google's CDN: LifeBook's claim
// is that nothing leaves the machine you run it on, and a stylesheet fetched per
// page load quietly broke that. They are imported here rather than from
// index.css because Tailwind v4 inlines a CSS @import without rewriting the
// relative font URLs inside it, which leaves the woff2 files out of the build.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/inter/opsz-italic.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
