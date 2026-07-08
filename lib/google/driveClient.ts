import crypto from 'crypto'

/**
 * Google Drive API クライアント（サービスアカウント認証）。
 * googleapis パッケージを使わず、JWT (RS256) → access_token の軽量実装。
 *
 * 必要な env:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL   サービスアカウントのメール
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  JSON キーの private_key（\n エスケープ可）
 * - GOOGLE_DRIVE_RECEIPT_FOLDER_ID 仕入れレシートフォルダの ID
 *
 * オーナー側の準備: Drive の対象フォルダをサービスアカウントのメールに「閲覧者」で共有する。
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

let cachedToken: { token: string; expiresAt: number } | null = null

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Google サービスアカウントが未設定です')
  // 貼り付けの揺れを吸収: 外側の "" 、\n 文字列化、CRLF、前後の空白
  let privateKey = rawKey.trim()
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1)
  }
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '')
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('private_key に BEGIN/END マーカーが含まれていません。値を再確認してください。')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }))
  const signingInput = `${header}.${claims}`
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey)
  const jwt = `${signingInput}.${b64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return json.access_token
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  createdTime: string
}

/** 指定フォルダ内のファイル一覧を取得（新しい順、最大 50 件）。 */
async function listFolderFiles(folderId: string, mimeFilter: string): Promise<DriveFile[]> {
  const token = await getAccessToken()
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and (${mimeFilter})`)
  const fields = encodeURIComponent('files(id,name,mimeType,createdTime)')
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`)
  const json = await res.json() as { files: DriveFile[] }
  return json.files ?? []
}

export async function listReceiptFiles(): Promise<DriveFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPT_FOLDER_ID
  if (!folderId) throw new Error('GOOGLE_DRIVE_RECEIPT_FOLDER_ID が未設定です')
  return listFolderFiles(folderId, `mimeType contains 'image/' or mimeType='application/pdf'`)
}

/** 写真セクション名 → env 変数のフォルダ ID を解決して一覧取得。
 * Drive for Desktop からアップした画像は mime が octet-stream 等になることがあるため、
 * サーバ側は全ファイル・全フォルダを返し、呼び出し側で mime または拡張子で絞る。 */
export async function listPhotoFiles(section: 'hero' | 'facilities'): Promise<DriveFile[]> {
  const envKey = section === 'hero' ? 'GOOGLE_DRIVE_HERO_FOLDER_ID' : 'GOOGLE_DRIVE_FACILITIES_FOLDER_ID'
  const folderId = process.env[envKey]
  if (!folderId) throw new Error(`${envKey} が未設定です`)
  // trashed のみ除外。フォルダも含めて返す（診断で「サブフォルダしかない」ケースを検出するため）
  return listFolderFiles(folderId, `trashed = false`)
}

/** 診断用: フォルダ自体のメタデータ（アクセス可否・名前）を取得。 */
export async function getFolderMeta(folderId: string): Promise<{ id: string; name: string; mimeType: string } | { error: string }> {
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { error: `HTTP ${res.status} ${body.slice(0, 200)}` }
    }
    return await res.json() as { id: string; name: string; mimeType: string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export function isImageFile(f: { name: string; mimeType: string }): boolean {
  if (f.mimeType && /^image\//.test(f.mimeType)) return true
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(f.name)
}

export async function downloadFile(fileId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const token = await getAccessToken()
  const meta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!meta.ok) throw new Error(`Drive meta failed: ${meta.status}`)
  const { mimeType } = await meta.json() as { mimeType: string }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  return { bytes, mimeType }
}
