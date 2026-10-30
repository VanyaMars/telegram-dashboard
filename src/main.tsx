import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppProvider} from './AppContext';
import {QASandboxGate} from './qa/QASandboxGate';
import {OSMotionProvider} from './components/OSMotion';
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><OSMotionProvider><QASandboxGate><AppProvider><App/></AppProvider></QASandboxGate></OSMotionProvider></React.StrictMode>);
