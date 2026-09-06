import { norm360 } from './time';

export const DEG = Math.PI / 180;
export function deg2rad(d: number): number { return d * DEG; }
export function rad2deg(r: number): number { return r / DEG; }

export type Vec3 = [number, number, number];

export function unitFromRaDec(raDeg: number, decDeg: number): Vec3 {
  const ra = deg2rad(raDeg), dec = deg2rad(decDeg), cosd = Math.cos(dec);
  return [cosd * Math.cos(ra), cosd * Math.sin(ra), Math.sin(dec)];
}

export function raDecFromUnit(v: Vec3): { raDeg: number; decDeg: number } {
  const r = Math.hypot(v[0], v[1], v[2]);
  return {
    raDeg: norm360(rad2deg(Math.atan2(v[1], v[0]))),
    decDeg: rad2deg(Math.asin(v[2] / r)),
  };
}

function normalize(v: Vec3): Vec3 {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / r, v[1] / r, v[2] / r];
}

function matMul(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => B[0]!.map((_, j) => row[0]! * B[0]![j]! + row[1]! * B[1]![j]! + row[2]! * B[2]![j]!));
}

function matVec(M: number[][], v: Vec3): Vec3 {
  return [
    M[0]![0]! * v[0] + M[0]![1]! * v[1] + M[0]![2]! * v[2],
    M[1]![0]! * v[0] + M[1]![1]! * v[1] + M[1]![2]! * v[2],
    M[2]![0]! * v[0] + M[2]![1]! * v[1] + M[2]![2]! * v[2],
  ];
}

/** 右手系旋转矩阵：绕 x/y/z 轴旋转角 a（弧度）。 */
function rotX(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
function rotY(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}
function rotZ(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

/** 平均黄赤交角 ε0（度），Meeus 22.2。 */
export function meanObliquityDeg(T: number): number {
  const s = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  return 23 + 26 / 60 + s / 3600;
}

/** 章动主项（角秒），Meeus 22 简化式，精度约 ±0.5″。 */
export function nutationArcsec(T: number): { dpsi: number; deps: number } {
  const omega = deg2rad(norm360(125.04452 - 1934.136261 * T));
  const L = deg2rad(norm360(280.4665 + 36000.7698 * T));
  const Lp = deg2rad(norm360(218.3165 + 481267.8813 * T));
  return {
    dpsi:
      -17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * L) -
      0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * omega),
    deps:
      9.20 * Math.cos(omega) + 0.57 * Math.cos(2 * L) +
      0.10 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * omega),
  };
}

/** 岁差矩阵：J2000 → date 平赤道（IAU1976，Meeus 21.4/21.5）。 */
export function precessionMatrix(T: number): number[][] {
  const zeta = deg2rad((2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600);
  const z = deg2rad((2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600);
  const theta = deg2rad((2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600);
  return matMul(rotZ(-z), matMul(rotY(theta), rotZ(-zeta)));
}

/** 年像差位移矢量（黄道系，角秒；圆轨道近似，k = 20.489″）。 */
export function annualAberrationEclVecArcsec(T: number): Vec3 {
  const lambdaSun = deg2rad(norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T));
  const k = 20.489;
  // 地球公转速度指向黄经 λ⊙+90°（像差把星向运动顶点方向推）
  return [-k * Math.sin(lambdaSun), k * Math.cos(lambdaSun), 0];
}

/** J2000 平位置 → 当日视位置（岁差 + 章动 + 年像差）。 */
export function j2000ToApparent(
  raDeg: number, decDeg: number, T: number,
): { raDeg: number; decDeg: number; dpsiDeg: number; epsDeg: number } {
  let v = unitFromRaDec(raDeg, decDeg);
  v = matVec(precessionMatrix(T), v);            // → 平赤道(date)
  const eps0 = meanObliquityDeg(T);
  v = matVec(rotX(-deg2rad(eps0)), v);           // → 黄道(date)：y' = y cosε + z sinε
  const { dpsi, deps } = nutationArcsec(T);
  v = matVec(rotZ(deg2rad(dpsi / 3600)), v);     // 黄经章动 Δψ
  const d = annualAberrationEclVecArcsec(T);
  v = normalize([
    v[0] + deg2rad(d[0] / 3600),
    v[1] + deg2rad(d[1] / 3600),
    v[2] + deg2rad(d[2] / 3600),
  ]);
  const eps = eps0 + deps / 3600;                // 真黄赤交角
  v = matVec(rotX(deg2rad(eps)), v);             // → 真赤道(date)
  const rd = raDecFromUnit(v);
  return { raDeg: rd.raDeg, decDeg: rd.decDeg, dpsiDeg: dpsi / 3600, epsDeg: eps };
}

/** 赤道(date) → 地平坐标。az 从北顺时针，alt 向上为正。 */
export function raDecToAltAz(
  raDeg: number, decDeg: number, lastDeg: number, latDeg: number,
): { azDeg: number; altDeg: number } {
  const H = deg2rad(norm360(lastDeg - raDeg)); // 时角，向西为正
  const phi = deg2rad(latDeg), dec = deg2rad(decDeg);
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const alt = rad2deg(Math.asin(Math.min(1, Math.max(-1, sinAlt))));
  // Meeus 13.5：A 从南向西量；转为从北顺时针 +180°
  const A = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { azDeg: norm360(rad2deg(A) + 180), altDeg: alt };
}

/** Bennett 大气折射（度），只对 alt > −1° 生效；alt 加上返回值即视高度。 */
export function refractionDeg(altDeg: number): number {
  if (altDeg < -1 || altDeg > 90) return 0;
  const r = 1.02 / Math.tan(deg2rad(altDeg + 10.3 / (altDeg + 5.11))); // 角分
  return r / 60;
}
