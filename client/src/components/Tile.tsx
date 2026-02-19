import React from 'react'

function imageFor(name: string, gender?: string) {
  const query = encodeURIComponent(name + ' ' + (gender || ''))
  return `https://source.unsplash.com/400x400/?${query}`
}

const FALLBACK_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect fill="#f3f4f6" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="20">No image</text></svg>');

export default function Tile({ slot, item, gender }: { slot: string; item: any; gender?: string }) {
  const src = imageFor(item.name, gender)

  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    if (img.dataset.fallback !== '1') {
      img.src = FALLBACK_SVG
      img.dataset.fallback = '1'
    }
  }

  // helpful for debugging if images fail to load
  console.debug('Tile image URL:', src)

  return (
    <article className="tile">
      <div className="tile-media">
        <img src={src} alt={item.name} loading="lazy" onError={handleError} />
      </div>
      <div className="tile-body">
        <div className="tile-slot">{slot.toUpperCase()}</div>
        <div className="tile-name">{item.name}</div>
        <div className="tile-reason">{item.reason}</div>
        <a className="tile-buy" href={item.link} target="_blank" rel="noopener noreferrer">Buy</a>
      </div>
    </article>
  )
}
