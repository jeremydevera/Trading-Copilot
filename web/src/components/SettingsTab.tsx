import { useEffect, useState } from 'react';
import { setFiatCurrency, getExchangeRate } from '../engine/formatters';
import { BUY_SOUND_OPTIONS, SELL_SOUND_OPTIONS, previewSound, type SoundId } from '../engine/sounds';
import { useAuth } from '../hooks/useAuth';
import { saveUserConfigToSupabase } from '../services/SupabaseSync';
import { getSocketFeeds, type SocketFeedConfig } from '../data/socketFeeds';
import { fetchAIAnalysis, type AIAnalysisResult } from '../services/BackendMarketService';

interface SettingsTabProps { vm: any; }

export default function SettingsTab({ vm }: SettingsTabProps) {
  const { user } = useAuth();
  const pt = vm.paperTrading;
  const socketFeeds: SocketFeedConfig[] = getSocketFeeds(vm.cryptoPair);
  const [pendingFeedId, setPendingFeedId] = useState(vm.selectedLiveFeedId ?? 'binance-futures-bookticker');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const selectedFeed = socketFeeds.find(feed => feed.id === vm.selectedLiveFeedId) ?? socketFeeds.find(feed => feed.id === 'binance-futures-bookticker');
  const pendingFeed = socketFeeds.find(feed => feed.id === pendingFeedId) ?? selectedFeed;
  const feedGroups = socketFeeds.reduce<Record<string, SocketFeedConfig[]>>((groups, feed) => {
    groups[feed.provider] = groups[feed.provider] ?? [];
    groups[feed.provider].push(feed);
    return groups;
  }, {});

  useEffect(() => {
    setPendingFeedId(vm.selectedLiveFeedId ?? 'binance-futures-bookticker');
  }, [vm.selectedLiveFeedId, vm.cryptoPair]);

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 px-6 py-3 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
      </div>

      <div className="p-6 space-y-5 max-w-3xl mx-auto">

      {/* Paper Trading */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Paper Trading</h2>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Demo Balance</label>
            <input
              type="number"
              value={pt.demoBalance}
              onChange={e => {
                const balance = Number(e.target.value);
                vm.setDemoBalance(balance);
                if (user) saveUserConfigToSupabase({ accountSize: balance }).catch(() => {});
              }}
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-green-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Investment Amount</label>
            <input
              type="number"
              value={vm.investmentAmount}
              onChange={e => vm.setInvestmentAmount(Number(e.target.value))}
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-green-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Fiat Currency</label>
            <select
              value={vm.fiatCurrency}
              onChange={e => { vm.setFiatCurrency(e.target.value); setFiatCurrency(e.target.value); }}
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-green-500 outline-none transition-colors appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="USD">USD ($)</option>
              <option value="PHP">PHP (₱)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="KRW">KRW (₩)</option>
              <option value="INR">INR (₹)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
            {vm.fiatCurrency !== 'USD' && (
              <p className="text-xs text-gray-500 mt-1.5">Rate: 1 USD = {getExchangeRate().toFixed(2)} {vm.fiatCurrency}</p>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <div>
              <p className="text-sm text-gray-200 font-medium">Auto-Trade</p>
              <p className="text-xs text-gray-500 mt-0.5">Automatically execute paper trades on signal changes</p>
            </div>
            <button
              onClick={() => vm.toggleAutoTrade(!vm.autoTradeEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${vm.autoTradeEnabled ? 'bg-green-600' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${vm.autoTradeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {vm.autoTradeEnabled && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
              <p className="text-xs text-yellow-400">⚠️ Auto-trade will automatically BUY on Strong Buy / Consider Buy signals and SELL on Sell / Exit / Consider Sell signals. Minimum 1 minute between trades.</p>
            </div>
          )}
      </div>

      {/* Alert Sounds */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Alert Sounds</h2>
        <div>
          <label className="text-sm text-gray-400 block mb-1.5">Buy Sound</label>
          <div className="flex items-center gap-2">
            <select
              value={vm.buySound}
              onChange={e => vm.setBuySound(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-green-500 outline-none transition-colors appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              {BUY_SOUND_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => previewSound(vm.buySound as SoundId)}
              className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 border border-gray-700 transition-colors"
              title="Preview buy sound"
            >
              ▶
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1.5">Sell Sound</label>
          <div className="flex items-center gap-2">
            <select
              value={vm.sellSound}
              onChange={e => vm.setSellSound(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-red-500 outline-none transition-colors appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              {SELL_SOUND_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => previewSound(vm.sellSound as SoundId)}
              className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 border border-gray-700 transition-colors"
              title="Preview sell sound"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Connection</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200 font-medium">WebSocket Feed</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Current: <span className="text-gray-300">{selectedFeed?.label ?? 'Backend Feed'}</span> via backend
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${vm.liveFeedStatus === 'connected' ? 'bg-green-900/50 text-green-400' : vm.liveFeedStatus === 'connecting' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${vm.liveFeedStatus === 'connected' ? 'bg-green-400' : vm.liveFeedStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              {vm.liveFeedStatus === 'connected' ? 'Connected' : vm.liveFeedStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>

          <div className="flex gap-2">
            <select
              value={pendingFeedId}
              onChange={e => setPendingFeedId(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 border border-gray-700 focus:border-blue-500 outline-none transition-colors"
            >
              {Object.entries(feedGroups).map(([provider, feeds]) => (
                <optgroup key={provider} label={provider}>
                  {feeds.map(feed => (
                    <option key={feed.id} value={feed.id}>{feed.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={() => vm.applyLiveFeed(pendingFeed?.id ?? pendingFeedId)}
              className="bg-blue-900/50 hover:bg-blue-800/50 text-blue-400 text-sm font-bold py-2 px-5 rounded-lg transition-colors disabled:opacity-50"
              disabled={pendingFeedId === vm.selectedLiveFeedId && vm.liveFeedStatus === 'connected'}
            >
              Apply
            </button>
          </div>
          <p className="text-xs text-gray-500">
            The browser connects to your backend; the backend owns the exchange connection.
          </p>
        </div>
        {vm.liveFeedMsgCount > 0 && (
          <p className="text-xs text-gray-500">
            {vm.liveFeedMsgCount.toLocaleString()} price updates received
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
          <p className="text-sm text-gray-400">Status: <span className="text-green-400">{vm.statusMessage}</span></p>
          <button
            onClick={() => vm.start()}
            className="bg-blue-900/50 hover:bg-blue-800/50 text-blue-400 text-sm font-bold py-2 px-5 rounded-lg transition-colors"
          >
            Reconnect All
          </button>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">🤖 AI Trade Analysis</h2>
        <p className="text-xs text-gray-500">Uses ChatGPT to analyze your trade history and suggest improvements to the signal scoring model.</p>
        <button
          onClick={async () => {
            if (!user) { setAiError('Sign in to use AI analysis'); return; }
            setAiLoading(true);
            setAiError(null);
            setAiResult(null);
            try {
              const result = await fetchAIAnalysis(user.id);
              setAiResult(result);
            } catch (err: any) {
              setAiError(err.message || 'AI analysis failed');
            } finally {
              setAiLoading(false);
            }
          }}
          disabled={aiLoading}
          className="w-full bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 text-sm font-bold py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Analyzing trades...
            </span>
          ) : '🔍 Analyze My Trades'}
        </button>

        {aiError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
            <p className="text-xs text-red-400">{aiError}</p>
          </div>
        )}

        {aiResult && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{aiResult.totalTrades}</p>
                <p className="text-[10px] text-gray-500">Trades</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-400">{aiResult.winRate.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-500">Win Rate</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-400">+{aiResult.avgProfitPercent.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-500">Avg Win</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-red-400">-{aiResult.avgLossPercent.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-500">Avg Loss</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-300">{aiResult.summary}</p>
            </div>

            {/* Best/Worst Conditions */}
            {aiResult.bestConditions.length > 0 && (
              <div>
                <p className="text-xs text-green-400 font-medium mb-1">✅ Best Conditions</p>
                <ul className="text-xs text-gray-400 space-y-0.5 ml-3 list-disc">
                  {aiResult.bestConditions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {aiResult.worstConditions.length > 0 && (
              <div>
                <p className="text-xs text-red-400 font-medium mb-1">❌ Worst Conditions</p>
                <ul className="text-xs text-gray-400 space-y-0.5 ml-3 list-disc">
                  {aiResult.worstConditions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* Weight Adjustments */}
            {aiResult.weightAdjustments.length > 0 && aiResult.weightAdjustments.some(w => w.currentMax !== w.suggestedMax) && (
              <div>
                <p className="text-xs text-purple-400 font-medium mb-1">📊 Suggested Weight Adjustments</p>
                <div className="space-y-1.5">
                  {aiResult.weightAdjustments.map((w, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300 font-medium">{w.category}</span>
                        <span className="text-xs text-gray-400">
                          {w.currentMax} → <span className={w.suggestedMax > w.currentMax ? 'text-green-400' : w.suggestedMax < w.currentMax ? 'text-red-400' : 'text-gray-400'}>{w.suggestedMax}</span> pts
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{w.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">About</h2>
        <p className="text-sm text-gray-500">AI Crypto Analyzer Web v1.0</p>
        <p className="text-sm text-gray-500">Real-time BTC/USDT analysis powered by Binance WebSocket</p>
        {user ? (
          <p className="text-xs text-green-500">☁️ Synced — settings & trades saved to your account</p>
        ) : (
          <p className="text-xs text-gray-600">Sign in to sync settings & trades across devices</p>
        )}
        <p className="text-xs text-gray-600">⚠️ This is for educational purposes only. Not financial advice.</p>
      </div>
    </div>
    </>
  );
}
