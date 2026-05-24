import Script from 'next/script'

/**
 * Google Analytics (GA4) integration.
 *
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel env to enable (e.g. "G-XXXXXXXXXX").
 * No tracking if the env var is unset.
 */
export default function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!id) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
