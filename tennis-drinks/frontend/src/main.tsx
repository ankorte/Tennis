import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Bei Versionswechsel: alten Service Worker + Cache aufräumen
const STORED_VERSION_KEY = 'bruvi-app-version'
const storedVersion = localStorage.getItem(STORED_VERSION_KEY)
if (storedVersion && storedVersion !== __APP_VERSION__) {
  console.log(`Version gewechselt: ${storedVersion} → ${__APP_VERSION__}, Cache wird geleert`)
  // Alten SW deregistrieren + Caches leeren
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister())
    })
  }
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
  }
}
localStorage.setItem(STORED_VERSION_KEY, __APP_VERSION__)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
