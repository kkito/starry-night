import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { altAzToVec, DOME_R, pointSizeFor } from '../lib/dome';
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
  mesh.material.opacity = 0.45;
  mesh.material.depthWrite = false;
  return mesh;
}

/** 星点圆形纹理：PointsMaterial 默认是方块，用径向渐变贴图画成圆点。 */
function circleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
function directionLabel(text: string, color = '#e8b45a'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '40px system-ui, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(36, 18, 1);
  return sp;
}

export function SkyDome3D({ stars, track, selectedId, onSelect }: SkyDome3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ yaw: (180 * Math.PI) / 180, pitch: (25 * Math.PI) / 180 });
  const [noGL, setNoGL] = useState(false);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ x: number; y: number } | null>(null);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const dataRef = useRef({ stars, track });
  dataRef.current = { stars, track };
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const applyCamRef = useRef<(() => void) | null>(null);
  const rebuildSceneRef = useRef<((stars: DrawStar[], track: StarTrack | null) => void) | null>(null);
  const updateSelectedPosRef = useRef<(() => void) | null>(null);

  // 选中不碰视角：点击只叠加轨迹，相机 yaw/pitch 完全由用户拖拽决定。

  // 星星/轨迹 prop 更新时重建动态场景对象（mount-effect 内注册 rebuild 实现）
  useEffect(() => {
    rebuildSceneRef.current?.(stars, track);
  }, [stars, track]);

  useEffect(() => {
    const s = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;
    if (!s) { setSelectedPos(null); return; }
    if (updateSelectedPosRef.current) updateSelectedPosRef.current();
    else {
      // camera 尚未初始化时先用近似位置，待 mount 后校正
      setSelectedPos({ x: 0, y: 0 });
    }
  }, [selectedId, stars]);

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
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 2000);
    camera.position.set(0, 2, 0);
    cameraRef.current = camera;
    const starTex = circleTexture();

    const tmpVec = new THREE.Vector3();
    const updateSelectedPos = () => {
      const id = selectedIdRef.current;
      if (!id) { setSelectedPos(null); return; }
      const s = dataRef.current.stars.find((x) => x.id === id);
      if (!s) { setSelectedPos(null); return; }
      const vv = altAzToVec(s.az, s.alt, DOME_R * 0.98);
      tmpVec.set(vv.x, vv.y, vv.z);
      tmpVec.project(camera);
      if (tmpVec.z > 1) { setSelectedPos(null); return; }
      const rect = renderer.domElement.getBoundingClientRect();
      const rw = rect.width || w;
      const rh = rect.height || h;
      setSelectedPos({ x: (tmpVec.x * 0.5 + 0.5) * rw, y: (-tmpVec.y * 0.5 + 0.5) * rh });
    };
    updateSelectedPosRef.current = updateSelectedPos;
    // 若挂载前已选中，立即校正一次
    if (selectedIdRef.current) updateSelectedPos();

    const applyCam = () => {
      const { yaw, pitch } = camRef.current;
      const d = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(d.clone().multiplyScalar(100).add(camera.position));
      updateSelectedPos();
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
    // 纬线（等高圈）仰角度数标注：10°/20°/30°/45°/60°，放在正南附近便于阅读
    for (const alt of ALT_RINGS) {
      const v = altAzToVec(180, alt, DOME_R * 0.985);
      const sp = directionLabel(`${alt}°`, '#8ea0c8');
      sp.position.set(v.x, v.y + 2, v.z);
      sp.scale.set(18, 9, 1);
      scene.add(sp);
    }
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
      o.traverse((child) => {
        const mesh = child as THREE.Mesh;
        const g = mesh.geometry as THREE.BufferGeometry | undefined;
        g?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
        else m?.dispose?.();
      });
    };
    const buildStars = (starObjs: DrawStar[]) => {
      // starPos 与 starObjs 同序：拾取索引直接对应
      starPos.length = 0;
      for (const s of starObjs) {
        const v = altAzToVec(s.az, s.alt, DOME_R * 0.98);
        starPos.push(new THREE.Vector3(v.x, v.y, v.z));
      }
      const group = new THREE.Group();
      // 按 rPx 分桶：同尺寸的星共用一个 Points（PointsMaterial 尺寸是整批统一的）
      const buckets = new Map<number, number[]>();
      for (let i = 0; i < starObjs.length; i++) {
        const size = pointSizeFor(starObjs[i]!.rPx);
        let b = buckets.get(size);
        if (!b) { b = []; buckets.set(size, b); }
        b.push(i);
      }
      const c = new THREE.Color();
      for (const [size, idxs] of buckets) {
        const pts = idxs.map((i) => starPos[i]!);
        const cols: number[] = [];
        for (const i of idxs) {
          c.set(starObjs[i]!.color);
          cols.push(c.r, c.g, c.b);
        }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        const m = new THREE.PointsMaterial({ map: starTex, size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
        group.add(new THREE.Points(g, m));
      }
      return group;
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

    // 剪影：每 90° 一组树 + 楼（共 4 组，半透明）
    const SILHOUETTE_GROUPS = [
      { treeAz: 20, bldAz: 43 },
      { treeAz: 110, bldAz: 133 },
      { treeAz: 200, bldAz: 223 },
      { treeAz: 290, bldAz: 313 },
    ];
    {
      const winPts: number[] = [];
      for (const g of SILHOUETTE_GROUPS) {
        const td = altAzToVec(g.treeAz, 0, DOME_R * 0.55);
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

        const bd = altAzToVec(g.bldAz, 0, DOME_R * 0.55);
        const b = silhouette(new THREE.Mesh(
          new THREE.BoxGeometry(22, 38, 10),
          new THREE.MeshBasicMaterial({ color: 0x0a1024 }),
        ));
        b.position.set(bd.x, 19, bd.z);
        b.lookAt(0, 19, 0);
        b.updateMatrixWorld();
        scene.add(b);
        // 亮窗：只亮 4 扇、窗口放大
        const lit: Array<[number, number]> = [[0, 3], [2, 2], [1, 1], [2, 0]];
        for (const [cIdx, r] of lit) {
          const off = new THREE.Vector3(-7 + cIdx * 7, 8 + r * 8, 5.2).applyQuaternion(b.quaternion);
          winPts.push(bd.x + off.x, off.y, bd.z + off.z);
        }
      }
      const winG = new THREE.BufferGeometry();
      winG.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3));
      scene.add(new THREE.Points(winG, new THREE.PointsMaterial({ color: 0xffdc78, size: 8, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })));
    }

    // 地平线方位标注：东/南/西/北（正东 90° 等，标在地平线上方）
    for (const [az, text] of [[0, '北'], [90, '东'], [180, '南'], [270, '西']] as const) {
      const v = altAzToVec(az, 4, DOME_R * 0.97);
      const sp = directionLabel(text, az === 90 ? '#e8b45a' : '#9aa5c4');
      sp.position.set(v.x, v.y, v.z);
      scene.add(sp);
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
      updateSelectedPos();
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
      starTex.dispose();
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStar = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;
  if (noGL) {
    return (
      <div data-testid="skydome-fallback" style={{ position: 'relative', background: COLORS.sky, color: COLORS.inkDim, padding: 24, textAlign: 'center' }}>
        当前环境不支持 WebGL，无法显示 3D 天穹
        {selectedStar && (
          <div data-testid="selected-tooltip" style={{ marginTop: 12 }}>
            <StarTooltip star={selectedStar} x={0} y={0} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-testid="skydome" style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }} onMouseLeave={() => setHover(null)}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      {hover && !selectedStar && <StarTooltip star={hover.star} x={hover.px} y={hover.py} />}
      {selectedStar && selectedPos && (
        <div data-testid="selected-tooltip" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <StarTooltip star={selectedStar} x={selectedPos.x} y={selectedPos.y} />
        </div>
      )}
    </div>
  );
}
