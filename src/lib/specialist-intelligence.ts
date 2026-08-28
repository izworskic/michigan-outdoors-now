import type { Destination, SpecialistSignal, WeatherSnapshot } from "./types";

const requestTimeoutMs = 7_000;
const auroraForecastUrl = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";

type RiverGauge = {
  site: string;
  name: string;
};

const riverGaugeByDestination: Record<string, RiverGauge> = {
  "au-sable-mio": { site: "04136500", name: "Au Sable River at Mio" },
  "lumbermans-monument": { site: "04136500", name: "Au Sable River at Mio" },
  "rifle-river": { site: "04142000", name: "Rifle River near Sterling" },
};

const beachSlugByDestination: Record<string, string> = {
  "bay-city-state-park": "bay-city-state-park",
  "tawas-point": "tawas-point-state-park",
  "whitefish-point": "whitefish-point",
  "presque-isle-marquette": "presque-isle-park",
  "wilderness-state-park": "wilderness-state-park",
  "ludington-state-park": "ludington-state-park",
  "holland-state-park": "holland-state-park",
  "warren-dunes": "warren-dunes-state-park",
  "grand-haven-state-park": "grand-haven-state-park",
  "silver-lake-state-park": "silver-lake-state-park",
  "petoskey-state-park": "petoskey-state-park",
  "port-crescent-state-park": "port-crescent-state-park",
  "mclain-state-park": "mclain-state-park",
};

export function auroraThresholdForLatitude(latitude: number) {
  if (latitude >= 46) return 4;
  if (latitude >= 44.8) return 5;
  if (latitude >= 43.5) return 6;
  return 7;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z");
  return Number.isFinite(date.getTime()) ? date : null;
}

type KpPoint = {
  time: Date;
  kp: number;
  observed: string;
};

export function parseKpForecast(payload: unknown): KpPoint[] {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) return [];
  const header = payload[0].map((value) => String(value));
  const timeIndex = header.findIndex((value) => /time_tag/i.test(value));
  const kpIndex = header.findIndex((value) => /^kp$/i.test(value));
  const observedIndex = header.findIndex((value) => /observed/i.test(value));
  if (timeIndex < 0 || kpIndex < 0) return [];

  return payload
    .slice(1)
    .filter(Array.isArray)
    .map((row) => {
      const time = isoTime(row[timeIndex]);
      const kp = numberValue(row[kpIndex]);
      if (!time || kp === null) return null;
      return {
        time,
        kp,
        observed: observedIndex >= 0 ? String(row[observedIndex] ?? "") : "",
      };
    })
    .filter((point): point is KpPoint => point !== null)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

async function fetchAuroraSignal(
  destination: Destination,
  weather: WeatherSnapshot | null,
): Promise<SpecialistSignal | null> {
  if (!destination.activities.includes("dark-sky")) return null;

  try {
    const response = await fetch(auroraForecastUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(requestTimeoutMs),
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error(`SWPC returned ${response.status}`);

    const points = parseKpForecast(await response.json());
    if (!points.length) return null;

    const now = Date.now();
    const horizon = now + 18 * 60 * 60 * 1_000;
    const upcoming = points.filter((point) => point.time.getTime() >= now - 3 * 60 * 60 * 1_000 && point.time.getTime() <= horizon);
    const relevant = upcoming.length ? upcoming : points.slice(-8);
    const peakKp = Math.max(...relevant.map((point) => point.kp));
    const latestObserved = [...points]
      .reverse()
      .find((point) => point.time.getTime() <= now && /observed|estimated/i.test(point.observed));
    const currentKp = latestObserved?.kp ?? [...points].reverse().find((point) => point.time.getTime() <= now)?.kp ?? null;
    const threshold = auroraThresholdForLatitude(destination.latitude);
    const clouds = weather?.cloudCover ?? null;
    const active = peakKp >= threshold;

    let headline = `Peak Kp ${peakKp.toFixed(1)} in the next 18 hours`;
    let detail = `This guide uses Kp ${threshold}+ as a conservative planning signal at this latitude.`;

    if (active && clouds !== null && clouds >= 60) {
      headline = `Space weather is active; clouds are the problem`;
      detail = `Peak Kp reaches ${peakKp.toFixed(1)}, but the place forecast averages about ${Math.round(clouds)}% cloud cover. Recheck the live aurora tool before driving.`;
    } else if (active) {
      headline = `Aurora is worth watching from here`;
      detail = `Peak Kp reaches ${peakKp.toFixed(1)} versus a Kp ${threshold} planning threshold here${clouds === null ? "" : `, with about ${Math.round(clouds)}% average cloud cover`}. This is a planning signal, not a visibility guarantee.`;
    } else {
      detail = `Peak Kp is ${peakKp.toFixed(1)} versus a Kp ${threshold} planning threshold here${currentKp === null ? "" : `; current Kp is about ${currentKp.toFixed(1)}`}. Local darkness and clouds still matter.`;
    }

    return {
      id: "aurora",
      kind: "live",
      label: "Northern lights",
      headline,
      detail,
      sourceLabel: "NOAA Space Weather Prediction Center",
      sourceUrl: auroraForecastUrl,
      toolLabel: "Open Northern Lights Michigan",
      toolUrl: "https://chrisizworski.com/northern-lights-michigan/",
      observedAt: latestObserved?.time.toISOString() ?? null,
    };
  } catch {
    return null;
  }
}

type UsgsValue = {
  values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
  variable?: {
    variableCode?: Array<{ value?: string }>;
    variableDescription?: string;
    unit?: { unitCode?: string };
  };
  sourceInfo?: { siteName?: string };
};

type UsgsPayload = {
  value?: { timeSeries?: UsgsValue[] };
};

function latestUsgsValue(series: UsgsValue | undefined) {
  const item = series?.values?.[0]?.value?.at(-1);
  const value = numberValue(item?.value);
  if (value === null) return null;
  return { value, dateTime: typeof item?.dateTime === "string" ? item.dateTime : null };
}

async function fetchRiverSignal(destination: Destination): Promise<SpecialistSignal | null> {
  const gauge = riverGaugeByDestination[destination.id];
  if (!gauge) return null;

  try {
    const params = new URLSearchParams({
      format: "json",
      sites: gauge.site,
      parameterCd: "00060,00010",
      siteStatus: "all",
    });
    const endpoint = `https://waterservices.usgs.gov/nwis/iv/?${params}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(requestTimeoutMs),
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`USGS returned ${response.status}`);

    const payload = (await response.json()) as UsgsPayload;
    const series = payload.value?.timeSeries ?? [];
    const dischargeSeries = series.find((item) => item.variable?.variableCode?.some((code) => code.value === "00060"));
    const temperatureSeries = series.find((item) => item.variable?.variableCode?.some((code) => code.value === "00010"));
    const discharge = latestUsgsValue(dischargeSeries);
    const temperatureC = latestUsgsValue(temperatureSeries);
    if (!discharge && !temperatureC) return null;

    const pieces: string[] = [];
    if (discharge) pieces.push(`${Math.round(discharge.value).toLocaleString()} cfs`);
    if (temperatureC) pieces.push(`${Math.round((temperatureC.value * 9) / 5 + 32)}°F water`);
    const observedAt = discharge?.dateTime ?? temperatureC?.dateTime ?? null;

    return {
      id: "river",
      kind: "live",
      label: "River now",
      headline: `${gauge.name}: ${pieces.join(" · ")}`,
      detail: "Live USGS readings add river context here. The Michigan Trout Report applies the richer river-specific fishing interpretation, trend context, and fly/lure recommendations.",
      sourceLabel: "U.S. Geological Survey",
      sourceUrl: `https://waterdata.usgs.gov/monitoring-location/USGS-${gauge.site}/`,
      toolLabel: "Open Michigan Trout Report",
      toolUrl: "https://michigantroutreport.com/",
      observedAt,
    };
  } catch {
    return null;
  }
}

function beachCoverageSignal(destination: Destination): SpecialistSignal | null {
  const slug = beachSlugByDestination[destination.id];
  if (!slug) return null;

  return {
    id: "beach",
    kind: "coverage",
    label: "Beach intelligence",
    headline: "This exact shoreline has a live beach report",
    detail: "The specialist report checks BeachGuard notices, NWS swim risk and shoreline alerts, recent waves and water temperature, wind, and local weather. Use it before treating this as a swimming plan.",
    sourceLabel: "Michigan Beach Conditions",
    sourceUrl: `https://chrisizworski.com/great-lakes-beaches/${slug}/`,
    toolLabel: "Open this beach's live report",
    toolUrl: `https://chrisizworski.com/great-lakes-beaches/${slug}/`,
    observedAt: null,
  };
}

export async function fetchSpecialistSignals(
  destination: Destination,
  weather: WeatherSnapshot | null,
): Promise<SpecialistSignal[]> {
  const [aurora, river] = await Promise.all([
    fetchAuroraSignal(destination, weather),
    fetchRiverSignal(destination),
  ]);
  const beach = beachCoverageSignal(destination);

  return [river, aurora, beach].filter((signal): signal is SpecialistSignal => signal !== null);
}
