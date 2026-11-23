import { useState } from 'react';
import { api } from '../services/api';
import { useSubscription } from '../context/subscription';
import UpgradeCard from './UpgradeCard';
import type { AIAnswer } from '../types';

interface AIAssistantProps {
  lat: number;
  lon: number;
  city: string;
  unit: string;
  onUpgrade: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  provider?: AIAnswer['provider'];
}

const SUGGESTIONS = [
  'Explain today’s weather',
  'When is the best time to travel?',
  'Will it rain today?',
  'How does tomorrow compare?',
  'Any storm or wind risks?',
];

export default function AIAssistant({ lat, lon, city, unit, onUpgrade }: AIAssistantProps) {
  const { hasFeature } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!hasFeature('aiAssistant')) {
    return (
      <UpgradeCard
        title="AI Weather Intelligence"
        description="Ask questions about rainfall, travel timing, storms and tomorrow's weather. Subscribers get plain-language answers grounded in forecast data."
        onUpgrade={onUpgrade}
      />
    );
  }

  const ask = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || loading) return;
    setQuestion('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', text: prompt }]);
    setLoading(true);
    try {
      const answer = await api.askAI({
        question: prompt,
        city,
        lat,
        lon,
        units: unit === 'F' ? 'imperial' : 'metric',
      });
      setMessages(prev => [...prev, { role: 'assistant', text: answer.answer, provider: answer.provider }]);
    } catch (err) {
      setError((err as Error).message || 'The assistant is unavailable right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-panel glass-panel animate-slide-up">
      <div className="ai-header">
        <div>
          <div className="section-title">Weather AI Assistant <span className="pro-chip">PRO</span></div>
          <p className="premium-subtitle">Practical guidance for {city || 'your location'}, based on model forecast data</p>
        </div>
        <div className="ai-orb">✦</div>
      </div>

      {messages.length === 0 && (
        <div className="ai-suggestions">
          {SUGGESTIONS.map(suggestion => (
            <button key={suggestion} className="ai-suggestion" onClick={() => ask(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="ai-thread">
        {messages.map((message, index) => (
          <div key={index} className={`ai-message ${message.role}`}>
            <span className="ai-avatar">{message.role === 'user' ? 'You' : '✦'}</span>
            <div className="ai-bubble">
              {message.text}
              {message.role === 'assistant' && (
                <span className="ai-provider">{message.provider === 'ai' ? 'AI generated' : 'Forecast engine'}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-message assistant">
            <span className="ai-avatar">✦</span>
            <div className="ai-bubble ai-typing">Reading the forecast<span>.</span><span>.</span><span>.</span></div>
          </div>
        )}
      </div>

      {error && <div className="premium-error">{error}</div>}

      <form
        className="ai-input-row"
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
      >
        <input
          className="ai-input"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask about today's weather…"
          maxLength={600}
          aria-label="Ask the weather assistant"
        />
        <button className="ai-send" type="submit" disabled={loading || !question.trim()}>Ask</button>
      </form>

      <p className="premium-disclaimer">Illustrative guidance based on forecast data, not a live weather reading.</p>
    </section>
  );
}
