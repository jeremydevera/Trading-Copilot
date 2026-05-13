import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchFuturesSymbols, type FuturesSymbolInfo } from '../services/BackendMarketService';

interface SearchableCoinSelectProps {
  value: string; // e.g. "BTC/USDT"
  onChange: (pair: string) => void;
}

// Popular symbols to show at the top when search is empty
const POPULAR_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT'];

export default function SearchableCoinSelect({ value, onChange }: SearchableCoinSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [symbols, setSymbols] = useState<FuturesSymbolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch symbols on first open
  useEffect(() => {
    if (isOpen && symbols.length === 0 && !loading && !error) {
      setLoading(true);
      fetchFuturesSymbols()
        .then((data) => {
          setSymbols(data);
          setError(null);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load symbols');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, symbols.length, loading, error]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSymbols = useMemo(() => {
    if (!search.trim()) {
      // Show popular symbols first, then all others
      const popular = symbols.filter(s => POPULAR_SYMBOLS.includes(s.pair));
      const others = symbols.filter(s => !POPULAR_SYMBOLS.includes(s.pair));
      return [...popular, ...others];
    }
    const q = search.toUpperCase();
    return symbols.filter(
      s => s.symbol.includes(q) || s.baseAsset.includes(q) || s.pair.toUpperCase().includes(q)
    );
  }, [symbols, search]);

  const handleSelect = (pair: string) => {
    onChange(pair);
    setIsOpen(false);
    setSearch('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Focus input after a tick so the DOM is ready
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={handleOpen}
        className="bg-transparent text-base font-semibold text-white outline-none cursor-pointer flex items-center gap-1 hover:text-blue-400 transition-colors"
      >
        <span>{value}</span>
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search coins (e.g. BTC, ETH...)"
              className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearch('');
                }
              }}
            />
          </div>

          {/* Symbol list */}
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                <div className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                Loading symbols...
              </div>
            )}
            {error && (
              <div className="px-3 py-4 text-center text-red-400 text-sm">
                Failed to load symbols. Using defaults.
                <button
                  onClick={() => { setError(null); setSymbols([]); }}
                  className="block mx-auto mt-1 text-blue-400 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !error && filteredSymbols.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">No symbols found</div>
            )}
            {!loading && !error && filteredSymbols.map(s => (
              <button
                key={s.symbol}
                onClick={() => handleSelect(s.pair)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  s.pair === value ? 'bg-gray-700 text-blue-400' : 'text-gray-300'
                }`}
              >
                <img
                  src={`https://assets.coincap.io/assets/icons/${s.baseAsset.toLowerCase()}@2x.png`}
                  alt={s.baseAsset}
                  className="w-4 h-4 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="font-medium">{s.baseAsset}</span>
                <span className="text-gray-500">/{s.quoteAsset}</span>
                {POPULAR_SYMBOLS.includes(s.pair) && search === '' && (
                  <span className="ml-auto text-[10px] text-yellow-500">★</span>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          {!loading && !error && symbols.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] text-gray-600 border-t border-gray-700">
              {filteredSymbols.length} symbol{filteredSymbols.length !== 1 ? 's' : ''} · Binance Futures Perpetual
            </div>
          )}
        </div>
      )}
    </div>
  );
}