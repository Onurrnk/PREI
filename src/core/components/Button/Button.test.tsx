import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('içeriği render eder ve tıklamayı iletir', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kaydet</Button>);
    const btn = screen.getByRole('button', { name: 'Kaydet' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled durumda tıklama iletmez', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Kaydet</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('native button attribute’larını geçirir (type=submit)', () => {
    render(<Button type="submit">Gönder</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
