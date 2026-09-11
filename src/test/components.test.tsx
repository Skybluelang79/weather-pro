import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '../components/Toast'
import Favorites from '../components/Favorites'
import History from '../components/History'
import SearchChips from '../components/SearchChips'
import Footer from '../components/Footer'
import SunArc from '../components/SunArc'
import { generateFaviconSVG } from '../services/helpers'
import type { Favorite, HistoryEntry } from '../types'

// Helper to render with ToastProvider
function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('Favorites', () => {
  const favs: Favorite[] = [
    { id: '1', city: 'London', country: 'GB', addedAt: Date.now() },
    { id: '2', city: 'Paris', country: 'FR', addedAt: Date.now() },
  ]

  it('renders favorite cities', () => {
    render(<Favorites favorites={favs} onClick={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('London')).toBeDefined()
    expect(screen.getByText('Paris')).toBeDefined()
  })

  it('calls onClick when favorite clicked', () => {
    const onClick = vi.fn()
    render(<Favorites favorites={favs} onClick={onClick} onRemove={() => {}} />)
    fireEvent.click(screen.getByText('London'))
    expect(onClick).toHaveBeenCalledWith(favs[0])
  })

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    render(<Favorites favorites={favs} onClick={() => {}} onRemove={onRemove} />)
    const removeButtons = screen.getAllByTitle('Remove')
    fireEvent.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('1')
  })
})

describe('History', () => {
  const entries: HistoryEntry[] = [
    { id: '1', city: 'Tokyo', country: 'JP', timestamp: Date.now() },
    { id: '2', city: 'Berlin', country: 'DE', timestamp: Date.now() },
  ]

  it('renders history entries', () => {
    render(<History history={entries} onSearch={() => {}} onRemove={() => {}} onClear={() => {}} />)
    expect(screen.getByText('Tokyo')).toBeDefined()
    expect(screen.getByText('Berlin')).toBeDefined()
  })

  it('calls onSearch when entry clicked', () => {
    const onSearch = vi.fn()
    render(<History history={entries} onSearch={onSearch} onRemove={() => {}} onClear={() => {}} />)
    fireEvent.click(screen.getByText('Tokyo'))
    expect(onSearch).toHaveBeenCalledWith('Tokyo')
  })

  it('shows Clear All button when entries exist', () => {
    render(<History history={entries} onSearch={() => {}} onRemove={() => {}} onClear={() => {}} />)
    expect(screen.getByText('Clear All')).toBeDefined()
  })

  it('calls onClear when Clear All clicked', () => {
    const onClear = vi.fn()
    render(<History history={entries} onSearch={() => {}} onRemove={() => {}} onClear={onClear} />)
    fireEvent.click(screen.getByText('Clear All'))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('SearchChips', () => {
  const entries: HistoryEntry[] = [
    { id: '1', city: 'Madrid', country: 'ES', timestamp: Date.now() },
  ]

  it('renders city chips', () => {
    render(<SearchChips history={entries} onSelect={() => {}} />)
    expect(screen.getByText('Madrid')).toBeDefined()
  })

  it('returns null for empty history', () => {
    const { container } = render(<SearchChips history={[]} onSelect={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onSelect when chip clicked', () => {
    const onSelect = vi.fn()
    render(<SearchChips history={entries} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Madrid'))
    expect(onSelect).toHaveBeenCalledWith('Madrid')
  })
})

describe('Footer', () => {
  it('renders brand text', () => {
    render(<Footer />)
    expect(screen.getByText('WeatherPro')).toBeDefined()
  })
})

describe('SunArc', () => {
  const sunrise = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  const sunset = Math.floor(Date.now() / 1000) + 3600  // 1 hour from now

  it('renders sunrise and sunset labels', () => {
    render(<SunArc sunrise={sunrise} sunset={sunset} timezone={0} />)
    expect(screen.getByText('Daytime')).toBeDefined()
  })

  it('shows Nighttime outside sun hours', () => {
    const pastSunrise = Math.floor(Date.now() / 1000) - 7200
    const pastSunset = Math.floor(Date.now() / 1000) - 3600
    render(<SunArc sunrise={pastSunrise} sunset={pastSunset} timezone={0} />)
    expect(screen.getByText('Nighttime')).toBeDefined()
  })
})

describe('Toast', () => {
  function TestComponent() {
    const { addToast } = useToast()
    return (
      <button onClick={() => addToast('Test message', 'success')}>
        Show Toast
      </button>
    )
  }

  it('renders toast when addToast called', () => {
    renderWithToast(<TestComponent />)
    fireEvent.click(screen.getByText('Show Toast'))
    expect(screen.getByText('Test message')).toBeDefined()
  })
})

describe('Dynamic Favicon', () => {
  it('generateFaviconSVG returns valid SVG string', () => {
    const svg = generateFaviconSVG('01d')
    expect(svg).toContain('<svg')
    expect(svg).toContain('☀️')
  })

  it('generateFaviconSVG handles night icons', () => {
    const svg = generateFaviconSVG('01n')
    expect(svg).toContain('🌙')
  })

  it('generateFaviconSVG handles unknown icons', () => {
    const svg = generateFaviconSVG('99d')
    expect(svg).toContain('🌤️')
  })
})
