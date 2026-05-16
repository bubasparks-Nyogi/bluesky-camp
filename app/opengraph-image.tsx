import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '@blueSky キャンプ場'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #451a03 100%)',
          position: 'relative',
        }}
      >
        {/* Decorative circle */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
          }}
        />
        {/* Fire emoji top-right */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            fontSize: '160px',
            display: 'flex',
          }}
        >
          🔥
        </div>

        {/* Tag line */}
        <div
          style={{
            color: '#fcd34d',
            fontSize: '28px',
            fontWeight: 400,
            marginBottom: '16px',
            letterSpacing: '0.1em',
            display: 'flex',
          }}
        >
          一日一組限定 ・ 完全貸切
        </div>

        {/* Title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: '96px',
            fontWeight: 700,
            lineHeight: 1.0,
            marginBottom: '24px',
            display: 'flex',
          }}
        >
          @blueSky
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#fde68a',
            fontSize: '36px',
            fontWeight: 400,
            display: 'flex',
          }}
        >
          滋賀県高島市のキャンプ場
        </div>

        {/* Amenity pills */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            gap: '24px',
          }}
        >
          {['🔥 焚き火', '🧖 サウナ', '🛁 ドラム缶風呂'].map((item) => (
            <div
              key={item}
              style={{
                color: '#fff7ed',
                fontSize: '28px',
                background: 'rgba(255,255,255,0.12)',
                padding: '8px 20px',
                borderRadius: '999px',
                display: 'flex',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
