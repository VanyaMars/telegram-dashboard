import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppProvider} from './AppContext';
import {OSMotionProvider} from './components/OSMotion';
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><OSMotionProvider><AppProvider><App/></AppProvider></OSMotionProvider></React.StrictMode>);
