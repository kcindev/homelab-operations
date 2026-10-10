import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from '../src/App';

it('shows loading while the request is pending', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Homelab Operations Platform' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('API: Loading');
  expect(screen.getByRole('button')).toBeDisabled();
});

it('requests the relative API endpoint and renders a healthy response', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  expect(await screen.findByText('API: Healthy')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', { signal: expect.any(AbortSignal) });
});

it.each([
  ['network failure', () => Promise.reject(new Error('Connection refused'))],
  ['HTTP failure', () => Promise.resolve(new Response('', { status: 503 }))],
  ['unexpected payload', () => Promise.resolve(new Response(JSON.stringify({ status: 'bad' })))],
  ['invalid JSON', () => Promise.resolve(new Response('invalid'))],
])('renders unavailable for %s', async (_name, request) => {
  vi.stubGlobal('fetch', vi.fn(request));
  render(<App />);
  expect(await screen.findByText('API: Unavailable')).toBeInTheDocument();
});

it('allows another check to detect a backend that has stopped', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))
    .mockRejectedValueOnce(new Error('Connection refused')));
  render(<App />);
  await screen.findByText('API: Healthy');
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('API: Unavailable')).toBeInTheDocument();
});

it('shows unavailable when the request exceeds five seconds', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  })));
  render(<App />);
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('status')).toHaveTextContent('API: Unavailable');
});
