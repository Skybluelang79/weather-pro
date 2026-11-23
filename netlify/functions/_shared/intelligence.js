const WEATHER_CODES = [
  { codes: [0], description: 'Clear sky', icon: '01d' },
  { codes: [1, 2], description: 'Partly cloudy', icon: '02d' },
  { codes: [3], description: 'Overcast', icon: '03d' },
  { codes: [45, 48], description: 'Foggy', icon: '50d' },
  { codes: [51, 53, 55, 56, 57], description: 'Drizzle', icon: '09d' },
  { codes: [61, 63, 65, 66, 67], description: 'Rain', icon: '10d' },
  { codes: [71, 73, 75, 77], description: 'Snow', icon: '13d' },
  { codes: [80, 81, 82], description: 'Rain showers', icon: '10d' },
  { codes: [85, 86], description: 'Snow showers', icon: '13d' },
  { codes: [95, 96, 99], description: 'Thunderstorm', icon: '11d' },
];

export const DISCLAIMER = 'Illustrative forecast based on model data, not a live weather reading.';

export function weatherCodeInfo(code) {
  const match = WEATHER_CODES.find(entry => entry.codes.includes(code));
  return match || { description: 'Variable conditions', icon: '🌤️' };
}

export function unitLabels(units) {
  const imperial = units === 'imperial';
  return {
    temp: imperial ? '°F' : '°C',
    wind: imperial ? 'mph' : 'km/h',
    rain: imperial ? 'in' : 'mm',
  };
}

function timeLabel(value) {
  return typeof value === 'string' && value.length >= 16 ? value.slice(11, 16) : '--:--';
}

function round(value) {
  return Math.round(Number(value) || 0);
}

export function generateRuleAnswer({ question = '', location = {}, daily = [], hourly = [], units = 'metric' } = {}) {
  const labels = unitLabels(units);
  const place = location.name || 'your area';
  const today = daily[0];
  const tomorrow = daily[1];

  if (!today) {
    return {
      answer: `Forecast data is not available for ${place} right now. Try again in a moment or search for another location.`,
      provider: 'rules',
      disclaimer: DISCLAIMER,
    };
  }

  const q = question.toLowerCase();
  const nextHours = hourly.slice(0, 24);
  const peakRain = nextHours.reduce((best, hour) => (
    !best || hour.precipProbability > best.precipProbability ? hour : best
  ), null);
  const maxGust = nextHours.reduce((max, hour) => Math.max(max, hour.windGust || 0), 0);
  const bestTravel = nextHours.reduce((best, hour) => {
    if (!best) return hour;
    const score = (hour.precipProbability || 0) * 2 + Math.abs((hour.temp || 0) - (units === 'imperial' ? 72 : 22));
    const bestScore = (best.precipProbability || 0) * 2 + Math.abs((best.temp || 0) - (units === 'imperial' ? 72 : 22));
    return score < bestScore ? hour : best;
  }, null);

  let answer;

  if (/storm|thunder|lightning|severe|danger/.test(q)) {
    const storms = daily.slice(0, 3).filter(day => day.code >= 95);
    answer = storms.length
      ? `Thunderstorms are in the outlook for ${place} on ${storms.map(day => day.dayLabel).join(' and ')}. Peak gusts near ${round(maxGust)} ${labels.wind}. Keep devices charged and avoid exposed areas during lightning.`
      : `No thunderstorms are indicated for ${place} in the next three days. The strongest expected gust is about ${round(maxGust)} ${labels.wind}. Conditions can still change, so check updates before travelling.`;
  } else if (/rain|umbrella|wet|precipitation|flood/.test(q)) {
    const chance = peakRain ? round(peakRain.precipProbability) : round(today.precipProbability);
    const timing = peakRain ? ` around ${timeLabel(peakRain.time)}` : ' today';
    const amount = round(today.precipSum || 0);
    answer = `Rain chance in ${place} peaks at about ${chance}%${timing}, with roughly ${amount} ${labels.rain} expected today. ${chance >= 60 ? 'Carry an umbrella and allow extra travel time.' : 'A light rain jacket should be enough if you are out for long.'}`;
  } else if (/travel|commute|drive|best time|outside|outdoor|run|walk|picnic/.test(q)) {
    if (!bestTravel) {
      answer = `Hourly guidance is unavailable for ${place} right now. Today's high is ${round(today.tempMax)}${labels.temp} with a ${round(today.precipProbability)}% rain chance.`;
    } else {
      answer = `The most comfortable window in ${place} is around ${timeLabel(bestTravel.time)}, with ${round(bestTravel.temp)}${labels.temp} and a ${round(bestTravel.precipProbability)}% rain chance. Overall today: high ${round(today.tempMax)}${labels.temp}, low ${round(today.tempMin)}${labels.temp}, gusts up to ${round(maxGust)} ${labels.wind}.`;
    }
  } else if (/tomorrow|compare|difference|change/.test(q)) {
    if (!tomorrow) {
      answer = `Tomorrow's data is not available for ${place} yet. Today's high is ${round(today.tempMax)}${labels.temp} with a ${round(today.precipProbability)}% rain chance.`;
    } else {
      const delta = round(tomorrow.tempMax - today.tempMax);
      const direction = delta > 0 ? `warmer by ${delta}${labels.temp}` : delta < 0 ? `cooler by ${Math.abs(delta)}${labels.temp}` : 'about the same temperature';
      answer = `Tomorrow in ${place} looks ${direction} than today. Highs ${round(tomorrow.tempMax)}${labels.temp} versus ${round(today.tempMax)}${labels.temp} today, with rain chances of ${round(tomorrow.precipProbability)}% and ${round(today.precipProbability)}% respectively.`;
    }
  } else if (/wind|gust/.test(q)) {
    answer = `Winds in ${place} are forecast to reach ${round(today.windSpeed)} ${labels.wind} with gusts near ${round(today.windGust)} ${labels.wind}. Secure loose items if you are outdoors, especially during the stronger afternoon hours.`;
  } else {
    const outlook = daily.slice(0, 3).map(day => `${day.dayLabel} ${round(day.tempMax)}${labels.temp}/${round(day.tempMin)}${labels.temp}, ${round(day.precipProbability)}% rain`).join('; ');
    answer = `${place} is expected to be ${today.description.toLowerCase()} today, with a high of ${round(today.tempMax)}${labels.temp}, a low of ${round(today.tempMin)}${labels.temp}, and a ${round(today.precipProbability)}% rain chance. Next days: ${outlook}. Ask me about rain, the best time to travel, storms, or tomorrow.`;
  }

  return { answer, provider: 'rules', disclaimer: DISCLAIMER };
}

export async function generateAIAnswer({ question, location, daily, hourly, units, fetchImpl = fetch } = {}) {
  const fallback = () => generateRuleAnswer({ question, location, daily, hourly, units });
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback();

  const endpoint = process.env.AI_API_BASE || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const labels = unitLabels(units);
  const context = {
    location: location.name || 'unknown',
    units: labels,
    today: daily[0] || null,
    nextDays: daily.slice(0, 7),
    nextHours: hourly.slice(0, 24),
  };

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 320,
        messages: [
          {
            role: 'system',
            content: `You are a concise weather intelligence assistant. Use only the provided forecast data, never invent readings, and keep answers under 90 words. Mention that figures are model estimates when relevant. Data: ${JSON.stringify(context)}`,
          },
          { role: 'user', content: question || 'Summarise today and give one practical recommendation.' },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('AI provider returned no answer');
    return { answer, provider: 'ai', disclaimer: DISCLAIMER };
  } catch (error) {
    const result = fallback();
    return { ...result, fallbackReason: error.message };
  }
}

export function evaluateRule(rule, forecast, airQuality = null) {
  const hourly = forecast?.hourly || [];
  const nextDay = hourly.slice(0, 24);
  let value = null;
  let detail = '';

  if (rule.metric === 'temperature') {
    value = nextDay.length ? nextDay[0].temp : null;
    detail = `Current model temperature is ${round(value)}${unitLabels(forecast?.units).temp}`;
  } else if (rule.metric === 'rain_probability') {
    const hours = Math.max(1, Math.ceil((rule.leadMinutes || 0) / 60));
    const windowHours = hourly.slice(0, hours);
    const peak = windowHours.reduce((best, hour) => (!best || hour.precipProbability > best.precipProbability ? hour : best), null);
    value = peak ? peak.precipProbability : null;
    detail = `Rain chance reaches ${round(value)}% by ${timeLabel(peak?.time)} within ${hours}h`;
  } else if (rule.metric === 'wind_speed') {
    value = nextDay.reduce((max, hour) => Math.max(max, hour.windGust || hour.windSpeed || 0), 0);
    detail = `Peak wind gust is ${round(value)} ${unitLabels(forecast?.units).wind}`;
  } else if (rule.metric === 'air_quality') {
    value = airQuality;
    detail = airQuality === null ? 'Air quality data is unavailable here' : `US AQI is ${round(airQuality)}`;
  }

  if (value === null || !Number.isFinite(value)) {
    return { triggered: false, value: null, reason: 'Not enough data to evaluate this rule' };
  }

  const triggered = rule.operator === 'below' ? value < rule.threshold : value > rule.threshold;
  return {
    triggered,
    value,
    reason: `${detail}. Your threshold is ${rule.threshold}${rule.metric === 'rain_probability' ? '%' : ''}.`,
  };
}
