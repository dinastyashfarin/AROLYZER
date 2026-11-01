import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import './admin/admin.css';
import App from './admin/App.jsx';

createRoot(document.getElementById('root')).render(<App />);
