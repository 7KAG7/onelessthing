import React, {useState} from 'react'
import { FaHatCowboy, FaTshirt, FaShoePrints, FaUmbrella, FaGem, FaBoxOpen } from 'react-icons/fa'

type TileItem = {
  name: string
  reason?: string
  link?: string
  image?: string
}

function IconForSlot({ slot, size = 48 }: { slot: string; size?: number }) {
  const common = { size }
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

export default function Tile({ slot, item, gender }: { slot: string; item: TileItem; gender?: string }) {
  const [showImage, setShowImage] = useState(Boolean(item.image))

  function handleError() {
    setShowImage(false)
  }

  console.debug('Tile', slot, item.name, 'showImage=', showImage)

  return (
    <article className="tile">
      <div className="tile-media">
        {showImage && item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" onError={handleError} />
        ) : (
          <div className="tile-placeholder" aria-hidden>
            <div className="tile-icon"><IconForSlot slot={slot} size={44} /></div>
            <div className="tile-initials">{(item.name || '').split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase()}</div>
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
