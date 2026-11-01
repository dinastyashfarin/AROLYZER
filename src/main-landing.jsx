import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import './landing/landing.css';
import Landing from './landing/Landing.jsx';

// No StrictMode: the page sets up WebGL viewers and scroll observers once on mount.
createRoot(document.getElementById('root')).render(<Landing />);
