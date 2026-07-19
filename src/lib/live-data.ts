import { findKnownOrigin } from "../data/origins";
import type { Destination, WeatherSnapshot } from "./types";

const requestTimeoutMs = 8_000;

type ResolvedOrigin = {
  name: string;
  latitude: number;
  longitude: number;
};

type GeocodingResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country_code?: string;
  postcodes?: string[];
};

export async function resolveMichiganOrigin(value: string): Promise<ResolvedOrigin | null> {
  const known = findKnownOrigin(value);
  if (known) {
    return {
      name: `${known.name}, Michigan`,
      latitude: known.latitude,
      longitude: known.longitude,
    };
  }

  const params = new URLSearchParams({
    name: value.trim(),
    count: "10",
    language: "en",
    format: "json",
    countryCode: "US",
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(requestTimeoutMs),
    next: { revalidate: 86_400 },
  });

  if (!response.ok) throw new Error(`Geocoding returned ${response.status}`);
  const payload = (await response.json()) as { results?: GeocodingResult[] };
  const result = payload.results?.find(
    (candidate) =>
      candidate.country_code === "US" &&
      candidate.admin1?.toLowerCase() === "michigan" &&
      typeof candidate.latitude === "number" &&
      typeof candidate.longitude === "number",
  );

  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
    return null;
  }

  return {
    name: `${result.name ?? value}, Michigan`,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

type ForecastPayload = {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    wind_gusts_10m_max?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
};

type AirPayload = {
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
  };
};

function asArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function valueAt(values: Array<number | null> | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dailyAqi(payload: AirPayload | undefined, targetDate: string) {
  const times = payload?.hourly?.time ?? [];
  const values = payload?.hourly?.us_aqi ?? [];
  const matches = values.filter(
    (value, index): value is number =>
      times[index]?.startsWith(targetDate) === true &&
      typeof value === "number" &&
      Number.isFinite(value),
  );

  return matches.length ? Math.max(...matches) : null;
}

export async function fetchWeatherSnapshots(
  locations: Destination[],
  targetDate: string,
): Promise<Map<string, WeatherSnapshot>> {
  if (!locations.length) return new Map();

  const latitude = locations.map((location) => location.latitude.toFixed(4)).join(",");
  const longitude = locations.map((location) => location.longitude.toFixed(4)).join(",");
  const common = { latitude, longitude, timezone: "America/Detroit" };
  const forecastParams = new URLSearchParams({
    ...common,
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    forecast_days: "8",
  });
  const airParams = new URLSearchParams({
    ...common,
    hourly: "us_aqi",
    forecast_days: "5",
  });

  const [forecastResult, airResult] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams}`, {
      signal: AbortSignal.timeout(requestTimeoutMs),
      next: { revalidate: 900 },
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Forecast returned ${response.status}`);
      return (await response.json()) as ForecastPayload | ForecastPayload[];
    }),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`, {
      signal: AbortSignal.timeout(requestTimeoutMs),
      next: { revalidate: 1_800 },
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Air quality returned ${response.status}`);
      return (await response.json()) as AirPayload | AirPayload[];
    }),
  ]);

  if (forecastResult.status !== "fulfilled") return new Map();

  const forecasts = asArray(forecastResult.value);
  const air = airResult.status === "fulfilled" ? asArray(airResult.value) : [];
  const snapshots = new Map<string, WeatherSnapshot>();

  locations.forEach((location, locationIndex) => {
    const forecast = forecasts[locationIndex];
    const dayIndex = forecast?.daily?.time?.indexOf(targetDate) ?? -1;
    if (!forecast || dayIndex < 0) return;

    snapshots.set(location.id, {
      date: targetDate,
      high: valueAt(forecast.daily?.temperature_2m_max, dayIndex),
      low: valueAt(forecast.daily?.temperature_2m_min, dayIndex),
      precipitationProbability: valueAt(
        forecast.daily?.precipitation_probability_max,
        dayIndex,
      ),
      windGust: valueAt(forecast.daily?.wind_gusts_10m_max, dayIndex),
      weatherCode: valueAt(forecast.daily?.weather_code, dayIndex),
      aqi: dailyAqi(air[locationIndex], targetDate),
    });
  });

  return snapshots;
}
