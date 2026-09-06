// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarTableDialog } from '../../src/components/StarTableDialog';
import type { SkyStar } from '../../src/core/sky';

afterEach(cleanup);

const rows: SkyStar[] = [
  { id: 'b', name: 'B星', ra: 0, dec: 0, az: 10, alt: 20, mag: 1.9 },
  { id: 'a', name: 'A星', ra: 0, dec: 0, az: 20, alt: 30, mag: 0.5 },
  { id: 'c', ra: 0, dec: 0, az: 30, alt: 40, mag: 3.7 },
];

describe('StarTableDialog', () => {
  it('按星等升序渲染', () => {
    render(<StarTableDialog open stars={rows} onClose={() => {}} />);
    const mags = screen.getAllByTestId('mag-cell').map((el) => Number(el.textContent));
    expect(mags).toEqual([0.5, 1.9, 3.7]);
  });

  it('名字过滤', async () => {
    render(<StarTableDialog open stars={rows} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('过滤星名'), 'A星');
    expect(screen.getAllByTestId('mag-cell').length).toBe(1);
  });

  it('open=false 不渲染', () => {
    render(<StarTableDialog open={false} stars={rows} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
