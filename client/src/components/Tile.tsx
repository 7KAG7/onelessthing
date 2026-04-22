import React, {useEffect, useMemo, useState} from 'react'
import { FaHatCowboy, FaTshirt, FaShoePrints, FaUmbrella, FaGem, FaBoxOpen, FaRegThumbsUp, FaThumbsDown, FaThumbsUp } from 'react-icons/fa'
import { GiTrousers, GiGloves } from 'react-icons/gi'

type TileItem = {
  name: string
  reason?: string
  link?: string
  image?: string | string[]
  images?: string[]
  imageOptions?: string[]
  options?: TileOption[]
}

type TileOption =
  | string
  | {
      image?: string | string[]
      imageUrl?: string
      name?: string
      reason?: string
      link?: string
      url?: string
      images?: string[]
      imageOptions?: string[]
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

function firstString(values?: string[]) {
  return values?.find((value) => typeof value === 'string' && value.trim())?.trim() || ''
}

function optionImage(option: Exclude<TileOption, string>) {
  return (
    (Array.isArray(option.image) ? firstString(option.image) : option.image?.trim()) ||
    option.imageUrl?.trim() ||
    firstString(option.images) ||
    firstString(option.imageOptions) ||
    option.url?.trim() ||
    ''
  )
}

function firstOptionImage(options?: TileItem['options']) {
  if (!options?.length) return ''

  for (const option of options) {
    if (typeof option === 'string' && option.trim()) return option.trim()
    if (!option || typeof option !== 'object') continue

    const image = optionImage(option)
    if (image) return image
  }

  return ''
}

function getFirstItemImage(item: TileItem) {
  if (Array.isArray(item.image)) return firstString(item.image)
  if (typeof item.image === 'string' && item.image.trim()) return item.image.trim()
  return firstString(item.images) || firstString(item.imageOptions) || firstOptionImage(item.options)
}

function optionCount(item: TileItem) {
  return Math.max(
    item.options?.length || 0,
    Array.isArray(item.image) ? item.image.length : 0,
    item.images?.length || 0,
    item.imageOptions?.length || 0
  )
}

function getImageAtIndex(item: TileItem, index: number) {
  const options = item.options || []
  if (options.length) {
    const option = options[index % options.length]
    if (typeof option === 'string') return option.trim()
    if (option && typeof option === 'object') return optionImage(option)
  }

  if (Array.isArray(item.image) && item.image.length) return firstString([item.image[index % item.image.length]])
  if (item.images?.length) return firstString([item.images[index % item.images.length]])
  if (item.imageOptions?.length) return firstString([item.imageOptions[index % item.imageOptions.length]])
  return getFirstItemImage(item)
}

function getItemAtIndex(item: TileItem, index: number): TileItem {
  const options = item.options || []
  if (!options.length) return item

  const option = options[index % options.length]
  if (typeof option === 'string') {
    return { ...item, image: option }
  }
  if (!option || typeof option !== 'object') return item

  const image = optionImage(option)
  return {
    ...item,
    name: option.name || item.name,
    reason: option.reason || item.reason,
    link: option.link || item.link,
    image: image || item.image
  }
}

function likedStorageKey(slot: string, itemName: string) {
  return `olt_tile_liked_${slot}_${itemName}`.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
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
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const [previewImageOffset, setPreviewImageOffset] = useState(0)
  const storageKey = useMemo(() => likedStorageKey(slot, item.name), [slot, item.name])
  const [liked, setLiked] = useState(() => localStorage.getItem(storageKey) === 'true')
  const selectedItem = useMemo(() => getItemAtIndex(item, selectedOptionIndex), [item, selectedOptionIndex])
  const effectiveAffiliateImageIndex = affiliateImageIndex + previewImageOffset

  const imageSrc = useMemo(() => {
    const itemImage = getImageAtIndex(item, selectedOptionIndex)
    if (itemImage) return itemImage
    if (selectedItem.link) {
      return `${apiBase}/api/preview-image?url=${encodeURIComponent(selectedItem.link)}&idx=${effectiveAffiliateImageIndex}`
    }
    return ''
  }, [apiBase, item, selectedItem.link, selectedOptionIndex, effectiveAffiliateImageIndex])

  const [showImage, setShowImage] = useState(Boolean(imageSrc))

  useEffect(() => {
    setSelectedOptionIndex(0)
    setPreviewImageOffset(0)
  }, [item])

  useEffect(() => {
    setLiked(localStorage.getItem(storageKey) === 'true')
  }, [storageKey])

  useEffect(() => {
    setShowImage(Boolean(imageSrc))
  }, [imageSrc])

  function notifySettled() {
    if (!affiliateKey || !onImageSettled || !imageSrc) return
    onImageSettled(affiliateKey, effectiveAffiliateImageIndex, imageSrc)
  }

  function handleLoad() {
    notifySettled()
  }

  function handleError() {
    notifySettled()
    setShowImage(false)
  }

  function handleLike() {
    localStorage.setItem(storageKey, 'true')
    setLiked(true)
  }

  function handleDislike() {
    setLiked(false)
    localStorage.removeItem(storageKey)

    const count = optionCount(item)
    if (count > 1) {
      setSelectedOptionIndex((current) => (current + 1) % count)
      return
    }

    if (selectedItem.link) {
      setPreviewImageOffset((current) => current + 1)
    }
  }

  return (
    <article className="tile">
      <div className="tile-media">
        {showImage && imageSrc ? (
          selectedItem.link ? (
            <a className="tile-media-link" href={selectedItem.link} target="_blank" rel="noopener noreferrer" aria-label={`View ${selectedItem.name} product`}>
              <img src={imageSrc} alt={selectedItem.name} loading="lazy" onLoad={handleLoad} onError={handleError} />
            </a>
          ) : (
            <img src={imageSrc} alt={selectedItem.name} loading="lazy" onLoad={handleLoad} onError={handleError} />
          )
        ) : (
          <div className="tile-placeholder" aria-hidden>
            <div className="tile-fallback-icon"><IconForItem slot={slot} itemName={selectedItem.name} size={42} /></div>
          </div>
        )}
      </div>
      <div className="tile-body">
        <div className="tile-slot">{slot.toUpperCase()}</div>
        <div className="tile-name">{selectedItem.name}</div>
        {selectedItem.reason ? <div className="tile-reason">{selectedItem.reason}</div> : null}
        {selectedItem.link ? (
          <a className="tile-buy" href={selectedItem.link} target="_blank" rel="noopener noreferrer">Check it out!</a>
        ) : null}
      </div>
      <div className="tile-feedback" aria-label={`Feedback for ${selectedItem.name}`}>
        <button
          type="button"
          className={`tile-feedback-btn ${liked ? 'tile-feedback-btn--liked' : ''}`}
          onClick={handleLike}
          aria-pressed={liked}
          aria-label={`Like ${selectedItem.name}`}
          title="Like"
        >
          {liked ? <FaThumbsUp size={15} /> : <FaRegThumbsUp size={15} />}
        </button>
        <button
          type="button"
          className="tile-feedback-btn"
          onClick={handleDislike}
          aria-label={`Show another ${slot} option`}
          title="Show another option"
        >
          <FaThumbsDown size={15} />
        </button>
      </div>
    </article>
  )
}
