import React, { useState } from 'react'
import axios from 'axios'
import { FaAmazon, FaCog } from 'react-icons/fa'
import Tile from './components/Tile'
import WeatherCard from './components/WeatherCard'
import UserPage from './components/UserPage'
import { WeatherLoop, type WeatherLoopVariant } from './weatherLoops'

type Tiles = Record<string, any>
type LocationSuggestion = {
  name: string
  state?: string
  country: string
  lat: number
  lon: number
  label: string
}

const genderBackgrounds: Record<string, string> = {
  unisex: 'bg-unisex',
  male: 'bg-male',
  female: 'bg-female',
  nb: 'bg-nb'
}

const affiliateRegistry = [
  {
    key: 'amazon',
    name: 'Amazon',
    hosts: ['amazon.', 'amzn.to'],
    Icon: FaAmazon
  }
]

function getWeatherLoopVariant(weather: any | null): WeatherLoopVariant {
  if (!weather) return 'clear-day'

  const main = (weather.weather?.[0]?.main || '').toLowerCase()
  const icon = weather.weather?.[0]?.icon
  const isNight = typeof icon === 'string' ? icon.includes('n') : false
  const cloudiness = Number(weather.clouds?.all || 0)
  const windSpeed = Number(weather.wind?.speed || 0)
  const precip = (weather.rain && (weather.rain['1h'] || weather.rain['3h'])) || (weather.snow && (weather.snow['1h'] || weather.snow['3h'])) || 0

  if (main.includes('thunder')) return 'storm'
  if (main.includes('snow')) return 'snow'
  if (main.includes('fog') || main.includes('mist') || main.includes('haze') || main.includes('smoke')) return 'fog'
  if (main.includes('rain') || main.includes('drizzle')) return precip >= 2 ? 'rain-heavy' : 'rain-light'
  if (windSpeed >= 20) return 'windy'
  if (main.includes('cloud')) return cloudiness >= 80 ? 'overcast' : isNight ? 'partly-cloudy-night' : 'partly-cloudy-day'
  return isNight ? 'clear-night' : 'clear-day'
}

export default function App() {
  const [city, setCity] = useState('')
  const [gender, setGender] = useState('unisex')
  const [tiles, setTiles] = useState<Tiles | null>(null)
  const [weather, setWeather] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [highlightedLocationIndex, setHighlightedLocationIndex] = useState(-1)
  const profileOpenKey = 'olt_profile_open'
  const [showUser, setShowUser] = useState(() => localStorage.getItem(profileOpenKey) === 'true')
  const lastCityKey = 'olt_last_city'
  const defaultCityKey = 'olt_default_location'
  const lastGenderKey = 'olt_last_gender'
  const profileGenderKey = 'olt_profile_sex_preference'
  const profileAgeKey = 'olt_profile_age'
  const tokenKey = 'olt_token'
  const isLoggedIn = Boolean(localStorage.getItem(tokenKey))

  type WeatherRequest =
    | { city: string }
    | { lat: number; lon: number }

  function normalizeOutfitGender(value: string) {
    if (value === 'male' || value === 'female' || value === 'unisex') return value
    return 'unisex'
  }

  function setProfileOpen(open: boolean) {
    setShowUser(open)
    if (open) {
      localStorage.setItem(profileOpenKey, 'true')
    } else {
      localStorage.removeItem(profileOpenKey)
    }
  }

  function getAffiliateKeyFromLink(link?: string) {
    if (!link) return null
    try {
      const host = new URL(link).hostname.toLowerCase()
      const affiliate = affiliateRegistry.find((a) => a.hosts.some((h) => host.includes(h)))
      return affiliate?.key || null
    } catch {
      return null
    }
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not available in this browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000
      })
    })
  }

  async function fetchOutfit(
    request: WeatherRequest,
    genderValue: string,
    options: { persistCity?: boolean; alertOnError?: boolean } = {}
  ) {
    const params =
      'city' in request
        ? { city: request.city.trim() }
        : { lat: request.lat, lon: request.lon }

    if ('city' in params && !params.city) return false

    const token = localStorage.getItem(tokenKey)
    const effectiveGender = normalizeOutfitGender(genderValue)
    const profileAge = (localStorage.getItem(profileAgeKey) || '').trim()
    setLoading(true)
    try {
      const base = (import.meta.env.VITE_API_BASE as string) || ''
      const res = await axios.get(`${base}/api/weather`, {
        params: { ...params, gender: effectiveGender, age: profileAge || undefined },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = res.data
      setTiles(data.tiles)
      setWeather({ ...data.weather, hourlyForecast: data.forecast || [], radar: data.radar || null })
      const resolvedCity = (data.weather?.name || ('city' in request ? request.city : '')).trim()
      if (resolvedCity) setCity(resolvedCity)
      if (options.persistCity !== false && resolvedCity) localStorage.setItem(lastCityKey, resolvedCity)
      localStorage.setItem(lastGenderKey, effectiveGender)
      return true
    } catch (err: any) {
      if (options.alertOnError !== false) {
        alert(err?.response?.data?.error || err.message)
      }
      return false
    } finally {
      setLoading(false)
    }
  }

  async function fetchOutfitFor(cityValue: string, genderValue: string) {
    const nextCity = cityValue.trim()
    if (!nextCity) return
    await fetchOutfit({ city: nextCity }, genderValue)
  }

  async function fetchOutfitForDeviceLocation(genderValue: string) {
    const position = await getCurrentPosition()
    const { latitude, longitude } = position.coords
    return fetchOutfit({ lat: latitude, lon: longitude }, genderValue, { alertOnError: false })
  }

  async function selectLocationSuggestion(suggestion: LocationSuggestion) {
    setCity(suggestion.label)
    setLocationSuggestions([])
    setShowLocationSuggestions(false)
    setHighlightedLocationIndex(-1)
    await fetchOutfit({ lat: suggestion.lat, lon: suggestion.lon }, gender)
  }

  // Initialize from device location first, with persisted/default city as a fallback.
  React.useEffect(() => {
    let ignore = false

    const lastCity = (localStorage.getItem(lastCityKey) || '').trim()
    const defaultCity = (localStorage.getItem(defaultCityKey) || '').trim()
    const lastGender = normalizeOutfitGender((localStorage.getItem(lastGenderKey) || '').trim())
    const profileGender = normalizeOutfitGender((localStorage.getItem(profileGenderKey) || '').trim())
    const initialGender = (localStorage.getItem(lastGenderKey) || '').trim() ? lastGender : profileGender
    setGender(initialGender)

    async function loadInitialOutfit() {
      const fallbackCity = lastCity || defaultCity

      try {
        const loadedFromDeviceLocation = await fetchOutfitForDeviceLocation(initialGender)
        if (loadedFromDeviceLocation) return
      } catch (err) {
        console.warn('Could not load outfit from device location', err)
      }

      if (ignore || !fallbackCity) return
      setCity(fallbackCity)
      await fetchOutfitFor(fallbackCity, initialGender)
    }

    void loadInitialOutfit()

    return () => {
      ignore = true
    }
  }, [])

  React.useEffect(() => {
    const query = city.trim()
    const base = (import.meta.env.VITE_API_BASE as string) || ''
    const controller = new AbortController()

    if (showUser || !query) {
      setLocationSuggestions([])
      setLocationLoading(false)
      setHighlightedLocationIndex(-1)
      return () => controller.abort()
    }

    const timer = window.setTimeout(async () => {
      setLocationLoading(true)
      try {
        const res = await axios.get(`${base}/api/locations`, {
          params: { q: query, limit: 6 },
          signal: controller.signal
        })
        if (controller.signal.aborted) return
        const locations = Array.isArray(res.data?.locations) ? res.data.locations : []
        setLocationSuggestions(locations)
        setHighlightedLocationIndex(locations.length ? 0 : -1)
      } catch (err: any) {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return
        console.warn('Location suggestions unavailable', err)
        setLocationSuggestions([])
        setHighlightedLocationIndex(-1)
      } finally {
        if (!controller.signal.aborted) setLocationLoading(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [city, showUser])

  const getOutfit = async () => {
    if (!city.trim()) return alert('Enter a city')
    setShowLocationSuggestions(false)
    await fetchOutfitFor(city, gender)
  }

  async function handleCityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const hasSuggestions = showLocationSuggestions && locationSuggestions.length > 0

    if (e.key === 'ArrowDown' && hasSuggestions) {
      e.preventDefault()
      setHighlightedLocationIndex((current) => (current + 1) % locationSuggestions.length)
      return
    }

    if (e.key === 'ArrowUp' && hasSuggestions) {
      e.preventDefault()
      setHighlightedLocationIndex((current) => (current <= 0 ? locationSuggestions.length - 1 : current - 1))
      return
    }

    if (e.key === 'Escape') {
      setShowLocationSuggestions(false)
      setHighlightedLocationIndex(-1)
      return
    }

    if (e.key !== 'Enter') return
    e.preventDefault()

    if (hasSuggestions && highlightedLocationIndex >= 0) {
      await selectLocationSuggestion(locationSuggestions[highlightedLocationIndex])
      return
    }

    await getOutfit()
  }

  const bgClass = genderBackgrounds[gender] || genderBackgrounds.unisex
  const pageWeatherVariant = React.useMemo(() => getWeatherLoopVariant(weather), [weather])
  const activeAffiliates = React.useMemo(() => {
    if (!tiles) return []
    const links: string[] = []
    for (const slot of Object.keys(tiles)) {
      const entry = tiles[slot]
      if (!entry) continue
      if (Array.isArray(entry)) {
        for (const item of entry) {
          if (item?.link) links.push(item.link)
        }
      } else if (entry?.link) {
        links.push(entry.link)
      }
    }

    const found = new Set<string>()
    for (const link of links) {
      const key = getAffiliateKeyFromLink(link)
      if (key) found.add(key)
    }
    return affiliateRegistry.filter((a) => found.has(a.key))
  }, [tiles])

  const affiliatePanel = (
    <aside className="affiliate-panel" aria-label="Affiliate providers">
      <div className="affiliate-panel-title">Affiliate Provider</div>
      {activeAffiliates.length ? (
        activeAffiliates.map(({ key, name, Icon }) => (
          <div key={key} className="affiliate-item">
            <div className="affiliate-main">
              <Icon size={34} />
              <span>{name}</span>
            </div>
          </div>
        ))
      ) : (
        <div className="affiliate-empty">No affiliates yet</div>
      )}
    </aside>
  )

  return (
    <div className={`app ${bgClass}`}>
      <div className="app-weather-bg" aria-hidden="true">
        <WeatherLoop variant={pageWeatherVariant} />
      </div>
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => setProfileOpen(false)} aria-label="Go to home page">
          One Less Thing
        </button>
        <div className="controls">
          <div className="location-search">
            <input
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                setShowLocationSuggestions(true)
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowLocationSuggestions(false), 120)}
              onKeyDown={handleCityKeyDown}
              placeholder="Enter city (e.g. Boston)"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showLocationSuggestions && (locationSuggestions.length > 0 || locationLoading)}
              aria-controls="location-suggestions"
              aria-activedescendant={highlightedLocationIndex >= 0 ? `location-suggestion-${highlightedLocationIndex}` : undefined}
            />
            {showLocationSuggestions && (locationLoading || locationSuggestions.length > 0) && (
              <div className="location-suggestions" id="location-suggestions" role="listbox">
                {locationLoading ? (
                  <div className="location-suggestion location-suggestion--muted">Searching locations…</div>
                ) : (
                  locationSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                      id={`location-suggestion-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedLocationIndex}
                      className={`location-suggestion ${index === highlightedLocationIndex ? 'location-suggestion--active' : ''}`}
                      onMouseEnter={() => setHighlightedLocationIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void selectLocationSuggestion(suggestion)}
                    >
                      <span>{suggestion.name}</span>
                      <small>{[suggestion.state, suggestion.country].filter(Boolean).join(', ')}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <select value={gender} onChange={(e) => {
            const next = normalizeOutfitGender(e.target.value)
            setGender(next)
            localStorage.setItem(lastGenderKey, next)
            if (city.trim()) {
              void fetchOutfitFor(city, next)
            }
          }}>
            <option value="unisex">Unisex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <button onClick={getOutfit} disabled={loading}>{loading ? 'Loading…' : 'Get Outfit'}</button>
          <button className="icon-button" onClick={() => setProfileOpen(true)} aria-label="Open profile" title="Profile">
            <FaCog size={16} aria-hidden />
          </button>
        </div>
      </header>
      {showUser ? (
        <main className="tile-column">
          <UserPage onClose={() => setProfileOpen(false)} affiliatePanel={affiliatePanel} />
        </main>
      ) : (
        <main className="app-content">
          <section className="weather-column">
            {weather ? <WeatherCard weather={weather} /> : <div className="empty">Weather will appear here</div>}
          </section>
          <section className="tile-column">
            {tiles ? (
              <div className="tiles-vertical">
                {['head', 'torso', 'bottoms', 'footwear', 'accessories'].map((slot) => {
                  const v = tiles[slot]
                  if (!v) return null
                  if (Array.isArray(v)) {
                    return v.map((it: any, i: number) => (
                      <Tile
                        key={`${slot}-${i}`}
                        slot={slot}
                        item={it}
                        isLoggedIn={isLoggedIn}
                      />
                    ))
                  }
                  return (
                    <Tile
                      key={slot}
                      slot={slot}
                      item={v}
                      isLoggedIn={isLoggedIn}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="empty">Enter a city and press Get Outfit</div>
            )}
          </section>
        </main>
      )}
    </div>
  )
}
