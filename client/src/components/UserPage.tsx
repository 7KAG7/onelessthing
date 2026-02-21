import React, { useEffect, useState } from 'react'
import axios from 'axios'
import AvatarIcon from './AvatarIcon'
import { FaSun, FaCloud, FaUmbrella, FaShoePrints } from 'react-icons/fa'

function tokenKey() { return 'olt_token' }

export default function UserPage({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login'|'register'|'profile'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<any | null>(null)
  const [ageRange, setAgeRange] = useState('')
  const [sexPreference, setSexPreference] = useState('')
  const [avatar, setAvatar] = useState<string | undefined>(undefined)
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
      setAgeRange(res.data.ageRange || '')
      setSexPreference(res.data.sexPreference || '')
      setAvatar(res.data.avatar)
      setDefaultLocation(res.data.defaultLocation || '')
      if (res.data.defaultLocation) localStorage.setItem('olt_default_location', res.data.defaultLocation)
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
      const res = await axios.put(`${base}/api/user/profile`, { ageRange, sexPreference, avatar, defaultLocation })
      setUser(res.data)
      setAvatar(res.data.avatar)
      setDefaultLocation(res.data.defaultLocation)
      alert('Profile saved')
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message)
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey())
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
            <div style={{width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',borderRadius:12}}>
              {(() => {
                const map: Record<string, any> = { sun: FaSun, cloud: FaCloud, umbrella: FaUmbrella, shoe: FaShoePrints }
                const key = (avatar || '').toString().toLowerCase()
                const C = map[key] || null
                return C ? <C size={36} color="#111" aria-hidden /> : <AvatarIcon id={avatar || 'default'} size={56} />
              })()}
            </div>
            <div><strong>{user.username}</strong></div>
          </div>
          <label>Age range</label>
          <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
            <option value="">Select age range</option>
            <option value="<18">Under 18</option>
            <option value="18-24">18–24</option>
            <option value="25-34">25–34</option>
            <option value="35-44">35–44</option>
            <option value="45-54">45–54</option>
            <option value="55-64">55–64</option>
            <option value=">=65">65+</option>
          </select>
          <label>Sex preference</label>
          <select value={sexPreference} onChange={(e) => setSexPreference(e.target.value)}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nb">Non-binary</option>
            <option value="unisex">Unisex</option>
            <option value="notsay">Prefer not to say</option>
          </select>
          <label style={{marginTop:12}}>Avatar</label>
          <label style={{marginTop:12}}>Default city</label>
          <input placeholder="e.g. Boston" value={defaultLocation || ''} onChange={(e) => setDefaultLocation(e.target.value)} />
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
            {[
              { id: 'sun', Icon: FaSun },
              { id: 'cloud', Icon: FaCloud },
              { id: 'umbrella', Icon: FaUmbrella },
              { id: 'shoe', Icon: FaShoePrints }
            ].map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAvatar(id)}
                title={id}
                style={{border: avatar===id ? '2px solid #0b5fff' : '1px solid #e6e9ef', padding:8, borderRadius:8, background:'#fff'}}
                aria-pressed={avatar===id}
              >
                <Icon size={28} color={avatar===id ? '#0b5fff' : '#111'} />
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={doSaveProfile}>Save profile</button>
          </div>
        </div>
      )}
    </div>
  )
}
