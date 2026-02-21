import React, {useEffect, useMemo, useState} from 'react'
import { FaHatCowboy, FaTshirt, FaShoePrints, FaUmbrella, FaGem, FaBoxOpen } from 'react-icons/fa'
import { GiTrousers, GiGloves } from 'react-icons/gi'

type TileItem = {
  name: string
  reason?: string
  link?: string
  image?: string
}

function IconForItem({ slot, itemName, size = 42 }: { slot: string; itemName: string; size?: number }) {
  const common = { size }
  const name = (itemName || '').toLowerCase()

  if (name.includes('umbrella')) return <FaUmbrella {...common} />
  if (name.includes('glove') || name.includes('mitten')) return <GiGloves {...common} />
  if (name.includes('boot') || name.includes('shoe') || name.includes('sneaker') || name.includes('sandal')) return <FaShoePrints {...common} />
  if (name.includes('jean') || name.includes('pant') || name.includes('short') || name.includes('trouser')) return <GiTrousers {...common} />
  if (name.includes('jacket') || name.includes('sweater') || name.includes('shirt') || name.includes('top')) return <FaTshirt {...common} />
  if (name.includes('hat') || name.includes('beanie') || name.includes('cap')) return <FaHatCowboy {...common} />

  switch (slot.toLowerCase()) {
    case 'head':
      return <FaHatCowboy {...common} />
    case 'torso':
      return <FaTshirt {...common} />
    case 'bottoms':
      return <FaBoxOpen {...common} />
    case 'footwear':
      return <FaShoePrints {...common} />
    case 'accessory':
    case 'accessories':
      return <FaGem {...common} />
    case 'umbrella':
      return <FaUmbrella {...common} />
    default:
      return <FaBoxOpen {...common} />
  }
}

export default function Tile({
  slot,
  item,
  isLoggedIn,
  affiliateImageIndex = 0,
  affiliateKey,
  onImageSettled
}: {
  slot: string;
  item: TileItem;
  isLoggedIn: boolean;
  affiliateImageIndex?: number;
  affiliateKey?: string | null;
  onImageSettled?: (affiliateKey: string, idx: number, src: string) => void;
}) {
  const apiBase = (import.meta.env.VITE_API_BASE as string) || ''

  const imageSrc = useMemo(() => {
    if (!isLoggedIn) return ''
    if (item.image) return item.image
    if (item.link) {
      return `${apiBase}/api/preview-image?url=${encodeURIComponent(item.link)}&idx=${affiliateImageIndex}`
    }
    return ''
  }, [apiBase, isLoggedIn, item.image, item.link, affiliateImageIndex])

  const [showImage, setShowImage] = useState(Boolean(imageSrc))

  useEffect(() => {
    setShowImage(Boolean(imageSrc))
  }, [imageSrc])

  function notifySettled() {
    if (!affiliateKey || !onImageSettled || !imageSrc) return
    onImageSettled(affiliateKey, affiliateImageIndex, imageSrc)
  }

  function handleLoad() {
    notifySettled()
  }

  function handleError() {
    notifySettled()
    setShowImage(false)
  }

  return (
    <article className="tile">
      <div className="tile-media">
        {showImage && imageSrc ? (
          <img src={imageSrc} alt={item.name} loading="lazy" onLoad={handleLoad} onError={handleError} />
        ) : (
          <div className="tile-placeholder" aria-hidden>
            <div className="tile-fallback-icon"><IconForItem slot={slot} itemName={item.name} size={42} /></div>
          </div>
        )}
      </div>
      <div className="tile-body">
        <div className="tile-slot">{slot.toUpperCase()}</div>
        <div className="tile-name">{item.name}</div>
        {item.reason ? <div className="tile-reason">{item.reason}</div> : null}
        {item.link ? (
          <a className="tile-buy" href={item.link} target="_blank" rel="noopener noreferrer">Buy</a>
        ) : null}
      </div>
    </article>
  )
}
