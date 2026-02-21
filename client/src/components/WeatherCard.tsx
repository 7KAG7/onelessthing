import React from 'react'
import { WeatherLoop, type WeatherLoopVariant } from '../weatherLoops'

function degToCompass(num: number) {
  const val = Math.floor((num / 22.5) + 0.5)
  const arr = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return arr[(val % 16)]
}

function formatTimestamp(dt: number, tzOffsetSeconds?: number) {
  try {
    const date = new Date(dt * 1000)
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric' }).format(date)
  } catch {
    return ''
  }
}

export default function WeatherCard({ weather }: { weather: any }) {
  if (!weather) return null
  const main = (weather.weather?.[0]?.main || '').toLowerCase()
  const conditionType = ((): string => {
    if (main.includes('rain') || main.includes('drizzle')) return 'rain'
    if (main.includes('snow')) return 'snow'
    if (main.includes('cloud')) return 'clouds'
    if (main.includes('thunder')) return 'thunder'
    if (main.includes('fog') || main.includes('mist') || main.includes('haze') || main.includes('smoke')) return 'fog'
    return 'clear'
  })()

  const temp = Math.round(weather.main.temp)
  const feels = Math.round(weather.main.feels_like)
  const condition = weather.weather?.[0]?.description || ''
  const icon = weather.weather?.[0]?.icon
  const location = weather.name
  const dt = weather.dt
  const windSpeed = weather.wind?.speed
  const windDeg = weather.wind?.deg
  const precip = (weather.rain && (weather.rain['1h'] || weather.rain['3h'])) || (weather.snow && (weather.snow['1h'] || weather.snow['3h'])) || 0
  const cloudiness = weather.clouds?.all || 0
  const isNight = typeof icon === 'string' ? icon.includes('n') : false

  const loopVariant: WeatherLoopVariant = (() => {
    if (conditionType === 'thunder') return 'storm'
    if (conditionType === 'snow') return 'snow'
    if (conditionType === 'fog') return 'fog'
    if (conditionType === 'rain') return precip >= 2 ? 'rain-heavy' : 'rain-light'
    if ((windSpeed || 0) >= 20) return 'windy'
    if (conditionType === 'clouds') {
      if (cloudiness >= 80) return 'overcast'
      return isNight ? 'partly-cloudy-night' : 'partly-cloudy-day'
    }
    return isNight ? 'clear-night' : 'clear-day'
  })()

  const iconUrl = icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : undefined

  return (
    <section className="weather-card" role="region" aria-label={`Current weather for ${location}`}>
      <div className={`weather-bg weather-bg--${conditionType}`} aria-hidden="true">
        <WeatherLoop variant={loopVariant} />
      </div>

      <div className="weather-left">
        <div className="weather-temp">{temp}°</div>
        <div className="weather-cond">{condition}</div>
        <div className="weather-meta">Feels like {feels}°</div>
      </div>

      <div className="weather-right">
        {iconUrl && <img className="weather-icon" src={iconUrl} alt={condition} />}
        <div className="weather-location">{location}</div>
        <div className="weather-stamp">Updated {formatTimestamp(dt)}</div>
        <div className="weather-stats">
          <div>Wind: {windSpeed ?? '—'} {windDeg ? degToCompass(windDeg) : ''}</div>
          <div>Precip: {precip ? `${precip} mm` : '0 mm'}</div>
        </div>
      </div>
    </section>
  )
}
