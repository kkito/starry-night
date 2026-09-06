// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('three', () => ({
  Vector3: class { constructor(public x = 0, public y = 0, public z = 0) {} set() { return this; } },
}));

import { SkyDome3D } from '../../src/components/SkyDome3D';

afterEach(cleanup);

describe('SkyDome3D', () => {
  it('无 WebGL 时渲染降级占位，不抛错', () => {
    render(<SkyDome3D stars={[]} track={null} selectedId={null} />);
    expect(screen.getByTestId('skydome-fallback')).toBeTruthy();
  });
});
