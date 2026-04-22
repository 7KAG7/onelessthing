import React, { useEffect, useState } from 'react'
import axios from 'axios'

function tokenKey() { return 'olt_token' }
function profileGenderKey() { return 'olt_profile_sex_preference' }
function profileAgeKey() { return 'olt_profile_age' }

function normalizeOutfitGender(value?: string) {
  const v = (value || '').toLowerCase()
  if (v === 'male' || v === 'female' || v === 'unisex') return v
  return 'unisex'
}

export default function UserPage({ onClose, affiliatePanel }: { onClose: () => void; affiliatePanel?: React.ReactNode }) {
  const [mode, setMode] = useState<'login'|'register'|'profile'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<any | null>(null)
  const [age, setAge] = useState('')
  const [sexPreference, setSexPreference] = useState('')
  const [defaultLocation, setDefaultLocation] = useState<string | undefined>(undefined)

  const base = (import.meta.env.VITE_API_BASE as string) || ''

  useEffect(() => {
    const t = localStorage.getItem(tokenKey())
    if (t) {
      axios.defaults.headers.common.Authorization = `Bearer ${t}`
      fetchMe()
    }
  }, [])

  async function fetchMe() {
    try {
      const res = await axios.get(`${base}/api/auth/me`)
      setUser(res.data)
      setAge(res.data.age ? String(res.data.age) : '')
      setSexPreference(normalizeOutfitGender(res.data.sexPreference))
      setDefaultLocation(res.data.defaultLocation || '')
      if (res.data.defaultLocation) localStorage.setItem('olt_default_location', res.data.defaultLocation)
      localStorage.setItem(profileGenderKey(), normalizeOutfitGender(res.data.sexPreference))
      if (res.data.age) localStorage.setItem(profileAgeKey(), String(res.data.age))
      else localStorage.removeItem(profileAgeKey())
      setMode('profile')
    } catch (err) {
      console.warn('not logged in')
    }
  }

  async function doRegister() {
    try {
      const res = await axios.post(`${base}/api/auth/register`, { username, password })
      const { token } = res.data
      localStorage.setItem(tokenKey(), token)
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
      await fetchMe()
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    }
  }

  async function doLogin() {
    try {
      const res = await axios.post(`${base}/api/auth/login`, { username, password })
      const { token } = res.data
      localStorage.setItem(tokenKey(), token)
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
      await fetchMe()
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'login') {
      await doLogin()
    } else if (mode === 'register') {
      await doRegister()
    }
  }

  async function doSaveProfile() {
    try {
      const res = await axios.put(`${base}/api/user/profile`, { age, sexPreference, defaultLocation })
      setUser(res.data)
      setAge(res.data.age ? String(res.data.age) : '')
      setDefaultLocation(res.data.defaultLocation)
      if (res.data.defaultLocation) localStorage.setItem('olt_default_location', res.data.defaultLocation)
      localStorage.setItem(profileGenderKey(), normalizeOutfitGender(res.data.sexPreference))
      if (res.data.age) localStorage.setItem(profileAgeKey(), String(res.data.age))
      else localStorage.removeItem(profileAgeKey())
      alert('Profile saved')
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey())
    localStorage.removeItem(profileAgeKey())
    delete axios.defaults.headers.common.Authorization
    setUser(null)
    setMode('login')
  }

  return (
    <div className="user-page">
      <div className="user-header">
        <h2>User</h2>
        <div>
          {user ? <button onClick={logout}>Logout</button> : <button onClick={() => setMode('login')}>Login</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {!user && mode === 'login' && (
        <form className="auth-box" onSubmit={handleAuthSubmit}>
          <input name="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input name="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{display:'flex',gap:8}}>
            <button type="submit">Login</button>
            <button type="button" onClick={() => setMode('register')}>Register</button>
          </div>
        </form>
      )}

      {!user && mode === 'register' && (
        <form className="auth-box" onSubmit={handleAuthSubmit}>
          <input name="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input name="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{display:'flex',gap:8}}>
            <button type="submit">Create account</button>
            <button type="button" onClick={() => setMode('login')}>Back to login</button>
          </div>
        </form>
      )}

      {user && (
        <div className="profile-box">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div><strong>{user.username}</strong></div>
          </div>
          <label>Age</label>
          <input
            min="1"
            max="120"
            placeholder="e.g. 34"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <label>Sex preference</label>
          <select value={sexPreference} onChange={(e) => setSexPreference(e.target.value)}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="unisex">Unisex</option>
            <option value="notsay">Prefer not to say</option>
          </select>
          <label style={{marginTop:12}}>Default city</label>
          <input placeholder="e.g. Boston" value={defaultLocation || ''} onChange={(e) => setDefaultLocation(e.target.value)} />
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={doSaveProfile}>Save profile</button>
          </div>
          {affiliatePanel ? (
            <div className="profile-affiliates">
              {affiliatePanel}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
