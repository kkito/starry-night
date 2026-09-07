// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('three', () => ({
  Vector3: class { constructor(public x = 0, public y = 0, public z = 0) {} set() { return this; } },
}));

import { Sky3D } from '../../src/components/Sky3D';

afterEach(cleanup);

describe('Sky3D', () => {
  it('无 WebGL 时渲染降级占位，不抛错', () => {
    render(<Sky3D stars={[]} track={null} selectedId={null} />);
    expect(screen.getByTestId('skydome-fallback')).toBeTruthy();
  });
});
