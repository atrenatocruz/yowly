import { createRoot } from 'react-dom/client'
import App from './App'
import Pill from './Pill'
import './styles.css'

const isPill = location.hash === '#pill'
if (isPill) document.documentElement.classList.add('pill-root')
createRoot(document.getElementById('root')!).render(isPill ? <Pill /> : <App />)
