import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import { sweepRpm } from "@/lib/prediction/engine";

type Sim = any;

function buildSweep(sim: Sim) {
  const fuel = { ...sim.fuels, carbon_fraction: sim.fuels.carbon_fraction ?? 0.86 };
  return sweepRpm(fuel, sim.engines, {
    rpm: sim.rpm,
    load_pct: sim.load_pct,
    ambient_temp: sim.ambient_temp,
    intake_temp: sim.intake_temp,
    intake_pressure: sim.intake_pressure,
  });
}

function recommend(sim: Sim, r: any) {
  const recs: string[] = [];
  if (r.bsfc > 280) recs.push("BSFC high — reduce load or enrich AFR for better fuel economy.");
  if (r.nox > 800) recs.push("NOx elevated — consider EGR, retarded injection, or lower CR.");
  if (r.thermal_efficiency < 30) recs.push("Thermal efficiency low — verify compression ratio and intake conditions.");
  if (r.smoke > 1.5) recs.push("Smoke high — switch to oxygenated fuel (biodiesel/ethanol blend) or improve atomization.");
  if (!recs.length) recs.push("Operating point is within optimal envelope. Maintain current calibration.");
  const fuelType = sim.fuels?.fuel_type;
  const best =
    r.nox > 800 ? "Ethanol / Methanol (lower peak temperatures)"
    : r.smoke > 1.5 ? "Biodiesel B20 (oxygenated, lower PM)"
    : fuelType === "diesel" ? "Diesel / Biodiesel blend"
    : "Current fuel is well matched";
  return { recs, best };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function lineChartPng(
  data: Array<Record<string, number>>,
  key: string,
  label: string,
  color = "#14b8a6",
  width = 560,
  height = 220,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const pad = { l: 50, r: 14, t: 24, b: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const xs = data.map((d) => d.rpm);
  const ys = data.map((d) => d[key]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const yLo = yMin - yPad, yHi = yMax + yPad;
  const X = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const Y = (v: number) => pad.t + h - ((v - yLo) / (yHi - yLo || 1)) * h;
  // title
  ctx.fillStyle = "#111827";
  ctx.font = "bold 12px Helvetica";
  ctx.fillText(`Engine Speed (RPM) vs ${label}`, pad.l, 16);
  // grid + axes
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.font = "10px Helvetica"; ctx.fillStyle = "#6b7280";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
    const v = yHi - ((yHi - yLo) * i) / 4;
    ctx.fillText(v.toFixed(1), 6, y + 3);
  }
  for (let i = 0; i < xs.length; i++) {
    const x = X(xs[i]);
    ctx.fillText(String(xs[i]), x - 12, height - 10);
  }
  // line
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((d, i) => {
    const x = X(d.rpm), y = Y(d[key]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // points
  ctx.fillStyle = color;
  data.forEach((d) => {
    ctx.beginPath(); ctx.arc(X(d.rpm), Y(d[key]), 2.5, 0, Math.PI * 2); ctx.fill();
  });
  return canvas.toDataURL("image/png");
}

// ---------- Rating + layout helpers ----------
type Rating = { label: string; rgb: [number, number, number] };
const GREEN: [number, number, number] = [22, 163, 74];
const AMBER: [number, number, number] = [202, 138, 4];
const RED: [number, number, number] = [220, 38, 38];

function rateBetween(v: number, good: [number, number], avg: [number, number]): Rating {
  if (v >= good[0] && v <= good[1]) return { label: "Excellent", rgb: GREEN };
  if (v >= avg[0] && v <= avg[1]) return { label: "Good", rgb: AMBER };
  return { label: "Average", rgb: RED };
}
function rateLowerBetter(v: number, low: number, high: number): Rating {
  if (v <= low) return { label: "Low", rgb: GREEN };
  if (v <= high) return { label: "Moderate", rgb: AMBER };
  return { label: "High", rgb: RED };
}

function drawHeader(doc: jsPDF, simId: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, pageW, 46, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 46, pageW, 2, "F");
  doc.setTextColor(20, 184, 166);
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("ENGINEAI", 40, 29);
  doc.setTextColor(180, 180, 185);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`Simulation ID: ${simId}`, pageW / 2, 29, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 40, 29, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 231);
    doc.line(40, h - 30, pageW - 40, h - 30);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(107, 114, 128);
    doc.text("Generated by EngineAI", 40, h - 16);
    doc.text(`Page ${i} of ${total}`, pageW - 40, h - 16, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, label: string, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(244, 244, 245);
  doc.rect(40, y - 12, pageW - 80, 18, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(40, y - 12, 3, 18, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(24, 24, 27);
  doc.text(label.toUpperCase(), 50, y);
  return y + 16;
}

function kpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, unit: string, rating: Rating,
) {
  doc.setDrawColor(228, 228, 231);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 4, 4, "FD");
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(107, 114, 128);
  doc.text(label.toUpperCase(), x + 10, y + 14);
  // Fit value + unit on one line with non-breaking gap
  let fs = 16;
  doc.setFont("helvetica", "bold").setFontSize(fs);
  const maxW = w - 20;
  while (doc.getTextWidth(`${value}  ${unit}`) > maxW && fs > 9) {
    fs -= 1;
    doc.setFontSize(fs);
  }
  doc.setTextColor(17, 24, 39);
  const valW = doc.getTextWidth(value);
  doc.text(value, x + 10, y + 34);
  doc.setFont("helvetica", "normal").setFontSize(Math.max(8, fs - 5)).setTextColor(107, 114, 128);
  doc.text(unit, x + 10 + valW + 5, y + 34);
  // Rating badge
  doc.setFont("helvetica", "bold").setFontSize(7);
  const bw = doc.getTextWidth(rating.label) + 14;
  doc.setFillColor(rating.rgb[0], rating.rgb[1], rating.rgb[2]);
  doc.roundedRect(x + w - bw - 10, y + h - 18, bw, 12, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(rating.label, x + w - bw / 2 - 10, y + h - 9, { align: "center" });
}

function buildAnalysis(sim: Sim, r: any): Array<{ title: string; body: string }> {
  const fuelName = sim.fuels?.name ?? "the selected fuel";
  const fuelOk = r.bsfc <= 280;
  const thermOk = r.thermal_efficiency >= 32;
  const mechOk = r.mechanical_efficiency >= 82;
  const noxHigh = r.nox > 800;
  const coHigh = r.co > 0.5;
  const hcHigh = r.hc > 300;
  const co2Note = r.co2 > 750
    ? "on the higher side, which is expected when the engine burns more fuel per unit of work"
    : "within a healthy range for this class of engine";
  const loadBand = sim.load_pct < 40 ? "light" : sim.load_pct < 75 ? "mid" : "high";
  const rpmBand = sim.rpm < 1500 ? "low" : sim.rpm < 2800 ? "mid" : "high";
  const stable = thermOk && mechOk && !noxHigh;

  return [
    {
      title: "1. Fuel Performance",
      body:
        `The engine is running on ${fuelName}. At ${sim.rpm} RPM and ${sim.load_pct}% load, it burns about ${r.fuel_consumption.toFixed(2)} kg of fuel every hour and produces ${r.brake_power.toFixed(2)} kW of useful power at the shaft. ` +
        `The fuel-economy figure (BSFC) is ${r.bsfc.toFixed(1)} g/kWh — ${fuelOk ? "this is a good result. It means most of the fuel is being converted into work and very little is wasted." : "this is higher than ideal. The engine is using more fuel than it should to produce the same amount of work, so there is room to improve."} ` +
        `In short, ${fuelName} is ${fuelOk ? "a suitable match" : "acceptable but not the best match"} for these operating conditions, and the fuel flow is steady and predictable.`,
    },
    {
      title: "2. Engine Efficiency",
      body:
        `Thermal efficiency is ${r.thermal_efficiency.toFixed(1)}%. In plain English, only this share of the energy stored in the fuel becomes mechanical power — the rest leaves as heat through the exhaust, the cooling system, and the engine surfaces. ${thermOk ? "This is a healthy number for a real engine." : "This is on the low side, which suggests more heat is being lost than expected."} ` +
        `Mechanical efficiency is ${r.mechanical_efficiency.toFixed(1)}%, which tells us how much power survives internal friction from pistons, bearings and pumps. ${mechOk ? "Friction losses look reasonable here." : "Friction losses look high, which often happens at very high RPM."} ` +
        `Volumetric efficiency of ${r.volumetric_efficiency.toFixed(1)}% shows how well the cylinders are being filled with fresh air on each stroke — the higher this number, the cleaner and stronger the combustion.`,
    },
    {
      title: "3. Emission Behavior",
      body:
        `CO (carbon monoxide) is ${r.co.toFixed(3)} vol% — ${coHigh ? "a little high, which usually means the air-fuel mix is too rich and some fuel is not fully burning." : "low, meaning the fuel is burning almost completely."} ` +
        `CO₂ is ${r.co2.toFixed(1)} g/kWh, which is ${co2Note}. ` +
        `HC (unburnt hydrocarbons) is ${r.hc.toFixed(0)} ppm — ${hcHigh ? "elevated, pointing to small pockets of fuel that did not fully combust." : "low, indicating clean and complete combustion."} ` +
        `NOx is ${r.nox.toFixed(0)} ppm. NOx forms when the temperature inside the cylinder gets very hot, so ${noxHigh ? "a high NOx reading like this is a direct sign of high peak combustion temperatures — common at heavy load." : "a value in this range tells us combustion temperatures are under control."}`,
    },
    {
      title: "4. Operating Point Assessment",
      body:
        `The engine is running in the ${rpmBand}-RPM range at a ${loadBand}-load condition. ${stable ? "This combination is well balanced — power, fuel use, and emissions all sit inside a stable and predictable envelope, which is ideal for steady, long-duration running." : "This combination is workable but not ideal — at least one of efficiency, friction, or emissions sits outside its comfort zone, so the engine will be more sensitive to small changes in load or temperature."} ` +
        `The model's confidence at this point is ${r.confidence.toFixed(1)}%, meaning the predictions above are ${r.confidence > 80 ? "highly reliable" : r.confidence > 60 ? "reasonably reliable" : "indicative only and should be confirmed on a test bench"}. ` +
        `Overall rating: ${stable && fuelOk ? "Excellent — current calibration can be kept as-is." : fuelOk || stable ? "Good — small tuning changes will lift performance further." : "Average — review the optimization recommendations on the next page before extended operation."}`,
    },
  ];
}


export function exportSimulationPdf(sim: Sim, res: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const simId = String(sim.id).slice(0, 8).toUpperCase();
  const { recs, best } = recommend(sim, res);
  const sweep = buildSweep(sim);

  // ===== PAGE 1 — OVERVIEW & RESULTS =====
  drawHeader(doc, simId);
  let y = 70;
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(17, 24, 39);
  doc.text("Engine Simulation Report", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 114, 128);
  doc.text(
    `${sim.fuels?.name ?? "—"} on ${sim.engines?.name ?? "—"}  ·  ${sim.rpm} RPM  ·  ${sim.load_pct}% Load`,
    40, y + 14,
  );
  y += 34;

  y = sectionTitle(doc, "Simulation Information", y);
  const e = sim.engines ?? {}; const f = sim.fuels ?? {};
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [39, 39, 42] },
    headStyles: { fillColor: [24, 24, 27], textColor: [244, 244, 245], fontSize: 8 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [250, 250, 252] },
      2: { fontStyle: "bold", fillColor: [250, 250, 252] },
    },
    head: [["Parameter", "Value", "Parameter", "Value"]],
    body: [
      ["Fuel", `${f.name ?? "—"} (${f.fuel_type ?? "—"})`, "Engine", `${e.name ?? "—"}`],
      ["Engine Type", e.engine_type ?? "—", "Cylinders", String(e.cylinders ?? "—")],
      ["RPM", String(sim.rpm), "Load", `${sim.load_pct}%`],
      ["Compression Ratio", String(e.compression_ratio ?? "—"), "Displacement", `${e.displacement ?? "—"} L`],
      ["Bore", `${e.bore ?? "—"} mm`, "Stroke", `${e.stroke ?? "—"} mm`],
      ["Intake Temp", `${sim.intake_temp} °C`, "Intake Pressure", `${sim.intake_pressure} bar`],
      ["Ambient Temp", `${sim.ambient_temp} °C`, "Date", new Date(sim.created_at ?? Date.now()).toLocaleDateString()],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  y = sectionTitle(doc, "Performance KPIs", y);
  const kpis: Array<[string, string, string, Rating]> = [
    ["Torque", res.torque?.toFixed(1), "Nm", rateBetween(res.torque, [200, 1000], [100, 1500])],
    ["Brake Power", res.brake_power?.toFixed(2), "kW", rateBetween(res.brake_power, [50, 400], [20, 600])],
    ["Fuel Consumption", res.fuel_consumption?.toFixed(2), "kg/h", rateLowerBetter(res.fuel_consumption, 15, 35)],
    ["BSFC", res.bsfc?.toFixed(1), "g/kWh", rateLowerBetter(res.bsfc, 230, 290)],
    ["Thermal Efficiency", res.thermal_efficiency?.toFixed(1), "%", rateBetween(res.thermal_efficiency, [35, 55], [28, 60])],
    ["Mechanical Efficiency", res.mechanical_efficiency?.toFixed(1), "%", rateBetween(res.mechanical_efficiency, [85, 95], [75, 100])],
  ];
  const gap = 12;
  const cardW = (pageW - 80 - gap * 2) / 3;
  const cardH = 72;
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    kpiCard(doc, 40 + col * (cardW + gap), y + row * (cardH + gap), cardW, cardH, k[0], k[1], k[2], k[3]);
  });
  y += 2 * (cardH + gap) + 6;

  y = sectionTitle(doc, "Emission Results", y);
  const emi: Array<[string, number, string, Rating]> = [
    ["CO", res.co, "vol%", rateLowerBetter(res.co, 0.3, 1.0)],
    ["CO2", res.co2, "g/kWh", rateLowerBetter(res.co2, 600, 850)],
    ["HC", res.hc, "ppm", rateLowerBetter(res.hc, 150, 350)],
    ["NOx", res.nox, "ppm", rateLowerBetter(res.nox, 400, 800)],
  ];
  const eW = (pageW - 80 - 24) / 4;
  emi.forEach((m, i) => {
    kpiCard(doc, 40 + i * (eW + 8), y, eW, 50, m[0], m[1].toFixed(m[0] === "CO" ? 3 : 1), m[2], m[3]);
  });
  y += 58;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255] },
    head: [["Pollutant", "Value", "Unit", "Assessment"]],
    body: emi.map((m) => [m[0], m[1].toFixed(m[0] === "CO" ? 3 : 1), m[2], m[3].label]),
  });

  // ===== PAGE 2 — CHARTS =====
  doc.addPage();
  drawHeader(doc, simId);
  y = 70;
  y = sectionTitle(doc, "Engineering Charts", y);
  const charts: Array<[string, string, string]> = [
    ["torque", "Torque (Nm)", "#14b8a6"],
    ["thermal_efficiency", "Thermal Efficiency (%)", "#a78bfa"],
    ["fuel_consumption", "Fuel Consumption (kg/h)", "#60a5fa"],
  ];
  charts.forEach(([k, label, color]) => {
    const png = lineChartPng(sweep, k, label, color);
    doc.addImage(png, "PNG", 40, y, pageW - 80, 200);
    y += 216;
  });

  // ===== PAGE 3 — AI ANALYSIS =====
  doc.addPage();
  drawHeader(doc, simId);
  y = 70;
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(17, 24, 39);
  doc.text("AI Technical Analysis", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 114, 128);
  doc.text("Plain-English interpretation of the simulation results.", 40, y + 14);
  y += 30;
  y = sectionTitle(doc, "Insights", y);
  buildAnalysis(sim, res).forEach((blk) => {
    if (y > 740) { doc.addPage(); drawHeader(doc, simId); y = 70; }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20, 184, 166);
    doc.text(blk.title, 40, y);
    y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40, 45, 55);
    const lines = doc.splitTextToSize(blk.body, pageW - 80);
    doc.text(lines, 40, y, { lineHeightFactor: 1.45 });
    y += lines.length * 14 + 16;
  });

  // ===== PAGE 4 — OPTIMIZATION =====
  doc.addPage();
  drawHeader(doc, simId);
  y = 70;
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(17, 24, 39);
  doc.text("Optimization Recommendations", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 114, 128);
  doc.text("Comparison of the current operating point against the optimizer's preferred configuration.", 40, y + 14);
  y += 30;

  const optPt = sweep.reduce((a, b) => (b.bsfc < a.bsfc ? b : a));
  const deltaEff = optPt.thermal_efficiency - res.thermal_efficiency;
  const deltaNox = ((optPt.nox - res.nox) / Math.max(res.nox, 1)) * 100;
  const deltaPower = ((optPt.brake_power - res.brake_power) / Math.max(res.brake_power, 0.01)) * 100;
  const deltaFC = ((optPt.fuel_consumption - res.fuel_consumption) / Math.max(res.fuel_consumption, 0.01)) * 100;

  y = sectionTitle(doc, "Current vs Optimized", y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 7 },
    headStyles: { fillColor: [20, 184, 166], textColor: [255, 255, 255], fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [250, 250, 252] } },
    head: [["Parameter", "Current", "Optimized", "Delta"]],
    body: [
      ["Fuel", sim.fuels?.name ?? "—", best, "—"],
      ["RPM", String(sim.rpm), String(optPt.rpm), `${optPt.rpm - sim.rpm > 0 ? "+" : ""}${optPt.rpm - sim.rpm}`],
      ["Thermal Efficiency (%)", res.thermal_efficiency.toFixed(2), optPt.thermal_efficiency.toFixed(2), `${deltaEff >= 0 ? "+" : ""}${deltaEff.toFixed(2)}%`],
      ["NOx (ppm)", res.nox.toFixed(1), optPt.nox.toFixed(1), `${deltaNox >= 0 ? "+" : ""}${deltaNox.toFixed(1)}%`],
      ["Fuel Consumption (kg/h)", res.fuel_consumption.toFixed(3), optPt.fuel_consumption.toFixed(3), `${deltaFC >= 0 ? "+" : ""}${deltaFC.toFixed(1)}%`],
      ["Brake Power (kW)", res.brake_power.toFixed(2), optPt.brake_power.toFixed(2), `${deltaPower >= 0 ? "+" : ""}${deltaPower.toFixed(1)}%`],
      ["BSFC (g/kWh)", res.bsfc.toFixed(1), optPt.bsfc.toFixed(1), `${(((optPt.bsfc - res.bsfc) / res.bsfc) * 100).toFixed(1)}%`],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Optimization insights paragraph
  y = sectionTitle(doc, "Why the Optimizer Chose This Configuration", y);
  const insightBody =
    `The optimizer scanned the RPM range and picked ${optPt.rpm} RPM with ${best} because this combination delivers the lowest BSFC (${optPt.bsfc.toFixed(1)} g/kWh) while keeping NOx ${deltaNox <= 0 ? "lower" : "within acceptable limits"} and power ${deltaPower >= 0 ? "comparable to or higher than" : "close to"} the current setting. ` +
    `In simple terms, the engine reaches its sweet spot here — fuel is converted to work more efficiently, friction losses are smaller relative to the work produced, and peak combustion temperatures stay in a healthier range. ` +
    `Moving to this operating point trades a small change in engine speed for noticeable gains in efficiency and a cleaner emission profile.`;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40, 45, 55);
  const insightLines = doc.splitTextToSize(insightBody, pageW - 80);
  doc.text(insightLines, 40, y, { lineHeightFactor: 1.45 });
  y += insightLines.length * 14 + 14;

  // Summary checklist
  y = sectionTitle(doc, "Summary of Benefits", y);
  const benefits: Array<[string, string]> = [
    ["Lower fuel consumption", `${deltaFC <= 0 ? `Fuel use drops by ${Math.abs(deltaFC).toFixed(1)}%` : `Fuel use changes by ${deltaFC.toFixed(1)}%`} at the optimized point.`],
    ["Improved stability", "The engine runs in a more predictable load–speed window for steady operation."],
    ["Reduced emissions", `${deltaNox <= 0 ? `NOx falls by ${Math.abs(deltaNox).toFixed(1)}%` : `NOx change of ${deltaNox.toFixed(1)}% — review if elevated`}, with cleaner combustion overall.`],
    ["Better efficiency", `Thermal efficiency ${deltaEff >= 0 ? "improves" : "shifts"} by ${Math.abs(deltaEff).toFixed(2)} percentage points.`],
  ];
  doc.setFont("helvetica", "normal").setFontSize(10);
  benefits.forEach(([title, desc]) => {
    doc.setTextColor(22, 163, 74).setFont("helvetica", "bold").setFontSize(12);
    doc.text("\u2713", 42, y);
    doc.setTextColor(17, 24, 39).setFontSize(10);
    doc.text(title, 58, y);
    const titleW = doc.getTextWidth(title);
    doc.setFont("helvetica", "normal").setTextColor(75, 85, 99);
    const descLines = doc.splitTextToSize(` — ${desc}`, pageW - 80 - 22 - titleW);
    doc.text(descLines, 58 + titleW, y);
    y += Math.max(14, descLines.length * 13) + 4;
  });
  y += 6;

  // Callout box
  if (y > 720) { /* keep on same page if possible */ }
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(20, 184, 166);
  doc.roundedRect(40, y, pageW - 80, 70, 6, 6, "FD");
  doc.setFillColor(20, 184, 166);
  doc.rect(40, y, 4, 70, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(15, 118, 110);
  doc.text("RECOMMENDATION NOTE", 56, y + 16);
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(40, 45, 55);
  const calloutBody =
    `For long-duration operation, run the engine close to ${optPt.rpm} RPM with ${best}. This setting offers the best balance of fuel economy, stable output, and lower emissions over extended runtime. ` +
    `Short bursts at other operating points are fine, but sustained running at the current configuration will consume more fuel and stress the engine more than necessary.`;
  const calloutLines = doc.splitTextToSize(calloutBody, pageW - 80 - 28);
  doc.text(calloutLines, 56, y + 32, { lineHeightFactor: 1.4 });

  drawFooter(doc);
  doc.save(`Simulation_Report_${simId}.pdf`);
}

// ============================================================
// Excel export — professional engineering-grade workbook
// ============================================================

type Cell = { v: any; t?: "s" | "n" | "b"; s?: any };
type Row = Cell[];

const BORDER_THIN = { style: "thin", color: { rgb: "D4D4D8" } };
const BORDER_ALL = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

const STYLE_TITLE = {
  font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: BORDER_ALL,
};
const STYLE_SUBTITLE = {
  font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "D4D4D8" } },
  fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: BORDER_ALL,
};
const STYLE_SECTION = {
  font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "14B8A6" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: BORDER_ALL,
};
const STYLE_HEADER = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "18181B" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: BORDER_ALL,
};
const STYLE_LABEL = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "27272A" } },
  fill: { patternType: "solid", fgColor: { rgb: "F4F4F5" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: BORDER_ALL,
};
const STYLE_VAL = (alt: boolean) => ({
  font: { name: "Calibri", sz: 10, color: { rgb: "18181B" } },
  fill: { patternType: "solid", fgColor: { rgb: alt ? "FAFAFA" : "FFFFFF" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: BORDER_ALL,
});
const STYLE_NUM = (alt: boolean) => ({
  font: { name: "Calibri", sz: 10, color: { rgb: "18181B" } },
  fill: { patternType: "solid", fgColor: { rgb: alt ? "FAFAFA" : "FFFFFF" } },
  alignment: { horizontal: "right", vertical: "center" },
  border: BORDER_ALL,
  numFmt: "#,##0.000",
});
const STYLE_UNIT = (alt: boolean) => ({
  font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "6B7280" } },
  fill: { patternType: "solid", fgColor: { rgb: alt ? "FAFAFA" : "FFFFFF" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: BORDER_ALL,
});
const STYLE_WRAP = {
  font: { name: "Calibri", sz: 10, color: { rgb: "18181B" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
  alignment: { horizontal: "left", vertical: "top", wrapText: true },
  border: BORDER_ALL,
};
const STYLE_WRAP_TITLE = {
  font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "14B8A6" } },
  fill: { patternType: "solid", fgColor: { rgb: "F4F4F5" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: BORDER_ALL,
};

function txt(v: any, s?: any): Cell { return { v: v ?? "—", t: "s", s }; }
function num(v: any, s?: any): Cell {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return { v: "—", t: "s", s };
  return { v: Number(v), t: "n", s };
}

function autoColWidths(rows: Row[], min = 10, max = 60): Array<{ wch: number }> {
  const widths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const s = cell?.v == null ? "" : String(cell.v);
      const longest = s.split("\n").reduce((a, b) => Math.max(a, b.length), 0);
      widths[i] = Math.max(widths[i] ?? min, Math.min(longest + 2, max));
    });
  });
  return widths.map((w) => ({ wch: Math.max(min, w) }));
}

function autoRowHeights(rows: Row[], colWidths: Array<{ wch: number }>): Array<{ hpt: number }> {
  return rows.map((row) => {
    let maxLines = 1;
    row.forEach((cell, i) => {
      if (!cell) return;
      const s = cell.v == null ? "" : String(cell.v);
      const w = colWidths[i]?.wch ?? 10;
      const explicit = s.split("\n").length;
      const wrapped = Math.ceil(s.length / Math.max(w - 1, 1));
      maxLines = Math.max(maxLines, explicit, wrapped);
    });
    return { hpt: Math.min(18 + (maxLines - 1) * 15, 220) };
  });
}

function makeSheet(rows: Row[], opts: {
  merges?: XLSX.Range[];
  freeze?: { xSplit?: number; ySplit?: number };
  filter?: string;
  colMin?: number;
  colMax?: number;
} = {}) {
  const ws: XLSX.WorkSheet = {} as any;
  const range = { s: { c: 0, r: 0 }, e: { c: 0, r: rows.length - 1 } };
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const addr = XLSX.utils.encode_cell({ c, r });
      (ws as any)[addr] = cell;
      if (c > range.e.c) range.e.c = c;
    });
  });
  ws["!ref"] = XLSX.utils.encode_range(range);
  const cols = autoColWidths(rows, opts.colMin ?? 12, opts.colMax ?? 55);
  ws["!cols"] = cols;
  ws["!rows"] = autoRowHeights(rows, cols);
  if (opts.merges) ws["!merges"] = opts.merges;
  if (opts.freeze) {
    (ws as any)["!freeze"] = opts.freeze;
    (ws as any)["!views"] = [{ state: "frozen", xSplit: opts.freeze.xSplit ?? 0, ySplit: opts.freeze.ySplit ?? 0 }];
  }
  if (opts.filter) ws["!autofilter"] = { ref: opts.filter };
  return ws;
}

function pageBanner(title: string, subtitle: string, span: number): { rows: Row[]; merges: XLSX.Range[] } {
  return {
    rows: [
      [txt(title, STYLE_TITLE), ...Array(span - 1).fill({ v: "", s: STYLE_TITLE })],
      [txt(subtitle, STYLE_SUBTITLE), ...Array(span - 1).fill({ v: "", s: STYLE_SUBTITLE })],
      Array(span).fill({ v: "", s: undefined }),
    ],
    merges: [
      { s: { c: 0, r: 0 }, e: { c: span - 1, r: 0 } },
      { s: { c: 0, r: 1 }, e: { c: span - 1, r: 1 } },
    ],
  };
}

function sectionBar(label: string, span: number): Row {
  return [txt(label, STYLE_SECTION), ...Array(span - 1).fill({ v: "", s: STYLE_SECTION })];
}

export function exportSimulationXlsx(sim: Sim, res: any) {
  const simId = String(sim.id).slice(0, 8).toUpperCase();
  const { recs, best } = recommend(sim, res);
  const sweep = buildSweep(sim);
  const wb = XLSX.utils.book_new();
  const f = sim.fuels ?? {};
  const e = sim.engines ?? {};
  const generated = new Date().toLocaleString();

  // ===== Sheet 1 — Executive Summary =====
  {
    const span = 4;
    const banner = pageBanner("EngineAI Simulation Report", `Executive Summary  ·  Generated ${generated}`, span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];

    rows.push(sectionBar("Simulation Information", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    rows.push([txt("Field", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Field", STYLE_HEADER), txt("Value", STYLE_HEADER)]);
    const info: Array<[string, any, string, any]> = [
      ["Simulation ID", simId, "Generated", generated],
      ["Fuel", f.name, "Fuel Type", f.fuel_type],
      ["Engine", e.name, "Engine Type", e.engine_type],
      ["RPM", sim.rpm, "Load (%)", sim.load_pct],
      ["Intake Temp (°C)", sim.intake_temp, "Intake Pressure (bar)", sim.intake_pressure],
      ["Ambient Temp (°C)", sim.ambient_temp, "Date", new Date(sim.created_at ?? Date.now()).toLocaleDateString()],
    ];
    info.forEach((r, i) => {
      const alt = i % 2 === 1;
      rows.push([txt(r[0], STYLE_LABEL), txt(r[1], STYLE_VAL(alt)), txt(r[2], STYLE_LABEL), txt(r[3], STYLE_VAL(alt))]);
    });
    rows.push(Array(span).fill({ v: "" }));

    rows.push(sectionBar("Key Results", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    rows.push([txt("Metric", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Unit", STYLE_HEADER), txt("Category", STYLE_HEADER)]);
    const key: Array<[string, number, string, string]> = [
      ["Torque", res.torque, "Nm", "Performance"],
      ["Brake Power", res.brake_power, "kW", "Performance"],
      ["Thermal Efficiency", res.thermal_efficiency, "%", "Performance"],
      ["Fuel Consumption", res.fuel_consumption, "kg/h", "Performance"],
      ["BSFC", res.bsfc, "g/kWh", "Performance"],
      ["CO", res.co, "vol%", "Emissions"],
      ["CO₂", res.co2, "g/kWh", "Emissions"],
      ["HC", res.hc, "ppm", "Emissions"],
      ["NOx", res.nox, "ppm", "Emissions"],
    ];
    key.forEach((r, i) => {
      const alt = i % 2 === 1;
      rows.push([txt(r[0], STYLE_LABEL), num(r[1], STYLE_NUM(alt)), txt(r[2], STYLE_UNIT(alt)), txt(r[3], STYLE_VAL(alt))]);
    });

    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 3 } }), "Executive Summary");
  }

  // ===== Sheet 2 — Fuel Properties =====
  {
    const span = 3;
    const banner = pageBanner("Fuel Properties", `${f.name ?? "—"}  ·  Type: ${f.fuel_type ?? "—"}`, span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];
    rows.push([txt("Property", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Unit", STYLE_HEADER)]);
    const data: Array<[string, any, string]> = [
      ["Name", f.name, ""],
      ["Fuel Type", f.fuel_type, ""],
      ["Calorific Value", f.calorific_value, "MJ/kg"],
      ["Density", f.density, "kg/m³"],
      ["Air/Fuel Ratio", f.air_fuel_ratio, ""],
      ["Cetane Number", f.cetane_number, ""],
      ["Octane Number", f.octane_number, ""],
      ["Carbon Fraction", f.carbon_fraction, ""],
    ];
    data.forEach((r, i) => {
      const alt = i % 2 === 1;
      const isNum = typeof r[1] === "number";
      rows.push([txt(r[0], STYLE_LABEL), isNum ? num(r[1], STYLE_NUM(alt)) : txt(r[1], STYLE_VAL(alt)), txt(r[2], STYLE_UNIT(alt))]);
    });
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 4 } }), "Fuel Properties");
  }

  // ===== Sheet 3 — Engine Specs =====
  {
    const span = 3;
    const banner = pageBanner("Engine Specifications", `${e.name ?? "—"}  ·  Type: ${e.engine_type ?? "—"}`, span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];
    rows.push([txt("Specification", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Unit", STYLE_HEADER)]);
    const data: Array<[string, any, string]> = [
      ["Name", e.name, ""],
      ["Engine Type", e.engine_type, ""],
      ["Cylinders", e.cylinders, ""],
      ["Bore", e.bore, "mm"],
      ["Stroke", e.stroke, "mm"],
      ["Compression Ratio", e.compression_ratio, ""],
      ["Displacement", e.displacement, "L"],
      ["Cooling Method", e.cooling_method ?? e.cooling, ""],
    ];
    data.forEach((r, i) => {
      const alt = i % 2 === 1;
      const isNum = typeof r[1] === "number";
      rows.push([txt(r[0], STYLE_LABEL), isNum ? num(r[1], STYLE_NUM(alt)) : txt(r[1], STYLE_VAL(alt)), txt(r[2], STYLE_UNIT(alt))]);
    });
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 4 } }), "Engine Specs");
  }

  // ===== Sheet 4 — Performance =====
  {
    const span = 3;
    const banner = pageBanner("Performance Metrics", `Operating point: ${sim.rpm} RPM @ ${sim.load_pct}% load`, span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];
    rows.push([txt("Metric", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Unit", STYLE_HEADER)]);
    const data: Array<[string, number, string]> = [
      ["Torque", res.torque, "Nm"],
      ["Brake Power", res.brake_power, "kW"],
      ["Indicated Power", res.indicated_power, "kW"],
      ["Fuel Consumption", res.fuel_consumption, "kg/h"],
      ["BSFC", res.bsfc, "g/kWh"],
      ["Thermal Efficiency", res.thermal_efficiency, "%"],
      ["Mechanical Efficiency", res.mechanical_efficiency, "%"],
      ["Volumetric Efficiency", res.volumetric_efficiency, "%"],
      ["Confidence", res.confidence, "%"],
    ];
    data.forEach((r, i) => {
      const alt = i % 2 === 1;
      rows.push([txt(r[0], STYLE_LABEL), num(r[1], STYLE_NUM(alt)), txt(r[2], STYLE_UNIT(alt))]);
    });
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 4 } }), "Performance");
  }

  // ===== Sheet 5 — Emissions =====
  {
    const span = 3;
    const banner = pageBanner("Emission Results", "Tail-pipe pollutant levels at the current operating point", span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];
    rows.push([txt("Pollutant", STYLE_HEADER), txt("Value", STYLE_HEADER), txt("Unit", STYLE_HEADER)]);
    const data: Array<[string, number, string]> = [
      ["CO", res.co, "vol%"],
      ["CO₂", res.co2, "g/kWh"],
      ["HC", res.hc, "ppm"],
      ["NOx", res.nox, "ppm"],
      ["Smoke", res.smoke, "FSN"],
    ];
    data.forEach((r, i) => {
      const alt = i % 2 === 1;
      rows.push([txt(r[0], STYLE_LABEL), num(r[1], STYLE_NUM(alt)), txt(r[2], STYLE_UNIT(alt))]);
    });
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 4 } }), "Emissions");
  }

  // ===== Sheet 6 — AI Analysis =====
  {
    const span = 2;
    const banner = pageBanner("AI Technical Analysis", "Plain-English interpretation of the simulation", span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];
    rows.push([txt("Section", STYLE_HEADER), txt("Analysis", STYLE_HEADER)]);
    buildAnalysis(sim, res).forEach((blk) => {
      rows.push([txt(blk.title, STYLE_WRAP_TITLE), txt(blk.body, STYLE_WRAP)]);
    });
    const ws = makeSheet(rows, { merges, freeze: { ySplit: 4 }, colMin: 20, colMax: 110 });
    ws["!cols"] = [{ wch: 28 }, { wch: 110 }];
    // Recompute row heights with explicit final widths
    ws["!rows"] = autoRowHeights(rows, ws["!cols"] as any);
    XLSX.utils.book_append_sheet(wb, ws, "AI Analysis");
  }

  // ===== Sheet 7 — Optimization =====
  {
    const optPt = sweep.reduce((a, b) => (b.bsfc < a.bsfc ? b : a));
    const dEff = optPt.thermal_efficiency - res.thermal_efficiency;
    const dNoxPct = ((optPt.nox - res.nox) / Math.max(res.nox, 1)) * 100;
    const dFcPct = ((optPt.fuel_consumption - res.fuel_consumption) / Math.max(res.fuel_consumption, 0.01)) * 100;
    const dPowerPct = ((optPt.brake_power - res.brake_power) / Math.max(res.brake_power, 0.01)) * 100;

    const span = 4;
    const banner = pageBanner("Optimization Recommendations", "Current vs Recommended operating configuration", span);
    const rows: Row[] = [...banner.rows];
    const merges: XLSX.Range[] = [...banner.merges];

    rows.push(sectionBar("Configuration Comparison", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    rows.push([
      txt("Parameter", STYLE_HEADER),
      txt("Current Config", STYLE_HEADER),
      txt("Recommended Config", STYLE_HEADER),
      txt("Unit", STYLE_HEADER),
    ]);
    const comp: Array<[string, any, any, string]> = [
      ["Fuel", f.name, best, ""],
      ["RPM", sim.rpm, optPt.rpm, ""],
      ["Thermal Efficiency", res.thermal_efficiency, optPt.thermal_efficiency, "%"],
      ["Fuel Consumption", res.fuel_consumption, optPt.fuel_consumption, "kg/h"],
      ["BSFC", res.bsfc, optPt.bsfc, "g/kWh"],
      ["Brake Power", res.brake_power, optPt.brake_power, "kW"],
      ["NOx", res.nox, optPt.nox, "ppm"],
    ];
    comp.forEach((r, i) => {
      const alt = i % 2 === 1;
      const a = typeof r[1] === "number" ? num(r[1], STYLE_NUM(alt)) : txt(r[1], STYLE_VAL(alt));
      const b = typeof r[2] === "number" ? num(r[2], STYLE_NUM(alt)) : txt(r[2], STYLE_VAL(alt));
      rows.push([txt(r[0], STYLE_LABEL), a, b, txt(r[3], STYLE_UNIT(alt))]);
    });
    rows.push(Array(span).fill({ v: "" }));

    rows.push(sectionBar("Expected Improvements", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    rows.push([txt("Improvement", STYLE_HEADER), txt("Delta", STYLE_HEADER), txt("Unit", STYLE_HEADER), txt("Direction", STYLE_HEADER)]);
    const imp: Array<[string, number, string, string]> = [
      ["Fuel Consumption Reduction", -dFcPct, "%", dFcPct < 0 ? "Better" : "Worse"],
      ["Efficiency Improvement", dEff, "% points", dEff > 0 ? "Better" : "Worse"],
      ["NOx Reduction", -dNoxPct, "%", dNoxPct < 0 ? "Better" : "Worse"],
      ["Power Change", dPowerPct, "%", dPowerPct >= 0 ? "Better" : "Worse"],
    ];
    imp.forEach((r, i) => {
      const alt = i % 2 === 1;
      rows.push([txt(r[0], STYLE_LABEL), num(r[1], STYLE_NUM(alt)), txt(r[2], STYLE_UNIT(alt)), txt(r[3], STYLE_VAL(alt))]);
    });
    rows.push(Array(span).fill({ v: "" }));

    rows.push(sectionBar("Optimization Notes", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    recs.forEach((rec, i) => {
      const cell = txt(`• ${rec}`, STYLE_WRAP);
      rows.push([cell, { v: "", s: STYLE_WRAP }, { v: "", s: STYLE_WRAP }, { v: "", s: STYLE_WRAP }]);
      merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    });
    rows.push(Array(span).fill({ v: "" }));

    rows.push(sectionBar("RPM Sweep (Engineering Reference)", span));
    merges.push({ s: { c: 0, r: rows.length - 1 }, e: { c: span - 1, r: rows.length - 1 } });
    const sweepHead = ["RPM", "Torque (Nm)", "Brake Power (kW)", "BSFC (g/kWh)", "Thermal Eff (%)", "NOx (ppm)", "CO (vol%)", "HC (ppm)"];
    rows.push(sweepHead.map((h) => txt(h, STYLE_HEADER)));
    const sweepStart = rows.length;
    sweep.forEach((p, i) => {
      const alt = i % 2 === 1;
      rows.push([
        num(p.rpm, STYLE_NUM(alt)),
        num(p.torque, STYLE_NUM(alt)),
        num(p.brake_power, STYLE_NUM(alt)),
        num(p.bsfc, STYLE_NUM(alt)),
        num(p.thermal_efficiency, STYLE_NUM(alt)),
        num(p.nox, STYLE_NUM(alt)),
        num(p.co, STYLE_NUM(alt)),
        num(p.hc, STYLE_NUM(alt)),
      ]);
    });
    const sweepEnd = rows.length - 1;
    const filterRef = `A${sweepStart}:${XLSX.utils.encode_col(sweepHead.length - 1)}${sweepEnd + 1}`;
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, { merges, freeze: { ySplit: 3 }, filter: filterRef }), "Optimization");
  }

  const out = XLSXStyle.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `EngineAI_Report_${simId}.xlsx`,
  );
}

