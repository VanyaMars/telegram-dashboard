import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { initData } from '../lib/telegram';
import { isQAMode } from '../qa/sandbox';
import { finishBrowserLogin, hasLoginCallback, startBrowserLogin } from '../lib/browserLogin';
import { browserSessionEnded, endBrowserSession, readBrowserSession } from '../lib/browserSession';
import './browser-auth.css';

export function BrowserAuthGate({ children }: { children: ReactNode }) {
  const demo = new URLSearchParams(window.location.search).get('demo') === '1';
  if (initData() || isQAMode() || demo) return <>{children}</>;
  return <BrowserEntry>{children}</BrowserEntry>;
}

function BrowserEntry({ children }: { children: ReactNode }) {
  const [completing, setCompleting] = useState(hasLoginCallback);
  const [session, setSession] = useState(readBrowserSession);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const exchange = useRef<ReturnType<typeof finishBrowserLogin> | null>(null);

  useEffect(() => {
    if (!completing) return;
    let active = true;
    exchange.current ??= finishBrowserLogin();
    void exchange.current.then(next => { if (active) setSession(next); }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Не удалось войти.');
    }).finally(() => { if (active) setCompleting(false); });
    return () => { active = false; };
  }, [completing]);

  useEffect(() => {
    const onEnd = (event: Event) => {
      setSession(null);
      setError((event as CustomEvent<boolean>).detail ? 'Сессия истекла. Войди снова.' : '');
    };
    window.addEventListener(browserSessionEnded, onEnd);
    return () => window.removeEventListener(browserSessionEnded, onEnd);
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => endBrowserSession(true), Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);

  const start = async () => {
    setError('');
    setStarting(true);
    try {
      await startBrowserLogin();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось открыть вход через Telegram.');
      setStarting(false);
    }
  };

  if (session && !completing) return <>{children}</>;

  return <main className="browser-auth">
    <section className="browser-auth-card" aria-labelledby="browser-auth-title">
      <img className="browser-auth-logo" src={import.meta.env.BASE_URL + 'prodesk-mark.svg'} width={48} height={48} alt="" />
      <h1 id="browser-auth-title">ProDesk</h1>
      <p>Войди через Telegram, чтобы открыть свои задачи, цели и прогресс.</p>
      <button type="button" className="btn accent browser-auth-button" onClick={() => void start()} disabled={starting || completing}>
        <Send size={18} aria-hidden="true" />
        {completing ? 'Подтверждаем вход…' : starting ? 'Открываем Telegram…' : 'Войти через Telegram'}
      </button>
      {error && <p className="browser-auth-error" role="alert">{error}</p>}
    </section>
  </main>;
}
