import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '@blueSky キャンプ場',
    short_name: '@blueSky',
    description: '青森の自然に囲まれた小さなキャンプ場',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf9f3',
    theme_color: '#a16745',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
