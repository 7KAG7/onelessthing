import React, { useState } from 'react'
import axios from 'axios'
import { FaAmazon, FaSpinner, FaSyncAlt } from 'react-icons/fa'
import Tile from './components/Tile'
import WeatherCard from './components/WeatherCard'
import UserPage from './components/UserPage'

type Tiles = Record<string, any>

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

export default function App() {
  const [city, setCity] = useState('')
  const [gender, setGender] = useState('unisex')
  const [tiles, setTiles] = useState<Tiles | null>(null)
  const [weather, setWeather] = useState<any | null>(null)
  const [affiliateImageIndex, setAffiliateImageIndex] = useState<Record<string, number>>({})
  const [affiliateLoading, setAffiliateLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const lastCityKey = 'olt_last_city'
  const defaultCityKey = 'olt_default_location'
  const lastGenderKey = 'olt_last_gender'
  const profileGenderKey = 'olt_profile_sex_preference'
  const tokenKey = 'olt_token'
  const isLoggedIn = Boolean(localStorage.getItem(tokenKey))
  const pendingAffiliateLoadsRef = React.useRef<Record<string, { idx: number; remaining: number; seen: Set<string> }>>({})

  function normalizeOutfitGender(value: string) {
    if (value === 'male' || value === 'female' || value === 'unisex') return value
    return 'unisex'
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

  function countTilesForAffiliate(affiliateKey: string) {
    if (!tiles) return 0
    let count = 0
    for (const slot of Object.keys(tiles)) {
      const entry = tiles[slot]
      if (!entry) continue
      const items = Array.isArray(entry) ? entry : [entry]
      for (const item of items) {
        if (getAffiliateKeyFromLink(item?.link) === affiliateKey) count += 1
      }
    }
    return count
  }

  function handleTileImageSettled(affiliateKey: string, idx: number, src: string) {
    const pending = pendingAffiliateLoadsRef.current[affiliateKey]
    if (!pending) return
    if (pending.idx !== idx) return
    if (pending.seen.has(src)) return
    pending.seen.add(src)
    pending.remaining -= 1
    if (pending.remaining <= 0) {
      delete pendingAffiliateLoadsRef.current[affiliateKey]
      setAffiliateLoading((prev) => ({ ...prev, [affiliateKey]: false }))
    }
  }

  async function fetchOutfitFor(cityValue: string, genderValue: string) {
    const nextCity = cityValue.trim()
    if (!nextCity) return
    const token = localStorage.getItem(tokenKey)
    const effectiveGender = isLoggedIn ? normalizeOutfitGender(genderValue) : 'unisex'
    setLoading(true)
    try {
      const base = (import.meta.env.VITE_API_BASE as string) || ''
      const res = await axios.get(`${base}/api/weather`, {
        params: { city: nextCity, gender: effectiveGender },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = res.data
      setTiles(data.tiles)
      setWeather(data.weather)
      setAffiliateImageIndex({})
      setAffiliateLoading({})
      pendingAffiliateLoadsRef.current = {}
      localStorage.setItem(lastCityKey, nextCity)
      localStorage.setItem(lastGenderKey, effectiveGender)
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initialize city from persisted last search or default profile location and auto-load outfit.
  React.useEffect(() => {
    const lastCity = (localStorage.getItem(lastCityKey) || '').trim()
    const defaultCity = (localStorage.getItem(defaultCityKey) || '').trim()
    const lastGender = normalizeOutfitGender((localStorage.getItem(lastGenderKey) || '').trim())
    const profileGender = normalizeOutfitGender((localStorage.getItem(profileGenderKey) || '').trim())
    const initialGender = (localStorage.getItem(lastGenderKey) || '').trim() ? lastGender : profileGender
    setGender(initialGender)
    const initialCity = lastCity || defaultCity
    if (!initialCity) return
    setCity(initialCity)
    fetchOutfitFor(initialCity, initialGender)
  }, [])

  const getOutfit = async () => {
    if (!city.trim()) return alert('Enter a city')
    await fetchOutfitFor(city, gender)
  }

  async function handleCityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    await getOutfit()
  }

  const bgClass = genderBackgrounds[gender] || genderBackgrounds.unisex
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

  return (
    <div className={`app ${bgClass}`}>
      <header className="topbar">
        <h1>One Less Thing</h1>
        <div className="controls">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={handleCityKeyDown}
            placeholder="Enter city (e.g. Boston)"
          />
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
          <button onClick={() => setShowUser(true)}>Profile</button>
        </div>
      </header>
      {showUser ? (
        <main className="tile-column">
          <UserPage onClose={() => setShowUser(false)} />
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
                        affiliateImageIndex={(() => {
                          const key = getAffiliateKeyFromLink(it?.link)
                          return key ? (affiliateImageIndex[key] || 0) : 0
                        })()}
                        affiliateKey={getAffiliateKeyFromLink(it?.link)}
                        onImageSettled={handleTileImageSettled}
                      />
                    ))
                  }
                  return (
                    <Tile
                      key={slot}
                      slot={slot}
                      item={v}
                      isLoggedIn={isLoggedIn}
                      affiliateImageIndex={(() => {
                        const key = getAffiliateKeyFromLink(v?.link)
                        return key ? (affiliateImageIndex[key] || 0) : 0
                      })()}
                      affiliateKey={getAffiliateKeyFromLink(v?.link)}
                      onImageSettled={handleTileImageSettled}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="empty">Enter a city and press Get Outfit</div>
            )}
          </section>
          <aside className="affiliate-panel" aria-label="Affiliate providers">
            <div className="affiliate-panel-title">Affiliate Provider</div>
            {activeAffiliates.length ? (
              activeAffiliates.map(({ key, name, Icon }) => (
                <div key={key} className="affiliate-item">
                  <div className="affiliate-main">
                    <Icon size={34} />
                    <span>{name}</span>
                  </div>
                  <button
                    type="button"
                    className={`affiliate-refresh ${affiliateLoading[key] ? 'affiliate-refresh--loading' : ''}`}
                    onClick={() => {
                      const nextIdx = (affiliateImageIndex[key] || 0) + 1
                      const total = isLoggedIn ? countTilesForAffiliate(key) : 0
                      if (total > 0) {
                        pendingAffiliateLoadsRef.current[key] = { idx: nextIdx, remaining: total, seen: new Set<string>() }
                        setAffiliateLoading((prev) => ({ ...prev, [key]: true }))
                      }
                      setAffiliateImageIndex((prev) => ({ ...prev, [key]: nextIdx }))
                    }}
                    aria-label={`Show next ${name} product image`}
                    title="Next product image"
                    disabled={Boolean(affiliateLoading[key])}
                  >
                    {affiliateLoading[key] ? <FaSpinner size={14} className="spin" /> : <FaSyncAlt size={14} />}
                  </button>
                </div>
              ))
            ) : (
              <div className="affiliate-empty">No affiliates yet</div>
            )}
          </aside>
        </main>
      )}
    </div>
  )
}
