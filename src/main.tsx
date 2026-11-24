import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppProvider} from './AppContext';
import {QASandboxGate} from './qa/QASandboxGate';
import {BrowserAuthGate} from './components/BrowserAuthGate';
import {OSMotionProvider} from './components/OSMotion';
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><OSMotionProvider><QASandboxGate><BrowserAuthGate><AppProvider><App/></AppProvider></BrowserAuthGate></QASandboxGate></OSMotionProvider></React.StrictMode>);
