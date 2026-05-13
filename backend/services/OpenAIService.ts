// ============================================================
// OpenAI Service — Uses ChatGPT to analyze trade history
// and suggest adaptive weight adjustments
// ============================================================

import { supabaseAdmin } from '../lib/supabase.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface TradeRecord {
  symbol: string;
  entry_price: number;
  exit_price: number;
  invested_amount: number;
  profit_loss: number;
  profit_loss_percent: number;
  entry_decision: string | null;
  exit_decision: string | null;
  entry_score: number | null;
  entry_reward_risk: number | null;
  opened_at: string | null;
  closed_at: string;
  duration_minutes: number | null;
  source: string | null;
}

interface WeightAdjustment {
  category: string;
  currentMax: number;
  suggestedMax: number;
  reason: string;
}

export interface AIAnalysisResult {
  summary: string;
  winRate: number;
  totalTrades: number;
  avgProfitPercent: number;
  avgLossPercent: number;
  bestConditions: string[];
  worstConditions: string[];
  weightAdjustments: WeightAdjustment[];
  rawResponse: string;
}

// Current scoring model max points
const CURRENT_WEIGHTS: Record<string, number> = {
  higherTimeframeBias: 25,
  marketStructure: 25,
  liquidity: 15,
  volatilitySession: 15,
  riskReward: 15,
  indicatorConfirmation: 5,
};

export async function analyzeTradeHistory(userId: string): Promise<AIAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sk-your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY not configured. Add it to your .env file.');
  }

  // 1. Fetch trade history from Supabase
  const { data: trades, error } = await supabaseAdmin
    .from('trade_history')
    .select('*')
    .eq('user_id', userId)
    .order('closed_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch trade history: ${error.message}`);
  }

  if (!trades || trades.length === 0) {
    // Also check paper_trades for open/closed positions
    const { data: paperTrades, error: ptError } = await supabaseAdmin
      .from('paper_trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ptError) {
      throw new Error(`Failed to fetch paper trades: ${ptError.message}`);
    }

    if (!paperTrades || paperTrades.length === 0) {
      return {
        summary: 'No trade history yet. Place some paper trades first so the AI can learn from your results.',
        winRate: 0,
        totalTrades: 0,
        avgProfitPercent: 0,
        avgLossPercent: 0,
        bestConditions: [],
        worstConditions: [],
        weightAdjustments: [],
        rawResponse: '',
      };
    }

    // Use paper trades instead
    return analyzeWithAI(apiKey, paperTrades.map(formatPaperTrade), CURRENT_WEIGHTS);
  }

  return analyzeWithAI(apiKey, trades.map(formatTradeHistory), CURRENT_WEIGHTS);
}

function formatTradeHistory(t: any): TradeRecord {
  return {
    symbol: t.symbol,
    entry_price: Number(t.entry_price),
    exit_price: Number(t.exit_price),
    invested_amount: Number(t.invested_amount || 0),
    profit_loss: Number(t.profit_loss || 0),
    profit_loss_percent: Number(t.profit_loss_percent || 0),
    entry_decision: t.entry_decision,
    exit_decision: t.exit_decision,
    entry_score: t.entry_score,
    entry_reward_risk: Number(t.entry_reward_risk || 0),
    opened_at: t.opened_at,
    closed_at: t.closed_at,
    duration_minutes: Number(t.duration_minutes || 0),
    source: t.source,
  };
}

function formatPaperTrade(t: any): TradeRecord {
  const profitLoss = Number(t.profit_loss || 0);
  const entryPrice = Number(t.entry_price || 0);
  const exitPrice = Number(t.exit_price || 0);
  const profitPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;

  return {
    symbol: t.symbol,
    entry_price: entryPrice,
    exit_price: exitPrice,
    invested_amount: Number(t.invested_amount || 0),
    profit_loss: profitLoss,
    profit_loss_percent: profitPct,
    entry_decision: t.entry_decision || t.decision,
    exit_decision: null,
    entry_score: t.entry_score,
    entry_reward_risk: Number(t.entry_reward_risk || t.reward_risk || 0),
    opened_at: t.opened_at || t.created_at,
    closed_at: t.closed_at || t.created_at,
    duration_minutes: null,
    source: t.source || 'paper',
  };
}

async function analyzeWithAI(
  apiKey: string,
  trades: TradeRecord[],
  currentWeights: Record<string, number>
): Promise<AIAnalysisResult> {
  // Calculate basic stats
  const wins = trades.filter(t => t.profit_loss_percent > 0);
  const losses = trades.filter(t => t.profit_loss_percent <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgProfitPct = wins.length > 0 ? wins.reduce((s, t) => s + t.profit_loss_percent, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.profit_loss_percent, 0) / losses.length) : 0;

  // Build the prompt
  const systemPrompt = `You are a crypto trading signal analyst. You analyze trade history to find patterns in what works and what doesn't, then suggest adjustments to the signal scoring weights.

Current scoring model (max points per category):
- higherTimeframeBias: ${currentWeights.higherTimeframeBias} pts
- marketStructure: ${currentWeights.marketStructure} pts  
- liquidity: ${currentWeights.liquidity} pts
- volatilitySession: ${currentWeights.volatilitySession} pts
- riskReward: ${currentWeights.riskReward} pts
- indicatorConfirmation: ${currentWeights.indicatorConfirmation} pts

Analyze the trade data and respond in this EXACT JSON format (no markdown, no code blocks):
{
  "summary": "2-3 sentence analysis of overall performance",
  "bestConditions": ["list of conditions where trades won"],
  "worstConditions": ["list of conditions where trades lost"],
  "weightAdjustments": [
    {"category": "higherTimeframeBias", "currentMax": 25, "suggestedMax": 25, "reason": "why"},
    {"category": "marketStructure", "currentMax": 25, "suggestedMax": 25, "reason": "why"},
    {"category": "liquidity", "currentMax": 15, "suggestedMax": 15, "reason": "why"},
    {"category": "volatilitySession", "currentMax": 15, "suggestedMax": 15, "reason": "why"},
    {"category": "riskReward", "currentMax": 15, "suggestedMax": 15, "reason": "why"},
    {"category": "indicatorConfirmation", "currentMax": 5, "suggestedMax": 5, "reason": "why"}
  ]
}

Rules:
- Only suggest changes if there's clear statistical evidence (at least 5 trades)
- Keep total max points at 100 (sum of all suggestedMax must equal 100)
- Be conservative: small adjustments (1-3 pts) are better than big swings
- If fewer than 5 trades, keep all weights the same and explain why in the summary`;

  const userPrompt = `Here are my recent trades (${trades.length} total, ${wins.length} wins, ${losses.length} losses, ${winRate.toFixed(1)}% win rate):

${JSON.stringify(trades.slice(0, 50), null, 2)}

Win rate: ${winRate.toFixed(1)}%
Avg win: +${avgProfitPct.toFixed(2)}%
Avg loss: -${avgLossPct.toFixed(2)}%

Analyze these trades and suggest weight adjustments for the scoring model.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content ?? '';

  // Parse the JSON response
  try {
    // Strip markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || '',
      winRate,
      totalTrades: trades.length,
      avgProfitPercent: avgProfitPct,
      avgLossPercent: avgLossPct,
      bestConditions: parsed.bestConditions || [],
      worstConditions: parsed.worstConditions || [],
      weightAdjustments: (parsed.weightAdjustments || []).map((w: any) => ({
        category: w.category,
        currentMax: w.currentMax,
        suggestedMax: w.suggestedMax,
        reason: w.reason,
      })),
      rawResponse: content,
    };
  } catch {
    // If parsing fails, return the raw response
    return {
      summary: content.slice(0, 500),
      winRate,
      totalTrades: trades.length,
      avgProfitPercent: avgProfitPct,
      avgLossPercent: avgLossPct,
      bestConditions: [],
      worstConditions: [],
      weightAdjustments: [],
      rawResponse: content,
    };
  }
}