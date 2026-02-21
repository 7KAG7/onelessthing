import React, { useState } from 'react'
import axios from 'axios'
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

export default function App() {
  const [city, setCity] = useState('')
  const [gender, setGender] = useState('unisex')
  const [tiles, setTiles] = useState<Tiles | null>(null)
  const [weather, setWeather] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [showUser, setShowUser] = useState(false)

  // initialize city from persisted default location (set by profile)
  React.useEffect(() => {
    const d = localStorage.getItem('olt_default_location')
    if (d) setCity(d)
  }, [])

  const getOutfit = async () => {
    if (!city.trim()) return alert('Enter a city')
    setLoading(true)
    try {
      const base = (import.meta.env.VITE_API_BASE as string) || ''
      const res = await axios.get(`${base}/api/weather`, { params: { city, gender } })
      const data = res.data
      setTiles(data.tiles)
      setWeather(data.weather)
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const bgClass = genderBackgrounds[gender] || genderBackgrounds.unisex

  return (
    <div className={`app ${bgClass}`}>
      <header className="topbar">
        <h1>One Less Thing</h1>
        <div className="controls">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city (e.g. Boston)" />
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="unisex">Unisex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nb">Non-binary</option>
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
        <main className="tile-column">
          {weather && <WeatherCard weather={weather} />}

          {tiles ? (
            <div className="tiles-vertical">
              {['head', 'torso', 'bottoms', 'footwear', 'accessories'].map((slot) => {
                const v = tiles[slot]
                if (!v) return null
                if (Array.isArray(v)) {
                  return v.map((it: any, i: number) => (
                    <Tile key={`${slot}-${i}`} slot={slot} item={it} gender={gender} />
                  ))
                }
                return <Tile key={slot} slot={slot} item={v} gender={gender} />
              })}
            </div>
          ) : (
            <div className="empty">Enter a city and press Get Outfit</div>
          )}
        </main>
      )}
    </div>
  )
}
