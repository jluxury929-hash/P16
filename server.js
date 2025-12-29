// ENVIRONMENT: React (Frontend) - Run in Browser/Canvas
// NOTE: This is a VISUAL SIMULATION of an MEV Bot Strategy. 
// Do not run this file as a Node.js server script (e.g., 'node server.js').

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Rocket, 
  Briefcase, 
  Target, 
  Lock, 
  Unlock,
  RefreshCw,
  ChevronRight,
  PieChart,
  Zap,
  Terminal,
  Cpu,
  Activity,
  Server,
  Shield,
  Code
} from 'lucide-react';

const Card = ({ children, className = "" }) => (
  <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "" }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-lg shadow-emerald-900/50",
    secondary: "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700",
    gold: "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black shadow-lg shadow-amber-900/50",
    danger: "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-rose-900/50"
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Slider = ({ label, value, min, max, onChange, prefix = "", suffix = "", step = 1, color = "emerald" }) => (
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <span className="text-gray-400 text-sm font-medium">{label}</span>
      <span className={`text-${color}-400 font-mono font-bold`}>
        {prefix}{value.toLocaleString()}{suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-${color}-500 hover:accent-${color}-400`}
    />
  </div>
);

// --- APEX TITAN SIMULATOR (Whale Hunter Edition) ---

const ApexTitanSimulator = () => {
  // CONFIG Mapped to State - Supercharged Defaults
  const [flashLoanAmount, setFlashLoanAmount] = useState(1000.0); // ETH - Whale Tier
  const [maxBribePercent, setMaxBribePercent] = useState(90); // %
  const [minProfitThreshold, setMinProfitThreshold] = useState(0.01); // ETH
  
  const [logs, setLogs] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const logsEndRef = useRef(null);

  // Scroll to bottom of logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Simulation Engine
  useEffect(() => {
    if (!isSimulating) return;

    // Boot Sequence
    const bootSequence = [
      { text: "╔════════════════════════════════════════════════════════╗", color: "text-amber-400 font-bold" },
      { text: "║    ⚡ APEX TITAN LEGIT | WHALE HUNTER EDITION v3.1     ║", color: "text-amber-400 font-bold" },
      { text: "╚════════════════════════════════════════════════════════╝", color: "text-amber-400 font-bold" },
      { text: "[SYSTEM] Spawning 32 Ultra-Low Latency Workers...", color: "text-cyan-400" },
      { text: "[INFO] Mempool Connection: 10Gbps Direct Link. Private Relays Active.", color: "text-gray-500" },
      { text: "✅ CLUSTER READY | MODE: AGGRESSIVE ARBITRAGE", color: "text-emerald-500" },
      { text: "------------------------------------------------------------", color: "text-gray-700" }
    ];

    if (logs.length === 0) {
      setLogs(bootSequence);
    }

    // Hyper-Speed Interval (250ms)
    const interval = setInterval(() => {
      const rand = Math.random();
      
      // High Frequency - 40% chance per tick (Fast updates)
      if (rand > 0.60) {
        const pid = Math.floor(Math.random() * 8000) + 1000;
        const txHash = "0x" + Math.random().toString(16).substr(2, 8) + "...";
        
        // Log Target Acquired
        const newLogs = [{ 
          text: `⚡ [PID ${pid}] WHALE DETECTED: ${txHash}`, 
          color: "text-fuchsia-400 font-bold" 
        }];

        // Analyze Opportunity Logic
        newLogs.push({ text: "   ↳ Calculating Dynamic Bribe & Atomic Execution...", color: "text-yellow-400" });

        // 1. Calculate Flash Loan Cost (0.05% fee)
        const flashFee = (flashLoanAmount * 0.05) / 100;
        
        // 2. Simulate Gross Profit (WHALE LOGIC: 0.85 to 4.35 ETH profit range)
        // Updated to ensure minimum 'Whale' profit of 0.85 ETH as requested
        const mockGrossProfit = (Math.random() * 3.5) + 0.85; 
        
        // 3. Dynamic Bribe Calculation
        let bribePercent = 40;
        if (mockGrossProfit > 0.5) bribePercent = maxBribePercent; // Aggressive bribe for big wins
        
        const bribeAmount = (mockGrossProfit * bribePercent) / 100;
        const netProfit = mockGrossProfit - bribeAmount - flashFee;

        // Log Stats
        newLogs.push({ 
          text: `   ↳ Gross: ${mockGrossProfit.toFixed(4)} ETH | Flash Fee: ${flashFee.toFixed(4)} ETH`, 
          color: "text-gray-400 dim" 
        });
        newLogs.push({ 
          text: `   ↳ Bribe: ${bribePercent}% (${bribeAmount.toFixed(4)} ETH) | Net: ${netProfit.toFixed(4)} ETH`, 
          color: "text-gray-400 dim" 
        });

        // 4. Execution Decision
        if (netProfit > minProfitThreshold) {
           newLogs.push({ text: "   💎 OPPORTUNITY CONFIRMED | Executing Private Bundle...", color: "text-emerald-400 font-bold" });
           
           // Win/Loss Simulation (Guaranteed / High Probability Mode)
           // 99.9% Win Rate (Updated from 98%)
           if (Math.random() > 0.001) { 
             newLogs.push({ text: "   ✅ BUNDLE SECURED! ATOMIC PROFIT EXTRACTED.", color: "text-emerald-500 font-bold" });
             setTotalProfit(prev => prev + netProfit);
           } else {
             newLogs.push({ text: "   ⚠️ Slippage Exceeded (Rare).", color: "text-rose-500" });
           }
        } else {
           newLogs.push({ text: "   ❌ Profit too low.", color: "text-gray-600" });
        }
        
        setLogs(prev => [...prev.slice(-15), ...newLogs]); // Keep log buffer reasonable
      }

    }, 250); // 250ms Tick Speed

    return () => clearInterval(interval);
  }, [isSimulating, flashLoanAmount, maxBribePercent, minProfitThreshold, logs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CONFIGURATION PANEL */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-4 bg-gray-900 border border-amber-500/30 rounded-lg mb-6 relative overflow-hidden">
             <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
               <Shield className="w-4 h-4" /> CONFIG.JS SETTINGS
             </div>
             <p className="text-xs text-gray-500 font-mono">
               Mode: Whale Hunter (v3.0)<br/>
               Strategy: High-Frequency Arb<br/>
               Execution: Atomic/Private
             </p>
          </div>

          <Slider 
            label="FLASH_LOAN_AMOUNT" 
            value={flashLoanAmount} 
            min={100} 
            max={5000} 
            step={50}
            suffix=" ETH" 
            color="amber"
          />
          <Slider 
            label="MAX_BRIBE_PERCENT" 
            value={maxBribePercent} 
            min={50} 
            max={99} 
            suffix="%" 
            color="amber"
          />
          <Slider 
            label="MIN_PROFIT_THRESHOLD" 
            value={minProfitThreshold} 
            min={0.01} 
            max={1.0} 
            step={0.01}
            suffix=" ETH" 
            color="amber"
          />
          
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
             <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Session Profit</div>
             <div className="text-3xl font-mono text-emerald-400 font-bold">
                Ξ {totalProfit.toFixed(4)}
             </div>
             <div className="text-xs text-gray-600 font-mono mt-1">
                ≈ ${(totalProfit * 3500).toLocaleString()} USD
             </div>
          </div>
        </div>

        {/* TERMINAL PANEL */}
        <div className="lg:col-span-2 flex flex-col gap-4">
           <div className="bg-black border border-amber-900/40 rounded-lg p-4 font-mono text-xs h-[500px] overflow-hidden flex flex-col relative shadow-[0_0_50px_rgba(245,158,11,0.15)]">
             {/* Terminal Header */}
             <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-2">
               <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
               </div>
               <div className="text-gray-600">node apex-titan-whale.js --force</div>
             </div>
             
             {/* Logs Area */}
             <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
               {logs.map((log, i) => (
                 <div key={i} className={`${log.color} break-words leading-relaxed`}>
                   {log.text}
                 </div>
               ))}
               <div ref={logsEndRef} />
             </div>
             
             {/* Terminal Footer */}
             <div className="mt-2 pt-2 border-t border-gray-800 text-gray-500 animate-pulse">
               _
             </div>
           </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-between font-mono text-xs">
         <div className="flex items-center gap-2 text-gray-400">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            CONNECTED: wss://base-rpc.publicnode.com (LATENCY: 1ms)
         </div>
         <div className="flex items-center gap-2 text-gray-400">
            <Code className="w-3 h-3" />
            WORKERS: {Math.floor(flashLoanAmount / 10) + 12} ACTIVE
         </div>
      </div>
    </div>
  );
};

// --- Existing Sub-Components ---

const SaasSimulator = () => {
  const [price, setPrice] = useState(49);
  const [churn, setChurn] = useState(5);
  const [growth, setGrowth] = useState(10);
  
  // Calculate requirements to hit $1M ARR ($83,333 MRR)
  const targetMRR = 83333;
  const customersNeeded = Math.ceil(targetMRR / price);
  const estimatedMonths = useMemo(() => {
    let users = 10; // Start with 10 users
    let months = 0;
    // Safety break loop
    while (users * price < targetMRR && months < 120) {
      const netGrowth = users * (growth / 100);
      const netChurn = users * (churn / 100);
      users = users + netGrowth - netChurn;
      months++;
    }
    return months >= 120 ? "10+ Years" : `${months} Months`;
  }, [price, churn, growth]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Slider 
            label="Product Price (Monthly)" 
            value={price} 
            min={5} 
            max={500} 
            prefix="$" 
          />
          <Slider 
            label="Monthly Growth Rate" 
            value={growth} 
            min={1} 
            max={50} 
            suffix="%" 
          />
          <Slider 
            label="Monthly Churn Rate" 
            value={churn} 
            min={0} 
            max={20} 
            step={0.1}
            suffix="%" 
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex-1 flex flex-col justify-center items-center bg-gray-800/50 border-emerald-900/30">
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Customers Needed</h3>
            <div className="text-4xl font-bold text-white flex items-center gap-2">
              <Users className="text-emerald-500 w-8 h-8" />
              {customersNeeded.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-2">To reach $1M Annual Recurring Revenue</p>
          </Card>
          
          <Card className="flex-1 flex flex-col justify-center items-center bg-gray-800/50 border-emerald-900/30">
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Time to $1M ARR</h3>
            <div className="text-4xl font-bold text-white flex items-center gap-2">
              <Rocket className="text-amber-500 w-8 h-8" />
              {estimatedMonths}
            </div>
            <p className="text-xs text-gray-500 mt-2">Based on current growth vs churn</p>
          </Card>
        </div>
      </div>
      
      <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-sm text-emerald-200">
        <strong>Strategy Tip:</strong> Selling a 
        <span className="font-bold text-white"> ${price}</span> product requires finding 
        <span className="font-bold text-white"> {Math.ceil(customersNeeded / 12)}</span> new customers every month (avg) to hit your goal in a year.
      </div>
    </div>
  );
};

const CompoundSimulator = () => {
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(2000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(10);

  const futureValue = useMemo(() => {
    let balance = initial;
    for (let i = 0; i < years * 12; i++) {
      balance = balance * (1 + (rate / 100) / 12) + monthly;
    }
    return balance;
  }, [initial, monthly, rate, years]);

  const isMillionaire = futureValue >= 1000000;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Slider label="Initial Investment" value={initial} min={0} max={100000} step={1000} prefix="$" />
          <Slider label="Monthly Contribution" value={monthly} min={0} max={10000} step={100} prefix="$" />
          <Slider label="Annual Return Rate" value={rate} min={1} max={30} suffix="%" />
          <Slider label="Time Horizon" value={years} min={1} max={40} suffix=" Years" />
        </div>

        <div className="flex flex-col justify-center">
          <Card className={`flex flex-col justify-center items-center h-full transition-colors duration-500 ${isMillionaire ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-gray-800/50'}`}>
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Projected Net Worth</h3>
            <div className={`text-4xl md:text-5xl font-bold flex items-center gap-2 ${isMillionaire ? 'text-emerald-400' : 'text-white'}`}>
              <DollarSign className="w-8 h-8 md:w-10 md:h-10" />
              {Math.floor(futureValue).toLocaleString()}
            </div>
            
            <div className="mt-8 w-full bg-gray-700 h-4 rounded-full overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-500 ${isMillionaire ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min((futureValue / 1000000) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between w-full mt-2 text-xs text-gray-500 font-mono">
              <span>$0</span>
              <span>TARGET: $1,000,000</span>
            </div>
            
            {isMillionaire && (
              <div className="mt-6 flex items-center gap-2 text-amber-400 animate-pulse font-bold">
                <Unlock className="w-5 h-5" />
                <span>MILLIONAIRE STATUS UNLOCKED</span>
              </div>
            )}
            {!isMillionaire && (
               <div className="mt-6 flex items-center gap-2 text-gray-500">
               <Lock className="w-5 h-5" />
               <span>{(1000000 - futureValue).toLocaleString()} to go</span>
             </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default function MillionaireBlueprint() {
  const [activeTab, setActiveTab] = useState('mev'); // Defaulted to MEV

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gray-900 rounded-full border border-gray-800 mb-4 shadow-2xl">
            <TrendingUp className="w-6 h-6 text-emerald-500 mr-2" />
            <span className="text-emerald-500 font-bold tracking-wider text-sm">WEALTH SIMULATOR v3.0</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Millionaire</span> Blueprint
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Simulate your path to $1M via Business, Investing, or High-Frequency MEV.
          </p>
        </header>

        {/* Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 bg-gray-900/50 p-2 rounded-xl border border-gray-800 w-fit mx-auto">
          <button 
            onClick={() => setActiveTab('mev')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'mev' ? 'bg-amber-900/50 text-white shadow-lg border border-amber-600/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Zap className="w-4 h-4 text-amber-400" /> APEX TITAN
          </button>
          <button 
            onClick={() => setActiveTab('saas')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'saas' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Business Scaler
          </button>
          <button 
            onClick={() => setActiveTab('compound')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'compound' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Compound Growth
          </button>
        </div>

        {/* Content Area */}
        <main className="max-w-4xl mx-auto">
          {activeTab === 'mev' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-bold flex items-center gap-2 text-amber-500">
                   <Terminal className="text-amber-500" />
                   APEX TITAN LEGIT v3.0
                 </h2>
                 <span className="text-xs font-mono text-amber-500 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/50 animate-pulse">FLASHBOTS ENABLED</span>
              </div>
              <Card className="border-amber-900/20">
                <ApexTitanSimulator />
              </Card>
            </div>
          )}

          {activeTab === 'saas' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                   <Briefcase className="text-emerald-400" />
                   SaaS & Business Model
                 </h2>
                 <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-800">TARGET: $1M ARR</span>
              </div>
              <Card>
                <SaasSimulator />
              </Card>
            </div>
          )}

          {activeTab === 'compound' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                   <PieChart className="text-emerald-400" />
                   Investment Strategy
                 </h2>
                 <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-800">TARGET: NET WORTH</span>
              </div>
              <Card>
                <CompoundSimulator />
              </Card>
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-gray-600 text-xs">
          <p>This tool is for educational and visualization purposes only. <br/>Results strictly dependent on execution, market conditions, and relentless drive.</p>
        </footer>
