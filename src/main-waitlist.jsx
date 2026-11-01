import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import './waitlist/waitlist.css';
import Waitlist from './waitlist/Waitlist.jsx';

createRoot(document.getElementById('root')).render(<Waitlist />);
