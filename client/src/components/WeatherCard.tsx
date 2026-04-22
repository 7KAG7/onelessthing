import React from 'react'
import { WeatherLoop, type WeatherLoopVariant } from '../weatherLoops'

const GRAPH_WIDTH = 360
const GRAPH_HEIGHT = 140
const GRAPH_PLOT_TOP = 18
const GRAPH_PLOT_BOTTOM = 104
const GRAPH_AXIS_Y = 112
const GRAPH_LABEL_Y = 132

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

function formatPrecipInches(precipMm: number) {
  if (!precipMm) return '0 in'
  const inches = precipMm / 25.4
  if (inches < 0.01) return '<0.01 in'
  return `${inches.toFixed(2)} in`
}

function formatForecastPrecipInches(precipInches: number) {
  if (!precipInches) return '0 in'
  if (precipInches < 0.01) return '<0.01 in'
  return `${precipInches.toFixed(2)} in`
}

function getForecastIcon(description: string) {
  const value = description.toLowerCase()
  if (value.includes('storm')) return 'Storm'
  if (value.includes('snow')) return 'Snow'
  if (value.includes('rain') || value.includes('drizzle')) return 'Rain'
  if (value.includes('fog')) return 'Fog'
  if (value.includes('cloud')) return 'Cloud'
  return 'Sun'
}

function buildHourlyGraphPoints(hourlyForecast: any[]) {
  if (!hourlyForecast.length) return ''
  const temps = hourlyForecast.map((hour) => Number(hour.temp || 0))
  const minTemp = Math.min(...temps)
  const maxTemp = Math.max(...temps)
  const tempRange = Math.max(maxTemp - minTemp, 1)
  const xStep = hourlyForecast.length > 1 ? GRAPH_WIDTH / (hourlyForecast.length - 1) : GRAPH_WIDTH

  return hourlyForecast
    .map((hour, index) => {
      const x = index * xStep
      const normalizedTemp = (Number(hour.temp || 0) - minTemp) / tempRange
      const y = GRAPH_PLOT_TOP + (1 - normalizedTemp) * (GRAPH_PLOT_BOTTOM - GRAPH_PLOT_TOP)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function buildGraphTickIndexes(hourlyForecast: any[]) {
  if (!hourlyForecast.length) return []
  const lastIndex = hourlyForecast.length - 1
  return Array.from(
    new Set([0, 0.25, 0.5, 0.75, 1].map((position) => Math.round(lastIndex * position)))
  )
}

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom)
}

function latToTileY(lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

function buildRadarTiles(radar: any) {
  const zoom = Number(radar?.zoom || 7)
  const lat = Number(radar?.lat)
  const lon = Number(radar?.lon)
  if (!radar?.host || !radar?.path || !Number.isFinite(lat) || !Number.isFinite(lon)) return []

  const centerTileX = lonToTileX(lon, zoom)
  const centerTileY = latToTileY(lat, zoom)
  const baseX = Math.floor(centerTileX) - 1
  const baseY = Math.floor(centerTileY) - 1
  const fractionalX = centerTileX - Math.floor(centerTileX)
  const fractionalY = centerTileY - Math.floor(centerTileY)
  const tileSize = 256
  const worldTileCount = Math.pow(2, zoom)

  const tiles = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const rawX = baseX + col
      const y = baseY + row
      if (y < 0 || y >= worldTileCount) continue
      const x = ((rawX % worldTileCount) + worldTileCount) % worldTileCount
      const left = col * tileSize - (fractionalX + 1) * tileSize
      const top = row * tileSize - (fractionalY + 1) * tileSize

      tiles.push({
        key: `${x}-${y}`,
        left,
        top,
        osmUrl: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        radarUrl: `${radar.host}${radar.path}/256/${zoom}/${x}/${y}/2/1_1.png`
      })
    }
  }

  return tiles
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
  const hourlyForecast = Array.isArray(weather.hourlyForecast) ? weather.hourlyForecast : []
  const graphPoints = buildHourlyGraphPoints(hourlyForecast)
  const graphTemps = hourlyForecast.map((hour: any) => Number(hour.temp || 0))
  const graphMinTemp = graphTemps.length ? Math.round(Math.min(...graphTemps)) : 0
  const graphMaxTemp = graphTemps.length ? Math.round(Math.max(...graphTemps)) : 0
  const graphRawMinTemp = graphTemps.length ? Math.min(...graphTemps) : 0
  const graphRawMaxTemp = graphTemps.length ? Math.max(...graphTemps) : 0
  const graphTempRange = Math.max(graphRawMaxTemp - graphRawMinTemp, 1)
  const graphTickIndexes = React.useMemo(() => buildGraphTickIndexes(hourlyForecast), [hourlyForecast])
  const radar = weather.radar || null
  const radarTiles = buildRadarTiles(radar)

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

      <div className="weather-card-content">
        <div className="weather-current">
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
              <div>Precip: {formatPrecipInches(precip)}</div>
            </div>
          </div>
        </div>

        {hourlyForecast.length ? (
          <div className="hourly-panel" aria-label="Hourly forecast for the next 24 hours">
            <div className="hourly-header">
              <span>Next 24 hours</span>
              <span>Slide for more</span>
            </div>
            <div className="hourly-slider" role="list">
              {hourlyForecast.map((hour: any) => (
                <article className="hourly-card" key={hour.dt} role="listitem" aria-label={`${formatTimestamp(hour.dt)}, ${Math.round(hour.temp)} degrees, ${hour.description}`}>
                  <div className="hourly-time">{formatTimestamp(hour.dt)}</div>
                  <div className="hourly-icon" aria-hidden>{getForecastIcon(hour.description || '')}</div>
                  <div className="hourly-temp">{Math.round(hour.temp)}°</div>
                  <div className="hourly-desc">{hour.description}</div>
                  <div className="hourly-detail">{Math.round(hour.precipitationProbability || 0)}% rain</div>
                  <div className="hourly-detail">{formatForecastPrecipInches(hour.precipitation || 0)}</div>
                </article>
              ))}
            </div>

            {graphPoints ? (
              <div className="hourly-graph" aria-label={`Temperature graph from ${graphMinTemp} to ${graphMaxTemp} degrees over the next 24 hours`}>
                <div className="hourly-graph-top">
                  <span>Temp trend</span>
                  <span>{graphMinTemp}° to {graphMaxTemp}°</span>
                </div>
                <svg className="hourly-graph-svg" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img" aria-hidden="true" preserveAspectRatio="none">
                  <line x1="0" y1={GRAPH_PLOT_TOP} x2={GRAPH_WIDTH} y2={GRAPH_PLOT_TOP} className="hourly-graph-grid" />
                  <line x1="0" y1={(GRAPH_PLOT_TOP + GRAPH_PLOT_BOTTOM) / 2} x2={GRAPH_WIDTH} y2={(GRAPH_PLOT_TOP + GRAPH_PLOT_BOTTOM) / 2} className="hourly-graph-grid" />
                  <line x1="0" y1={GRAPH_PLOT_BOTTOM} x2={GRAPH_WIDTH} y2={GRAPH_PLOT_BOTTOM} className="hourly-graph-grid" />
                  <line x1="0" y1={GRAPH_AXIS_Y} x2={GRAPH_WIDTH} y2={GRAPH_AXIS_Y} className="hourly-graph-axis" />
                  {hourlyForecast.map((hour: any, index: number) => {
                    const xStep = hourlyForecast.length > 1 ? GRAPH_WIDTH / (hourlyForecast.length - 1) : GRAPH_WIDTH
                    const x = index * xStep
                    const probability = Math.max(0, Math.min(100, Number(hour.precipitationProbability || 0)))
                    const barHeight = (probability / 100) * 46
                    return (
                      <rect
                        key={`precip-${hour.dt}`}
                        className="hourly-graph-bar"
                        x={x - 3}
                        y={GRAPH_PLOT_BOTTOM - barHeight}
                        width="6"
                        height={barHeight}
                        rx="3"
                      />
                    )
                  })}
                  <polyline className="hourly-graph-line" points={graphPoints} />
                  {hourlyForecast.map((hour: any, index: number) => {
                    const xStep = hourlyForecast.length > 1 ? GRAPH_WIDTH / (hourlyForecast.length - 1) : GRAPH_WIDTH
                    const x = index * xStep
                    const normalizedTemp = (Number(hour.temp || 0) - graphRawMinTemp) / graphTempRange
                    const y = GRAPH_PLOT_TOP + (1 - normalizedTemp) * (GRAPH_PLOT_BOTTOM - GRAPH_PLOT_TOP)
                    return <circle key={`temp-${hour.dt}`} className="hourly-graph-dot" cx={x} cy={y} r="3" />
                  })}
                  {graphTickIndexes.map((index) => {
                    const hour = hourlyForecast[index]
                    const xStep = hourlyForecast.length > 1 ? GRAPH_WIDTH / (hourlyForecast.length - 1) : GRAPH_WIDTH
                    const x = index * xStep
                    const anchor = index === 0 ? 'start' : index === hourlyForecast.length - 1 ? 'end' : 'middle'
                    return (
                      <g key={`tick-${hour.dt}`}>
                        <line x1={x} y1={GRAPH_AXIS_Y} x2={x} y2={GRAPH_AXIS_Y + 5} className="hourly-graph-tick" />
                        <text x={x} y={GRAPH_LABEL_Y} textAnchor={anchor} className="hourly-graph-label">
                          {formatTimestamp(hour.dt)}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                <div className="hourly-graph-legend">
                  <span><i className="legend-line" />Temperature</span>
                  <span><i className="legend-bar" />Rain chance</span>
                </div>
              </div>
            ) : null}

            {radarTiles.length ? (
              <div className="radar-panel" aria-label="Current weather radar near this location">
                <div className="radar-header">
                  <span>Local radar</span>
                  {radar.frameTime ? <span>Updated {formatTimestamp(radar.frameTime)}</span> : null}
                </div>
                <div className="radar-frame">
                  <div className="radar-tile-layer" aria-hidden>
                    {radarTiles.map((tile) => (
                      <img
                        key={`map-${tile.key}`}
                        className="radar-map-tile"
                        src={tile.osmUrl}
                        alt=""
                        loading="lazy"
                        style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
                      />
                    ))}
                  </div>
                  <div className="radar-tile-layer radar-tile-layer--overlay" aria-hidden>
                    {radarTiles.map((tile) => (
                      <img
                        key={`radar-${tile.key}`}
                        className="radar-map-tile"
                        src={tile.radarUrl}
                        alt=""
                        loading="lazy"
                        style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
                      />
                    ))}
                  </div>
                  <div className="radar-pin" aria-hidden />
                </div>
                <div className="radar-credit">
                  Map data by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>; radar by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
