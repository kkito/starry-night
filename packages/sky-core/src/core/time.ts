export function norm360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export function dateToJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function centuriesSinceJ2000(jd: number): number {
  return (jd - 2451545.0) / 36525;
}

/** 格林尼治平恒星时（度），Meeus 12.4。 */
export function gmstDeg(jd: number): number {
  const T = centuriesSinceJ2000(jd);
  const g =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return norm360(g);
}

/** 当地真恒星时（度）：GMST + 东经 + 赤经章动 Δψ·cosε。 */
export function lastDeg(jd: number, lonEastDeg: number, dpsiDeg: number, epsDeg: number): number {
  const eqOfEquinox = dpsiDeg * Math.cos((epsDeg * Math.PI) / 180);
  return norm360(gmstDeg(jd) + lonEastDeg + eqOfEquinox);
}
