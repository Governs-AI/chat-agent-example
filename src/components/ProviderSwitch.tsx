'use client';

import { Provider } from '@/lib/types';

const OPTIONS: { value: Provider; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
];

interface ProviderSwitchProps {
  provider: Provider;
  onChange: (provider: Provider) => void;
  className?: string;
}

export default function ProviderSwitch({ provider, onChange, className = '' }: ProviderSwitchProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-gray-700">Provider:</span>
      <div className="flex bg-gray-100 rounded-lg p-1">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              provider === value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
