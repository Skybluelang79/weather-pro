import { describe, it, expect } from 'vitest'
import {
  getWeatherIcon,
  getWeatherType,
  formatTemp,
  getWindDirection,
  getAQILevel,
  formatTime,
} from '../services/helpers'

describe('getWeatherIcon', () => {
  it('returns correct icon for known codes', () => {
    expect(getWeatherIcon('01d')).toBe('☀️')
    expect(getWeatherIcon('01n')).toBe('🌙')
    expect(getWeatherIcon('10d')).toBe('🌦️')
    expect(getWeatherIcon('13d')).toBe('❄️')
  })

  it('returns fallback for unknown code', () => {
    expect(getWeatherIcon('99d')).toBe('🌤️')
  })
})

describe('getWeatherType', () => {
  it('classifies clear sky', () => {
    expect(getWeatherType('01d')).toBe('clear')
  })

  it('classifies clouds', () => {
    expect(getWeatherType('02d')).toBe('clouds')
    expect(getWeatherType('04d')).toBe('clouds')
  })

  it('classifies rain', () => {
    expect(getWeatherType('10d')).toBe('rain')
    expect(getWeatherType('09n')).toBe('rain')
  })

  it('classifies storm', () => {
    expect(getWeatherType('11d')).toBe('storm')
  })

  it('classifies snow', () => {
    expect(getWeatherType('13d')).toBe('snow')
  })

  it('classifies fog', () => {
    expect(getWeatherType('50d')).toBe('fog')
  })

  it('returns clear for falsy input', () => {
    expect(getWeatherType(null)).toBe('clear')
  })
})

describe('formatTemp', () => {
  it('formats Celsius', () => {
    expect(formatTemp(25)).toBe('25°C')
    expect(formatTemp(0)).toBe('0°C')
    expect(formatTemp(-5)).toBe('-5°C')
  })

  it('formats Fahrenheit', () => {
    expect(formatTemp(25, 'F')).toBe('77°F')
    expect(formatTemp(0, 'F')).toBe('32°F')
  })
})

describe('getWindDirection', () => {
  it('returns correct cardinal direction', () => {
    expect(getWindDirection(0)).toBe('N')
    expect(getWindDirection(90)).toBe('E')
    expect(getWindDirection(180)).toBe('S')
    expect(getWindDirection(270)).toBe('W')
  })
})

describe('getAQILevel', () => {
  it('returns level for each AQI value', () => {
    expect(getAQILevel(1).label).toBe('Good')
    expect(getAQILevel(3).label).toBe('Moderate')
    expect(getAQILevel(5).label).toBe('Very Poor')
  })
})

describe('formatTime', () => {
  it('formats time from unix timestamp and timezone offset', () => {
    const result = formatTime(7200, 0)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})
