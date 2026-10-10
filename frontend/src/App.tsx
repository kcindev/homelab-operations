import { useEffect, useState } from 'react';

type ApiStatus = 'loading' | 'healthy' | 'unavailable';

const labels: Record<ApiStatus, string> = {
  loading: 'Loading…',
  healthy: 'Healthy',
  unavailable: 'Unavailable',
};

export default function App() {
  const [status, setStatus] = useState<ApiStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let active = true;

    async function checkHealth() {
      setStatus('loading');
      try {
        const response = await fetch('/api/v1/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Health request failed');
        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ok') {
          throw new Error('Unexpected health response');
        }
        if (active) setStatus('healthy');
      } catch {
        if (active) setStatus('unavailable');
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void checkHealth();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <main>
      <h1>Homelab Operations Platform</h1>
      <section aria-label="API health" className="health-card">
        <p role="status" className={`api-status ${status}`}>
          <span className="status-dot" aria-hidden="true" />
          API: {labels[status]}
        </p>
        {status === 'unavailable' && <p className="hint">Could not reach a healthy API. Check that the backend is running, then try again.</p>}
        <button disabled={status === 'loading'} onClick={() => setAttempt((value) => value + 1)}>
          Check again
        </button>
      </section>
    </main>
  );
}
