import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initLogger } from './utils/logger'

// Diagnostic logging (no-op unless ?debug=1). Must run before the app mounts.
initLogger()

const root = createRoot(document.getElementById('root'))

// Dev-only audio pipeline harness: open the app with ?dev=audio.
// Dynamically imported so the test harness + dataset never ship in the normal bundle.
if (new URLSearchParams(window.location.search).get('dev') === 'audio') {
  import('./dev/AudioHarness.jsx').then(({ AudioHarness }) => {
    root.render(createElement(StrictMode, null, createElement(AudioHarness)))
  })
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
