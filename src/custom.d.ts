// Lightweight module declarations for packages without @types installed.
// These prevent TS errors in development; prefer installing the proper
// `@types/*` packages in a future change (`npm i -D @types/bcryptjs @types/jsonwebtoken`).
declare module 'bcryptjs'
declare module 'jsonwebtoken'
