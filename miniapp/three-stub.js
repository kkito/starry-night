// weapp 专用 three stub：mini（weapp）构建经 webpackChain alias 把 npm three 指到此文件，
// weapp 运行时只走 Sky3DAdapter（外置 vendor），Sky3D.tsx 的 npm three 是死代码，不打进包。
// 注意：H5 构建保持真 three（h5.webpackChain 不配此 alias）。
// 必须用 ESM 具名 export：Sky3D.tsx 用 `import * as THREE`，CJS 写法会被
// webpack 判为 module has no exports，刷屏 ModuleDependencyWarning；ESM 具名导出则静态可链。
const proxy = new Proxy(function () {}, {
  get() {
    return proxy;
  },
  apply() {
    return proxy;
  },
  construct() {
    return proxy;
  },
});

export default proxy;
export const Scene = proxy;
export const PerspectiveCamera = proxy;
export const WebGLRenderer = proxy;
export const Vector2 = proxy;
export const Vector3 = proxy;
export const Color = proxy;
export const Group = proxy;
export const Mesh = proxy;
export const Line = proxy;
export const LineSegments = proxy;
export const LineBasicMaterial = proxy;
export const LineDashedMaterial = proxy;
export const Points = proxy;
export const PointsMaterial = proxy;
export const BufferGeometry = proxy;
export const Float32BufferAttribute = proxy;
export const ShaderMaterial = proxy;
export const MeshBasicMaterial = proxy;
export const SpriteMaterial = proxy;
export const Sprite = proxy;
export const CanvasTexture = proxy;
export const SphereGeometry = proxy;
export const TorusGeometry = proxy;
export const CircleGeometry = proxy;
export const CylinderGeometry = proxy;
export const ConeGeometry = proxy;
export const BoxGeometry = proxy;
export const Raycaster = proxy;
export const BackSide = proxy;
export const Object3D = proxy;
export const Material = proxy;
export const Texture = proxy;
