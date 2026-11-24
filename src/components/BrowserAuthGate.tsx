import { useEffect, useRef, useState, Fragment, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { initData } from '../lib/telegram';
import { isQAMode } from '../qa/sandbox';
import { finishBrowserLogin, hasLoginCallback, restoreBrowserSession, startBrowserLogin } from '../lib/browserLogin';
import { browserSessionEnded, browserSessionUpdated, endBrowserSession, readBrowserSession, type BrowserSession } from '../lib/browserSession';
import { deviceLogoutKey } from '../lib/browserDevice';
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
  const [restoring, setRestoring] = useState(!session && !completing);
  const [retryRestore, setRetryRestore] = useState(false);
  const [error, setError] = useState('');
  const exchange = useRef<ReturnType<typeof finishBrowserLogin> | null>(null);
  const restoreRequestedAfterExpiry = useRef(false);

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
    if (!restoring) return;
    let active = true;
    setRetryRestore(false);
    void restoreBrowserSession().then(next => {
      if (!active) return;
      setSession(next);
      if (!next && restoreRequestedAfterExpiry.current) setError('Сессия истекла. Войди снова.');
    }).catch(() => {
      if (!active) return;
      setError('Не удалось восстановить вход. Проверь соединение.');
      setRetryRestore(true);
    }).finally(() => {
      if (active) {
        restoreRequestedAfterExpiry.current = false;
        setRestoring(false);
      }
    });
    return () => { active = false; };
  }, [restoring]);

  useEffect(() => {
    const onEnd = (event: Event) => {
      const expired = (event as CustomEvent<boolean>).detail;
      setSession(null);
      setError('');
      setRetryRestore(false);
      restoreRequestedAfterExpiry.current = expired;
      setRestoring(expired);
    };
    const onUpdate = (event: Event) => {
      setSession((event as CustomEvent<BrowserSession>).detail);
    };
    window.addEventListener(browserSessionEnded, onEnd);
    window.addEventListener(browserSessionUpdated, onUpdate);
    return () => {
      window.removeEventListener(browserSessionEnded, onEnd);
      window.removeEventListener(browserSessionUpdated, onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === deviceLogoutKey && event.newValue === session.deviceId) endBrowserSession();
    };
    window.addEventListener('storage', onStorage);
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const expiry = window.setTimeout(() => endBrowserSession(true), remaining);
    const renewal = session.deviceId ? window.setTimeout(() => {
      void restoreBrowserSession().catch(() => { /* Keep the active session until expiry. */ });
    }, Math.max(0, remaining - 30000)) : undefined;
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearTimeout(expiry);
      window.clearTimeout(renewal);
    };
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

  if (session && !completing) return <Fragment key={session.userId}>{children}</Fragment>;

  return <main className="browser-auth">
    <section className="browser-auth-card" aria-labelledby="browser-auth-title">
      <img className="browser-auth-logo" src={import.meta.env.BASE_URL + 'prodesk-mark.svg'} width={48} height={48} alt="" />
      <h1 id="browser-auth-title">ProDesk</h1>
      <p>Войди через Telegram, чтобы открыть свои задачи, цели и прогресс.</p>
      {retryRestore && <button type="button" className="btn accent browser-auth-button" onClick={() => { setError(''); setRestoring(true); }}>
        Повторить подключение
      </button>}
      <button type="button" className="btn accent browser-auth-button" onClick={() => void start()} disabled={starting || completing || restoring}>
        <Send size={18} aria-hidden="true" />
        {completing ? 'Подтверждаем вход…' : starting ? 'Открываем Telegram…' : restoring ? 'Восстанавливаем вход…' : 'Войти через Telegram'}
      </button>
      {error && <p className="browser-auth-error" role="alert">{error}</p>}
    </section>
  </main>;
}
