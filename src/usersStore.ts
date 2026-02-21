import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

export type User = {
  id: string
  username: string
  passwordHash: string
  ageRange?: string
  sexPreference?: string
}

async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.access(USERS_FILE)
  } catch {
    await fs.writeFile(USERS_FILE, '[]', 'utf8')
  }
}

export async function loadUsers(): Promise<User[]> {
  await ensureFile()
  const raw = await fs.readFile(USERS_FILE, 'utf8')
  try {
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

export async function saveUsers(users: User[]) {
  await ensureFile()
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

export async function findUserByUsername(username: string) {
  const users = await loadUsers()
  return users.find(u => u.username.toLowerCase() === username.toLowerCase())
}

export async function findUserById(id: string) {
  const users = await loadUsers()
  return users.find(u => u.id === id)
}

export async function createUser(user: User) {
  const users = await loadUsers()
  users.push(user)
  await saveUsers(users)
  return user
}

export async function updateUser(id: string, patch: Partial<User>) {
  const users = await loadUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], ...patch }
  await saveUsers(users)
  return users[idx]
}
