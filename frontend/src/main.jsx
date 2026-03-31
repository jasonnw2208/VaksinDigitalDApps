import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Removing PrivyProvider for now as the App ID is invalid.
// Using a Custom Login (Simulasi) inside App.jsx for the presentation.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
