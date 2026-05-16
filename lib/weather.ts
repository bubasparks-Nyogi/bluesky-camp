// lib/weather.ts

export interface WeatherForecast {
  date:    string  // YYYY-MM-DD
  label:   string
  icon:    string
  tempMax: number
  tempMin: number
}

// @blueSky の場所：滋賀県高島市安曇川町
const LAT = 35.32
const LNG = 136.00

export function weatherCodeToLabel(code: number): string {
  if (code === 0)                   return '晴れ'
  if (code === 1)                   return '晴れ'
  if (code === 2)                   return '晴れ時々くもり'
  if (code === 3)                   return 'くもり'
  if (code === 45 || code === 48)   return '霧'
  if (code >= 51 && code <= 55)     return '霧雨'
  if (code >= 61 && code <= 65)     return '雨'
  if (code >= 71 && code <= 75)     return '雪'
  if (code >= 80 && code <= 82)     return 'にわか雨'
  if (code === 95)                  return '雷雨'
  if (code >= 96 && code <= 99)     return '雷雨（雹）'
  return '--'
}

export function weatherCodeToIcon(code: number): string {
  if (code === 0)                   return '☀️'
  if (code <= 2)                    return '🌤️'
  if (code === 3)                   return '☁️'
  if (code === 45 || code === 48)   return '🌫️'
  if (code >= 51 && code <= 55)     return '🌦️'
  if (code >= 61 && code <= 65)     return '🌧️'
  if (code >= 71 && code <= 75)     return '❄️'
  if (code >= 80 && code <= 82)     return '🌦️'
  if (code >= 95)                   return '⛈️'
  return '🌡️'
}

export async function getWeatherForecast(date: string): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FTokyo&start_date=${date}&end_date=${date}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null

    const data = await res.json()
    const daily = data.daily
    if (!daily?.time?.length) return null

    const code    = daily.weathercode[0]        as number
    const tempMax = daily.temperature_2m_max[0] as number
    const tempMin = daily.temperature_2m_min[0] as number

    return {
      date,
      label:   weatherCodeToLabel(code),
      icon:    weatherCodeToIcon(code),
      tempMax: Math.round(tempMax),
      tempMin: Math.round(tempMin),
    }
  } catch {
    return null
  }
}
