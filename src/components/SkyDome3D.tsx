import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { altAzToVec, DOME_R, TREE_AZ, BUILDING_AZ } from '../lib/dome';
import type { DrawStar } from '../lib/drawlist';
import type { StarTrack } from '../lib/track';
import { StarTooltip } from './StarTooltip';
import { COLORS } from '../lib/tokens';

export interface SkyDome3DProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

const ALT_RINGS = [10, 20, 30, 45, 60];
const RING_COLOR = 0x44507a;

function domeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h=normalize(vP).y;
        vec3 zen=vec3(.015,.03,.09);
        vec3 mid=vec3(.06,.10,.26);
        vec3 hor=vec3(.35,.28,.32);
        vec3 c=h>0.25?mix(mid,zen,smoothstep(.25,.9,h)):mix(hor,mid,smoothstep(0.,.25,h));
        if(h<0.) c=mix(hor,vec3(.02,.03,.05),smoothstep(0.,-.3,h));
        gl_FragColor=vec4(c,1.);
      }`,
  });
}

function silhouette<T extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(mesh: T): T {
  mesh.material.transparent = true;
  mesh.material.opacity = 0.55;
  return mesh;
}

export function SkyDome3D({ stars, track, selectedId, onSelect }: SkyDome3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ yaw: (180 * Math.PI) / 180, pitch: (8 * Math.PI) / 180 });
  const [noGL, setNoGL] = useState(false);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const dataRef = useRef({ stars, track });
  dataRef.current = { stars, track };
  const applyCamRef = useRef<(() => void) | null>(null);
  const rebuildSceneRef = useRef<((stars: DrawStar[], track: StarTrack | null) => void) | null>(null);

  // 跟随选中：yaw = az，pitch = max(8°, alt * 0.5)
  useEffect(() => {
    if (!selectedId) return;
    const s = stars.find((x) => x.id === selectedId);
    if (!s) return;
    camRef.current.yaw = (s.az * Math.PI) / 180;
    camRef.current.pitch = Math.max(8, s.alt * 0.5) * (Math.PI / 180);
    applyCamRef.current?.();
  }, [selectedId, stars]);

  // 星星/轨迹 prop 更新时重建动态场景对象（mount-effect 内注册 rebuild 实现）
  useEffect(() => {
    rebuildSceneRef.current?.(stars, track);
  }, [stars, track]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setNoGL(true);
      return;
    }
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 2000);
    camera.position.set(0, 2, 0);

    const applyCam = () => {
      const { yaw, pitch } = camRef.current;
      const d = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(d.clone().multiplyScalar(100).add(camera.position));
    };
    applyCam();

    // 天穹 + 辉光环 + 地面
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 48, 32), domeMaterial()));
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(DOME_R * 0.995, 1.2, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.55 }),
    );
    glow.rotation.x = Math.PI / 2;
    scene.add(glow);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(DOME_R, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a120c }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // 仰角圈 + 方位线
    const ring = (alt: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let az = 0; az <= 360; az += 3) {
        const v = altAzToVec(az, alt, DOME_R * 0.985);
        pts.push(new THREE.Vector3(v.x, v.y, v.z));
      }
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity }),
        ),
      );
    };
    const RING_OPACITY = [0.6, 0.5, 0.5, 0.4, 0.35];
    ALT_RINGS.forEach((alt, i) => ring(alt, RING_OPACITY[i] ?? 0.5));
    for (let az = 0; az < 360; az += 30) {
      const a = altAzToVec(az, 0, DOME_R * 0.985);
      const b = altAzToVec(az, 70, DOME_R * 0.985);
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]),
          new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity: 0.35 }),
        ),
      );
    }

    applyCamRef.current = applyCam;

    // 星星 Points（vertexColors）+ 轨迹：放在动态 group，prop 更新时重建
    const dynamic = new THREE.Group();
    scene.add(dynamic);
    const starPos: THREE.Vector3[] = [];
    const disposeObj = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      const g = mesh.geometry as THREE.BufferGeometry | undefined;
      g?.dispose?.();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    };
    const buildStars = (starObjs: DrawStar[]) => {
      starPos.length = 0;
      for (const s of starObjs) {
        const v = altAzToVec(s.az, s.alt, DOME_R * 0.98);
        starPos.push(new THREE.Vector3(v.x, v.y, v.z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(starPos);
      const cols: number[] = [];
      const c = new THREE.Color();
      for (const s of starObjs) {
        c.set(s.color);
        cols.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
      return new THREE.Points(g, m);
    };
    const buildTrack = (t: StarTrack | null): THREE.Object3D[] => {
      if (!t) return [];
      const past: THREE.Vector3[] = [];
      const future: THREE.Vector3[] = [];
      for (let i = 1; i < t.points.length; i++) {
        const a = t.points[i - 1]!;
        const b = t.points[i]!;
        if (a.alt <= 0 || b.alt <= 0) continue;
        const va = altAzToVec(a.az, a.alt, DOME_R * 0.98);
        const vb = altAzToVec(b.az, b.alt, DOME_R * 0.98);
        const seg = [new THREE.Vector3(va.x, va.y, va.z), new THREE.Vector3(vb.x, vb.y, vb.z)];
        (i <= t.pastCount ? past : future).push(...seg);
      }
      const out: THREE.Object3D[] = [];
      if (past.length) {
        out.push(new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(past),
          new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.accent) }),
        ));
      }
      if (future.length) {
        const g = new THREE.BufferGeometry().setFromPoints(future);
        const l = new THREE.LineSegments(
          g,
          new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.accent), dashSize: 5, gapSize: 5 }),
        );
        l.computeLineDistances();
        out.push(l);
      }
      return out;
    };
    rebuildSceneRef.current = (starObjs: DrawStar[], t: StarTrack | null) => {
      for (const o of [...dynamic.children]) {
        dynamic.remove(o);
        disposeObj(o);
      }
      dynamic.add(buildStars(starObjs), ...buildTrack(t));
    };
    rebuildSceneRef.current(dataRef.current.stars, dataRef.current.track);

    // 剪影：树 @TREE_AZ / 楼 @BUILDING_AZ
    {
      const td = altAzToVec(TREE_AZ, 0, DOME_R * 0.55);
      const tree = new THREE.Group();
      const trunk = silhouette(new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.6, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x060d0a }),
      ));
      trunk.position.y = 5;
      const top = silhouette(new THREE.Mesh(
        new THREE.ConeGeometry(9, 22, 10),
        new THREE.MeshBasicMaterial({ color: 0x060d0a }),
      ));
      top.position.y = 20;
      tree.add(trunk, top);
      tree.position.set(td.x, 0, td.z);
      scene.add(tree);

      const bd = altAzToVec(BUILDING_AZ, 0, DOME_R * 0.55);
      const b = silhouette(new THREE.Mesh(
        new THREE.BoxGeometry(22, 38, 10),
        new THREE.MeshBasicMaterial({ color: 0x0a1024 }),
      ));
      b.position.set(bd.x, 19, bd.z);
      b.lookAt(0, 19, 0);
      b.updateMatrixWorld();
      scene.add(b);
      const wp: number[] = [];
      for (let r = 0; r < 4; r++) {
        for (let cIdx = 0; cIdx < 3; cIdx++) {
          if ((r * 3 + cIdx) % 3 === 0) continue;
          const off = new THREE.Vector3(-7 + cIdx * 7, 8 + r * 8, 5.2).applyQuaternion(b.quaternion);
          wp.push(bd.x + off.x, off.y, bd.z + off.z);
        }
      }
      const winG = new THREE.BufferGeometry();
      winG.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      scene.add(new THREE.Points(winG, new THREE.PointsMaterial({ color: 0xffdc78, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.8 })));
    }

    // 交互：拖拽改 yaw/pitch，滚轮改 fov；raycast 悬停 + 点击选中
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 4;
    const ndc = new THREE.Vector2();
    const pick = (e: PointerEvent): number => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < starPos.length; i++) {
        const d = raycaster.ray.distanceToPoint(starPos[i]!);
        if (d < bestD) { bestD = d; best = i; }
      }
      return bestD < 6 ? best : -1;
    };
    let drag: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; };
    const onMove = (e: PointerEvent) => {
      if (drag) {
        camRef.current.yaw -= (e.clientX - drag.x) * 0.003;
        camRef.current.pitch = Math.max(-0.05, Math.min(1.2, camRef.current.pitch + (e.clientY - drag.y) * 0.002));
        drag = { x: e.clientX, y: e.clientY };
        applyCam();
        return;
      }
      const i = pick(e);
      const list = dataRef.current.stars;
      const rect = renderer.domElement.getBoundingClientRect();
      setHover(i >= 0 && list[i] ? { star: list[i]!, px: e.clientX - rect.left, py: e.clientY - rect.top } : null);
    };
    const onUp = (e: PointerEvent) => {
      const wasDrag = drag && (Math.abs(e.clientX - drag.x) > 3 || Math.abs(e.clientY - drag.y) > 3);
      drag = null;
      if (wasDrag) return;
      const i = pick(e);
      cbRef.current?.(i >= 0 ? dataRef.current.stars[i]!.id : null);
    };
    const onWheel = (e: WheelEvent) => {
      camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.02));
      camera.updateProjectionMatrix();
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      applyCamRef.current = null;
      rebuildSceneRef.current = null;
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const g = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        g?.dispose?.();
        const m = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
        else m?.dispose?.();
      });
      renderer.dispose();
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (noGL) {
    return (
      <div data-testid="skydome-fallback" style={{ position: 'relative', background: COLORS.sky, color: COLORS.inkDim, padding: 24, textAlign: 'center' }}>
        当前环境不支持 WebGL，无法显示 3D 天穹
      </div>
    );
  }
  return (
    <div data-testid="skydome" style={{ position: 'relative', width: '100%', height: '100%' }} onMouseLeave={() => setHover(null)}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {hover && <StarTooltip star={hover.star} x={hover.px} y={hover.py} />}
    </div>
  );
}
