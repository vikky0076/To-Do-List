import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
}

export default function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState('');

  const generatePassword = () => {
    if (!useUpper && !useLower && !useNumbers && !useSymbols) return;

    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    
    let charPool = '';
    if (useUpper) charPool += upper;
    if (useLower) charPool += lower;
    if (useNumbers) charPool += numbers;
    if (useSymbols) charPool += symbols;

    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    let generated = '';
    for (let i = 0; i < length; i++) {
      generated += charPool[randomValues[i] % charPool.length];
    }

    setPassword(generated);
  };

  useEffect(() => {
    generatePassword();
  }, []);

  const getStrength = () => {
    let score = 0;
    if (length > 12) score += 1;
    if (length > 16) score += 1;
    if (useUpper) score += 1;
    if (useNumbers) score += 1;
    if (useSymbols) score += 1;

    if (score < 3) return { label: 'Weak', color: 'text-red-500 bg-red-50' };
    if (score < 5) return { label: 'Medium', color: 'text-amber-500 bg-amber-50' };
    return { label: 'Strong', color: 'text-emerald-500 bg-emerald-50' };
  };

  const strength = getStrength();

  return (
    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
        <span className="font-mono text-gray-900 tracking-wider truncate mr-4">{password}</span>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={generatePassword}
            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onGenerate(password)}
            className="text-xs font-medium bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Use
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Password Strength</span>
        <span className={`px-2 py-0.5 rounded-md font-medium text-xs ${strength.color}`}>
          {strength.label}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Length: {length}</span>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={length}
          onChange={(e) => {
            setLength(Number(e.target.value));
            generatePassword();
          }}
          className="w-full accent-primary-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={useUpper} onChange={(e) => { setUseUpper(e.target.checked); generatePassword(); }} className="rounded text-primary-600 focus:ring-primary-500" />
          <span>Uppercase</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={useLower} onChange={(e) => { setUseLower(e.target.checked); generatePassword(); }} className="rounded text-primary-600 focus:ring-primary-500" />
          <span>Lowercase</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={useNumbers} onChange={(e) => { setUseNumbers(e.target.checked); generatePassword(); }} className="rounded text-primary-600 focus:ring-primary-500" />
          <span>Numbers</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={useSymbols} onChange={(e) => { setUseSymbols(e.target.checked); generatePassword(); }} className="rounded text-primary-600 focus:ring-primary-500" />
          <span>Symbols</span>
        </label>
      </div>
    </div>
  );
}
