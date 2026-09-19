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

/** 平均黄赤交角 ε0（度），IAU 2006。 */
export function meanObliquityDeg(T: number): number {
  const s = 84381.406 - T * (46.836769 + T * (0.0001831 - T * (0.0020034 - T * (0.000000576 - T * 0.0000000434))));
  return s / 3600;
}

/** 章动（角秒），IAU 2000B（77 项月日章动 + 行星项固定补偿），精度约 1 mas。 */
export function nutationArcsec(T: number): { dpsi: number; deps: number } {
  // Delaunay 基本幅角（Simon et al. 1994），单位角秒
  const el = 485868.249036 + 1717915923.2178 * T;
  const elp = 1287104.79305 + 129596581.0481 * T;
  const f = 335779.526232 + 1739527262.8478 * T;
  const d = 1072260.70369 + 1602961601.209 * T;
  const om = 450160.398036 - 6962890.5431 * T;
  const arg = (nl: number, nlp: number, nf: number, nd: number, nom: number) =>
    deg2rad(norm360((nl * el + nlp * elp + nf * f + nd * d + nom * om) / 3600));
  // 系数单位 0.1 μas → 角秒
  const U = 1e-7;
  // [nl,nlp,nf,nd,nom, ps,pst,pc, ec,ect,es]
  const X: [
    number, number, number, number, number,
    number, number, number, number, number, number,
  ][] = [
    [0,0,0,0,1, -172064161,-174666,33386, 92052331,9086,15377],
    [0,0,2,-2,2, -13170906,-1675,-13696, 5730336,-3015,-4587],
    [0,0,2,0,2, -2276413,-234,2796, 978459,-485,1374],
    [0,0,0,0,2, 2074554,207,-698, -897492,470,-291],
    [0,1,0,0,0, 1475877,-3633,11817, 73871,-184,-1924],
    [0,1,2,-2,2, -516821,1226,-524, 224386,-677,-174],
    [1,0,0,0,0, 711159,73,-872, -6750,0,358],
    [0,0,2,0,1, -387298,-367,380, 200728,18,318],
    [1,0,2,0,2, -301461,-36,816, 129025,-63,367],
    [0,-1,2,-2,2, 215829,-494,111, -95929,299,132],
    [0,0,2,-2,1, 128227,137,181, -68982,-9,39],
    [-1,0,2,0,2, 123457,11,19, -53311,32,-4],
    [-1,0,0,2,0, 156994,10,-168, -1235,0,82],
    [1,0,0,0,1, 63110,63,27, -33228,0,-9],
    [-1,0,0,0,1, -57976,-63,-189, 31429,0,-75],
    [-1,0,2,2,2, -59641,-11,149, 25543,-11,66],
    [1,0,2,0,1, -51613,-42,129, 26366,0,78],
    [-2,0,2,0,1, 45893,50,31, -24236,-10,20],
    [0,0,0,2,0, 63384,11,-150, -1220,0,29],
    [0,0,2,2,2, -38571,-1,158, 16452,-11,68],
    [0,-2,2,-2,2, 32481,0,0, -13870,0,0],
    [-2,0,0,2,0, -47722,0,-18, 477,0,-25],
    [2,0,2,0,2, -31046,-1,131, 13238,-11,59],
    [1,0,2,-2,2, 28593,0,-1, -12338,10,-3],
    [-1,0,2,0,1, 20441,21,10, -10758,0,-3],
    [2,0,0,0,0, 29243,0,-74, -609,0,13],
    [0,0,2,0,0, 25887,0,-66, -550,0,11],
    [0,1,0,0,1, -14053,-25,79, 8551,-2,-45],
    [-1,0,0,2,1, 15164,10,11, -8001,0,-1],
    [0,2,2,-2,2, -15794,72,-16, 6850,-42,-5],
    [0,0,-2,2,0, 21783,0,13, -167,0,13],
    [1,0,0,-2,1, -12873,-10,-37, 6953,0,-14],
    [0,-1,0,0,1, -12654,11,63, 6415,0,26],
    [-1,0,2,2,1, -10204,0,25, 5222,0,15],
    [0,2,0,0,0, 16707,-85,-10, 168,-1,10],
    [1,0,2,2,2, -7691,0,44, 3268,0,19],
    [-2,0,2,0,0, -11024,0,-14, 104,0,2],
    [0,1,2,0,2, 7566,-21,-11, -3250,0,-5],
    [0,0,2,2,1, -6637,-11,25, 3353,0,14],
    [0,-1,2,0,2, -7141,21,8, 3070,0,4],
    [0,0,0,2,1, -6302,-11,2, 3272,0,4],
    [1,0,2,-2,1, 5800,10,2, -3045,0,-1],
    [2,0,2,-2,2, 6443,0,-7, -2768,0,-4],
    [-2,0,0,2,1, -5774,-11,-15, 3041,0,-5],
    [2,0,2,0,1, -5350,0,21, 2695,0,12],
    [0,-1,2,-2,1, -4752,-11,-3, 2719,0,-3],
    [0,0,0,-2,1, -4940,-11,-21, 2720,0,-9],
    [-1,-1,0,2,0, 7350,0,-8, -51,0,4],
    [2,0,0,-2,1, 4065,0,6, -2206,0,1],
    [1,0,0,2,0, 6579,0,-24, -199,0,2],
    [0,1,2,-2,1, 3579,0,5, -1900,0,1],
    [1,-1,0,0,0, 4725,0,-6, -41,0,3],
    [-2,0,2,0,2, -3075,0,-2, 1313,0,-1],
    [3,0,2,0,2, -2904,0,15, 1233,0,7],
    [0,-1,0,2,0, 4348,0,-10, -81,0,2],
    [1,-1,2,0,2, -2878,0,8, 1232,0,4],
    [0,0,0,1,0, -4230,0,5, -20,0,-2],
    [-1,-1,2,2,2, -2819,0,7, 1207,0,3],
    [-1,0,2,0,0, -4056,0,5, 40,0,-2],
    [0,-1,2,2,2, -2647,0,11, 1129,0,5],
    [-2,0,0,0,1, -2294,0,-10, 1266,0,-4],
    [1,1,2,0,2, 2481,0,-7, -1062,0,-3],
    [2,0,0,0,1, 2179,0,-2, -1129,0,-2],
    [-1,1,0,1,0, 3276,0,1, -9,0,0],
    [1,1,0,0,0, -3389,0,5, 35,0,-2],
    [1,0,2,0,0, 3339,0,-13, -107,0,1],
    [-1,0,2,-2,1, -1987,0,-6, 1073,0,-2],
    [1,0,0,0,2, -1981,0,0, 854,0,0],
    [-1,0,0,1,0, 4026,0,-353, -553,0,-139],
    [0,0,2,1,2, 1660,0,-5, -710,0,-2],
    [-1,0,2,4,2, -1521,0,9, 647,0,4],
    [-1,1,0,1,1, 1314,0,0, -700,0,0],
    [0,-2,2,-2,1, -1283,0,0, 672,0,0],
    [1,0,2,2,1, -1331,0,8, 663,0,4],
    [-2,0,2,2,2, 1383,0,-2, -594,0,-2],
    [-1,0,0,0,2, 1405,0,4, -610,0,2],
    [1,1,2,-2,2, 1290,0,0, -556,0,0],
  ];
  let dp = 0, de = 0;
  for (const [nl, nlp, nf, nd, nom, ps, pst, pc, ec, ect, es] of X) {
    const a = arg(nl, nlp, nf, nd, nom);
    dp += (ps + pst * T) * Math.sin(a) + pc * Math.cos(a);
    de += (ec + ect * T) * Math.cos(a) + es * Math.sin(a);
  }
  // 行星章动的固定补偿（IAU 2000B）
  return { dpsi: dp * U - 0.135e-3, deps: de * U + 0.388e-3 };
}

/** 岁差矩阵：J2000 → date 平赤道（IAU 2006，Capitaine et al.）。 */
export function precessionMatrix(T: number): number[][] {
  const zeta = deg2rad((2.650545 + T * (2306.083227 + T * (0.2988499 + T * 0.01801828))) / 3600);
  const z = deg2rad((-2.650545 + T * (2306.077181 + T * (0.316218 + T * 0.0203102))) / 3600);
  const theta = deg2rad((T * (2004.191903 + T * (-0.4294934 + T * -0.04182264))) / 3600);
  // J2000 → date 平赤道：Rz(z)·Ry(−θ)·Rz(ζ)（等价于 Meeus 21.5）
  return matMul(rotZ(z), matMul(rotY(-theta), rotZ(zeta)));
}

/** 年像差位移矢量（黄道系，角秒）：用开普勒椭圆轨道的地球实际速度，误差 < 0.05″。 */
export function annualAberrationEclVecArcsec(T: number): Vec3 {
  // 太阳平黄经（= 地球平黄经 + 180°）与地球平近点角
  const lambdaSunMean = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const e = 0.016708634 - 0.000042037 * T;
  const varpi = norm360(102.94719 + 1.721 * T + 0.01758 * T * T); // 近日点黄经
  const M = deg2rad(norm360(lambdaSunMean + 180 - varpi)); // 地球平近点角
  // 解开普勒方程（牛顿迭代，e 小收敛快）
  let E = M;
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  // 轨道面速度：v = (n a / sqrt(1−e²)) (e sinν r̂ + (1+e cosν) θ̂)，a = 1 AU
  const theta = deg2rad(varpi) + nu; // 地球日心黄经
  const n_a = 2 * Math.PI / 365.256363004; // rad/day，× a=1 AU
  const vByNa = 1 / Math.sqrt(1 - e * e);
  const vr = vByNa * e * Math.sin(nu);
  const vt = vByNa * (1 + e * Math.cos(nu));
  // AU/day → km/s：1 AU/day = 149597870.7/86400 km/s；c = 299792.458 km/s
  const AU_DAY_KMS = 149597870.7 / 86400;
  const toArcsec = (AU_DAY_KMS / 299792.458) * (180 / Math.PI) * 3600 * n_a;
  return [
    toArcsec * (vr * Math.cos(theta) - vt * Math.sin(theta)),
    toArcsec * (vr * Math.sin(theta) + vt * Math.cos(theta)),
    0,
  ];
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
