import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetch } from './useFetch';
import { ApiError } from '../api/client';

describe('useFetch', () => {
  it('başarılı istek: loading → data', async () => {
    const { result } = renderHook(() => useFetch(async () => 'sonuç'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('sonuç');
    expect(result.current.error).toBeNull();
  });

  it('ApiError: mesajı kullanıcıya aynen taşır', async () => {
    const { result } = renderHook(() =>
      useFetch<string>(async () => { throw new ApiError(500, 'Sunucu hatası'); }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Sunucu hatası');
    expect(result.current.data).toBeNull();
  });

  it('bilinmeyen hata: genel Türkçe mesaja düşer', async () => {
    const { result } = renderHook(() =>
      useFetch<string>(async () => { throw new Error('raw'); }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Beklenmeyen bir hata oluştu.');
  });

  it('refetch: nonce artınca isteği tekrarlar', async () => {
    let calls = 0;
    const { result } = renderHook(() => useFetch(async () => { calls += 1; return calls; }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toBe(2));
  });
});
