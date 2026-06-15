// Heuristic ICE performance + emissions predictor.
// Deterministic (no randomness) so identical inputs produce identical outputs.

export type FuelInput = {
  calorific_value: number; // MJ/kg
  density: number;         // kg/m^3
  air_fuel_ratio: number;
  cetane_number?: number | null;
  octane_number?: number | null;
  carbon_fraction: number;
  fuel_type: string;
};

export type EngineInput = {
  engine_type: string; // SI / CI
  cylinders: number;
  bore: number;        // mm
  stroke: number;      // mm
  compression_ratio: number;
  displacement?: number | null; // L
};

export type ConditionsInput = {
  rpm: number;
  load_pct: number;
  ambient_temp: number;
  intake_temp: number;
  intake_pressure: number; // bar
};

export type PredictionResult = {
  torque: number;            // Nm
  brake_power: number;       // kW
  indicated_power: number;   // kW
  fuel_consumption: number;  // kg/h
  bsfc: number;              // g/kWh
  thermal_efficiency: number; // %
  mechanical_efficiency: number; // %
  volumetric_efficiency: number; // %
  co: number;     // %vol
  co2: number;    // g/kWh
  hc: number;     // ppm
  nox: number;    // ppm
  smoke: number;  // FSN
  confidence: number; // %
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function predict(fuel: FuelInput, engine: EngineInput, cond: ConditionsInput): PredictionResult {
  // Geometry
  const bore_m = engine.bore / 1000;
  const stroke_m = engine.stroke / 1000;
  const swept_per_cyl = Math.PI * 0.25 * bore_m * bore_m * stroke_m; // m^3
  const V_d = engine.displacement ? engine.displacement / 1000 : swept_per_cyl * engine.cylinders; // m^3
  const isFour = true; // assume 4-stroke
  const cycles_per_sec = (cond.rpm / 60) / (isFour ? 2 : 1);

  // Volumetric efficiency: peaks near 3000 rpm, dips at extremes
  const rpmNorm = (cond.rpm - 3500) / 3500;
  let etaV = 0.92 - 0.18 * rpmNorm * rpmNorm; // 0.74..0.92
  // Pressure correction
  etaV *= clamp(cond.intake_pressure / 1.013, 0.7, 1.4);
  // Temperature correction (cooler intake → denser charge)
  etaV *= 298 / (273 + cond.intake_temp);
  etaV = clamp(etaV, 0.4, 1.2);

  // Air mass flow (rho_air at intake)
  const rho_air = (cond.intake_pressure * 1e5) / (287 * (273 + cond.intake_temp));
  const m_air = V_d * etaV * rho_air * cycles_per_sec; // kg/s

  // Fuel mass flow scaled by load (equivalence ratio)
  const equiv = 0.6 + (cond.load_pct / 100) * 0.6; // 0.6..1.2
  const m_fuel = (m_air / fuel.air_fuel_ratio) * equiv; // kg/s

  // Thermal efficiency from Otto/Diesel-like cycle approximation
  const gamma = 1.35;
  let etaTh_ideal = 1 - Math.pow(1 / engine.compression_ratio, gamma - 1);
  // Fuel-quality factor
  const fuelQuality = (() => {
    if (engine.engine_type === "CI") {
      const cn = fuel.cetane_number ?? 45;
      return clamp(0.78 + (cn - 45) * 0.004, 0.7, 0.95);
    }
    const on = fuel.octane_number ?? 90;
    return clamp(0.74 + (on - 90) * 0.003, 0.65, 0.92);
  })();
  const etaTh = clamp(etaTh_ideal * fuelQuality, 0.18, 0.55);

  // Indicated power: m_fuel * LHV * eta
  const lhv_J = fuel.calorific_value * 1e6; // J/kg
  const P_indicated = m_fuel * lhv_J * etaTh; // W

  // Mechanical efficiency (rpm-dependent friction)
  const etaMech = clamp(0.92 - 0.00008 * cond.rpm - 0.0003 * (cond.rpm / 1000) ** 2, 0.7, 0.93);
  const P_brake = P_indicated * etaMech; // W
  const P_brake_kW = P_brake / 1000;
  const P_indicated_kW = P_indicated / 1000;
  const torque = (P_brake * 60) / (2 * Math.PI * cond.rpm); // Nm

  // BSFC
  const fuelKgPerHr = m_fuel * 3600;
  const bsfc = P_brake_kW > 0.01 ? (fuelKgPerHr * 1000) / P_brake_kW : 0; // g/kWh

  // Emissions ----------------------------------------------------------------
  // NOx: rises with peak temp ∝ load * (cr / 12) * (T_intake/298) * fuel factor
  const noxFuelFactor =
    fuel.fuel_type === "hydrogen" ? 1.4 :
    fuel.fuel_type === "diesel" ? 1.3 :
    fuel.fuel_type === "biodiesel" ? 1.15 :
    fuel.fuel_type === "ethanol" || fuel.fuel_type === "methanol" ? 0.6 :
    1.0;
  const nox =
    220 *
    (cond.load_pct / 70) *
    (engine.compression_ratio / 12) *
    ((273 + cond.intake_temp) / 298) *
    noxFuelFactor;

  // CO: inverse to equivalence ratio < 1; fuels with oxygen content reduce CO
  const oxyBonus = ["ethanol", "methanol", "biodiesel"].includes(fuel.fuel_type) ? 0.5 : 1.0;
  const co = clamp(0.4 * (equiv ** 3) * oxyBonus + 0.02, 0.01, 5.0);

  // HC: increases at low load, low temp
  const hc = clamp(180 * (1.2 - cond.load_pct / 100) * (1 / fuelQuality), 20, 600);

  // CO2 from carbon balance: m_fuel * carbon_fraction * (44/12) * 3600 / P_brake_kW
  const co2 = P_brake_kW > 0.01
    ? (fuelKgPerHr * fuel.carbon_fraction * (44 / 12) * 1000) / P_brake_kW
    : 0;

  // Smoke: diesel-specific; low for gaseous/oxygenated fuels
  const smokeBase =
    engine.engine_type === "CI" && !["hydrogen", "cng", "lng", "lpg", "ethanol", "methanol"].includes(fuel.fuel_type)
      ? 0.6
      : 0.05;
  const smoke = clamp(smokeBase * (cond.load_pct / 70) * (1 / Math.max(fuel.cetane_number ?? 45, 30) * 45), 0.01, 6);

  // Confidence: penalize being far from "validated envelope"
  const rpmPen = Math.abs(rpmNorm);
  const loadPen = Math.abs((cond.load_pct - 70) / 70);
  const confidence = clamp(99 - rpmPen * 12 - loadPen * 10, 65, 99.8);

  return {
    torque: round(torque, 1),
    brake_power: round(P_brake_kW, 2),
    indicated_power: round(P_indicated_kW, 2),
    fuel_consumption: round(fuelKgPerHr, 3),
    bsfc: round(bsfc, 1),
    thermal_efficiency: round(etaTh * 100, 2),
    mechanical_efficiency: round(etaMech * 100, 2),
    volumetric_efficiency: round(etaV * 100, 2),
    co: round(co, 3),
    co2: round(co2, 1),
    hc: round(hc, 1),
    nox: round(nox, 1),
    smoke: round(smoke, 3),
    confidence: round(confidence, 1),
  };
}

function round(n: number, d: number) {
  const m = 10 ** d;
  return Math.round(n * m) / m;
}

export function sweepRpm(
  fuel: FuelInput,
  engine: EngineInput,
  cond: ConditionsInput,
  range: { min: number; max: number; step: number } = { min: 1000, max: 6000, step: 500 },
) {
  const points: Array<PredictionResult & { rpm: number }> = [];
  for (let rpm = range.min; rpm <= range.max; rpm += range.step) {
    const r = predict(fuel, engine, { ...cond, rpm });
    points.push({ rpm, ...r });
  }
  return points;
}
