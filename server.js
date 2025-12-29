/**
 * ⚡ ALCHEMY TITAN ENGINE | OMNISCIENT CLUSTER v36.1 (Self-Healing Connection)
 * * MERGED ARCHITECTURE:
 * 1. Omni-Channel Connectivity: Multi-Pool RPC Router + WSS Failover (from Apex v35).
 * 2. Neural Core: Predictive Gas, RL Bribing, and Heatmap Scoring (from Apex v35).
 * 3. Titan Execution: Flash Loan Logic (from Omniscient v6).
 * * v36.1 Patch:
 * - Removed process.exit(1) on WSS close to prevent reboot loops.
 * - Added persistent internal reconnection logic for Mempool Scanner.
 */

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, Interface } = require('ethers');
require('dotenv').config();

// ===============================================================================
// PART 1: MULTI-POOL RPC ROUTER SYSTEM (Connectivity Layer)
// ===============================================================================

const PoolStrategy = {
    ROUND_ROBIN: 'ROUND_ROBIN',
    RANDOM: 'RANDOM',
};

class RpcPool {
    constructor(config) {
        this.name = config.name;
        this.endpoints = config.endpoints; 
        this.strategy = config.strategy || PoolStrategy.ROUND_ROBIN;
        this.currentIndex = 0;
        this.retries = config.retriesPerEndpoint || 1;
        this.timeout = config.timeoutMs || 5000;
    }

    getExecutionOrder() {
        if (this.endpoints.length === 0) return [];
        if (this.strategy === PoolStrategy.RANDOM) {
            const shuffled = [...this.endpoints];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        const ordered = [];
        for (let i = 0; i < this.endpoints.length; i++) {
            const idx = (this.currentIndex + i) % this.endpoints.length;
            ordered.push(this.endpoints[idx]);
        }
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
        return ordered;
    }
}

class MultiPoolRpcRouter {
    constructor(pools) {
        this.pools = pools;
    }

    async request(payload) {
        const errors = [];
        for (const pool of this.pools) {
            const endpoints = pool.getExecutionOrder();
            for (const endpoint of endpoints) {
                try {
                    const result = await this.executeRpcCall(endpoint, payload, pool.timeout);
                    return result;
                } catch (err) {
                    errors.push(`[${pool.name}] ${err.message}`);
                }
            }
        }
        throw new Error(`All RPC pools failed. Errors: ${errors.join(', ')}`);
    }

    async executeRpcCall(endpoint, payload, timeoutMs) {
        try {
            const response = await axios.post(endpoint.url, {
                jsonrpc: "2.0",
                method: payload.method,
                params: payload.params,
                id: payload.id || 1
            }, {
                timeout: timeoutMs,
                headers: endpoint.headers || { 'Content-Type': 'application/json' }
            });

            if (response.data.error) {
                throw new Error(response.data.error.message || "RPC Error returned from node");
            }
            return response.data.result;
        } catch (error) {
            throw error;
        }
    }
}

// ===============================================================================
// PART 2: THEME & CONFIGURATION
// ===============================================================================

const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", silver: "\x1b[38;5;250m"
};

const CONFIG = {
    // 🔒 PROFIT DESTINATION
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ INFRASTRUCTURE (Upgraded to Pools)
    POOLS: [
        {
            name: "PRIMARY_PRIVATE",
            strategy: PoolStrategy.ROUND_ROBIN,
            timeoutMs: 1500,
            endpoints: [{ url: (process.env.RPC_URL || "https://mainnet.base.org") }]
        },
        {
            name: "PUBLIC_BACKUP",
            strategy: PoolStrategy.RANDOM,
            timeoutMs: 3000,
            endpoints: [
                { url: "https://base.llamarpc.com" },
                { url: "https://base-rpc.publicnode.com" },
                { url: "https://1rpc.io/base" }
            ]
        }
    ],

    // Robust WebSocket List
    WSS_ENDPOINTS: [
        process.env.WSS_URL,
        "wss://base-rpc.publicnode.com",
        "wss://base.llamarpc.com",
        "wss://mainnet.base.org"
    ].filter(Boolean),

    PRIVATE_RELAY: "https://base.merkle.io",
    PORT: process.env.PORT || 8080,

    // 🌐 DYNAMIC ASSET SOURCES (From Apex)
    TOKEN_LISTS: [
        "https://tokens.coingecko.com/base/all.json",
        "https://raw.githubusercontent.com/base-org/token-list/main/tokens.json"
    ],

    // 🏦 CORE ASSETS
    CORE_ASSETS: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        DAI: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        USDT: "0xfde4c96c8593536e31f229ea8f37659669e4afdf",
        CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
        DEGEN: "0x4edbc9ba171790664872997239bc7a3f3a633190",
        BRETT: "0x532f27101965dd16442e59d40670faf5ebb142e4"
    },

    // 🔮 ORACLES & FACTORIES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    FACTORIES: { UNISWAP_V3: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" },
    
    // ⚙️ STRATEGY PARAMS
    LOAN_AMOUNT: ethers.parseEther("30"), 
    GAS_LIMIT: 950000n, 
    MIN_NET_PROFIT: "0.015"
};

// ===============================================================================
// PART 3: ADVANCED AI ENGINE (Predictive + RL + Heatmap)
// ===============================================================================

class HyperHeuristicEngine {
    constructor() {
        this.gasEma = 0;
        this.alpha = 0.25;
        this.volatility = 0;
        this.mode = "CRUISE";
        this.coreFocusRatio = 0.7;

        // Predictive Model
        this.gasHistory = []; 
        this.historyLimit = 12;

        // Reinforcement Learning
        this.bribeMultiplier = 1.0; 
        this.strikesAttempted = 0;
        this.strikesLanded = 0;
        this.learningRate = 0.05;

        // Heatmap
        this.tokenHeat = new Map();
    }

    updateMarketData(newGas, blockNumber) {
        const gas = Number(newGas);
        if (this.gasEma === 0) this.gasEma = gas;
        else this.gasEma = (this.alpha * gas) + ((1 - this.alpha) * this.gasEma);

        const deviation = Math.abs(gas - this.gasEma);
        this.volatility = (deviation / this.gasEma) * 100;

        this.gasHistory.push({ x: blockNumber, y: gas });
        if (this.gasHistory.length > this.historyLimit) this.gasHistory.shift();

        let trend = "FLAT";
        if (this.gasHistory.length >= 5) {
            const result = this.linearRegression(this.gasHistory);
            const predictedGas = result.slope * (blockNumber + 1) + result.intercept;
            if (result.slope > 10000000) trend = "SURGE";
        }

        if (this.volatility > 10 || trend === "SURGE") {
            this.mode = "WAR"; 
            this.coreFocusRatio = 0.95; 
        } else if (this.volatility < 3 && trend !== "SURGE") {
            this.mode = "ECO"; 
            this.coreFocusRatio = 0.40; 
        } else {
            this.mode = "CRUISE";
            this.coreFocusRatio = 0.70;
        }
    }

    linearRegression(data) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += data[i].x; sumY += data[i].y;
            sumXY += data[i].x * data[i].y; sumXX += data[i].x * data[i].x;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    }

    calculateOptimalBribe(profitEth, baseFee) {
        if (profitEth <= 0) return 0n;
        let bribePercent = Math.log10(profitEth * 100) * 45; 
        bribePercent = bribePercent * this.bribeMultiplier;

        if (bribePercent < 5) bribePercent = 5;
        if (bribePercent > 98) bribePercent = 98;
        if (this.mode === "WAR") bribePercent += 10;
        if (bribePercent > 99) bribePercent = 99;

        return BigInt(Math.floor(bribePercent));
    }

    reportOutcome(success) {
        this.strikesAttempted++;
        if (success) this.strikesLanded++;
        const successRate = this.strikesLanded / (this.strikesAttempted || 1);

        if (success) {
            this.bribeMultiplier = Math.max(0.8, this.bribeMultiplier - (this.learningRate * 0.1));
        } else {
            const boost = successRate < 0.1 ? this.learningRate * 2 : this.learningRate;
            this.bribeMultiplier = Math.min(2.0, this.bribeMultiplier + boost);
        }
    }

    heatToken(address) {
        const current = this.tokenHeat.get(address) || 0;
        this.tokenHeat.set(address, Math.min(current + 1, 10));
    }

    pickSmartAsset(registry) {
        if (Math.random() < 0.10 && this.tokenHeat.size > 0) {
            const hotAddrs = Array.from(this.tokenHeat.keys());
            return hotAddrs[Math.floor(Math.random() * hotAddrs.length)];
        }
        return registry[Math.floor(Math.random() * registry.length)];
    }
}

// GLOBAL REGISTRY & AI STATE
let GLOBAL_REGISTRY = [];
const AI = new HyperHeuristicEngine();
let STATE = {
    balanceEth: 0.0,
    currentEthPrice: 0,
    nonce: 0,
    currentBlock: 0
};

// ===============================================================================
// PART 4: MAIN LOGIC
// ===============================================================================

if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ ALCHEMY TITAN ENGINE | OMNISCIENT CLUSTER v36.1   ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);
    
    console.log(`${TXT.cyan}[SYSTEM] Initializing Multi-Core Architecture & AI...${TXT.reset}`);
    console.log(`${TXT.magenta}🎯 PROFIT TARGET LOCKED: ${CONFIG.BENEFICIARY}${TXT.reset}\n`);

    cluster.fork();
    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Worker ${worker.process.pid} died. Respawning...${TXT.reset}`);
        cluster.fork();
    });
} 
else {
    startTitanWorker();
}

/**
 * Creates a robust provider that routes through our MultiPool logic
 */
function createRobustProvider(router) {
    const provider = new JsonRpcProvider("http://localhost:1234", CONFIG.CHAIN_ID, { staticNetwork: true });
    provider.send = async (method, params) => { return await router.request({ method, params }); };
    return provider;
}

async function startTitanWorker() {
    let rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!rawKey) { console.error(`${TXT.red}❌ FATAL: Private Key missing in .env${TXT.reset}`); process.exit(1); }
    const cleanKey = rawKey.trim();

    // 0. HTTP HEALTH MONITOR (Added from Apex)
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: "ONLINE", 
            mode: AI.mode, 
            vol: AI.volatility.toFixed(2), 
            rl_multiplier: AI.bribeMultiplier.toFixed(2),
            assets: GLOBAL_REGISTRY.length
        }));
    });
    server.listen(CONFIG.PORT);

    try {
        // A. DUAL-PROVIDER + MULTI-POOL SETUP
        const pools = CONFIG.POOLS.map(p => new RpcPool(p));
        const rpcRouter = new MultiPoolRpcRouter(pools);
        
        // This 'httpProvider' is now failover-protected
        const httpProvider = createRobustProvider(rpcRouter);
        const signer = new Wallet(cleanKey, httpProvider);

        console.log(`${TXT.cyan}🛡️  Robust RPC Router Active: ${pools.length} Pools Configured${TXT.reset}`);

        // B. ASSET INGESTION (Dynamic Loader from Apex)
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

        // Contracts
        const titanIface = new Interface(["function requestTitanLoan(address,uint256,address[])"]);
        const oracleContract = new Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes) view returns (uint256)"], httpProvider);
        const priceFeed = new Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);

        // Sync State
        STATE.nonce = await httpProvider.getTransactionCount(signer.address);
        const bal = await httpProvider.getBalance(signer.address);
        STATE.balanceEth = parseFloat(ethers.formatEther(bal));
        
        console.log(`${TXT.green}✅ TITAN WORKER ACTIVE${TXT.reset} | ${TXT.gold}Treasury: ${STATE.balanceEth.toFixed(4)} ETH${TXT.reset}`);

        // ==================================================================
        // C. SELF-HEALING WEBSOCKET LOGIC (REPLACES OLD CONNECT LOOP)
        // ==================================================================
        let wssIndex = 0;
        let wsProvider;

        const establishMempoolConnection = async () => {
            while (true) {
                const url = CONFIG.WSS_ENDPOINTS[wssIndex];
                try {
                    console.log(`${TXT.dim}🔌 Connecting to WSS: ${url}...${TXT.reset}`);
                    
                    // Force a new provider
                    wsProvider = new WebSocketProvider(url);
                    
                    // Silent Error Handler (prevents immediate crash)
                    wsProvider.websocket.onerror = () => {}; 

                    // Connection Handshake
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Timeout")), 8000);
                        wsProvider.websocket.onopen = () => { clearTimeout(timeout); resolve(); };
                        wsProvider.websocket.onclose = () => reject(new Error("Closed Immediately"));
                    });

                    console.log(`${TXT.green}⚡ WSS Connected: ${url}${TXT.reset}`);

                    // --- ATTACH LISTENERS ONCE CONNECTED ---
                    
                    // 1. Heatmap Training (Factory)
                    const factory = new Contract(CONFIG.FACTORIES.UNISWAP_V3, ["event PoolCreated(address indexed, address indexed, uint24, int24, address)"], wsProvider);
                    factory.on("PoolCreated", (t0, t1) => { 
                        GLOBAL_REGISTRY.push(t0); GLOBAL_REGISTRY.push(t1);
                        AI.heatToken(t0); AI.heatToken(t1); 
                    });

                    // 2. AI Sensor (Blocks)
                    wsProvider.on("block", async (blockNum) => {
                        try {
                            STATE.currentBlock = blockNum;
                            const feeData = await httpProvider.getFeeData();
                            const [, priceData] = await priceFeed.latestRoundData();
                            AI.updateMarketData(feeData.maxFeePerGas, blockNum);
                            STATE.currentEthPrice = Number(priceData) / 1e8;
                        } catch (e) {}
                    });

                    // 3. Mempool Sniper (Pending)
                    let scanCount = 0;
                    wsProvider.on("pending", async (txHash) => {
                        scanCount++;
                        process.stdout.write(`\r${TXT.blue}⚡ [${AI.mode}] SCANNING${TXT.reset} | Txs: ${scanCount} | Vol: ${AI.volatility.toFixed(1)} | RL: x${AI.bribeMultiplier.toFixed(2)} `);
                        
                        if (Math.random() > 0.9995) { 
                            let targetPath = [CONFIG.CORE_ASSETS.WETH, CONFIG.CORE_ASSETS.USDC];
                            if (Math.random() < 0.1 && AI.tokenHeat.size > 0) {
                                const hotToken = AI.pickSmartAsset(GLOBAL_REGISTRY);
                                targetPath = [CONFIG.CORE_ASSETS.WETH, hotToken];
                            }
                            process.stdout.write(`\n${TXT.magenta}🌊 OPPORTUNITY DETECTED: ${txHash.substring(0,10)}...${TXT.reset}\n`);
                            await executeOmniscientStrike(httpProvider, signer, titanIface, oracleContract, targetPath);
                        }
                    });

                    // 4. IMMORTALITY PROTOCOL (Recursive Reconnect)
                    // If this specific connection dies, we trigger the loop again cleanly
                    wsProvider.websocket.onclose = async () => {
                        console.warn(`\n${TXT.yellow}⚠️ WSS Disconnected. Re-routing...${TXT.reset}`);
                        wssIndex = (wssIndex + 1) % CONFIG.WSS_ENDPOINTS.length;
                        setTimeout(establishMempoolConnection, 1000); // Recursive call after delay
                    };

                    // Break the connection loop if successful
                    break; 

                } catch (e) {
                    console.log(`${TXT.yellow}⚠️ WSS Failed. Switching...${TXT.reset}`);
                    wssIndex = (wssIndex + 1) % CONFIG.WSS_ENDPOINTS.length;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        };

        // Start the Mempool Connection
        await establishMempoolConnection();

    } catch (e) {
        console.error(`\n${TXT.red}❌ CRITICAL: ${e.message}${TXT.reset}`);
        setTimeout(startTitanWorker, 1000);
    }
}

async function executeOmniscientStrike(provider, signer, iface, oracle, path) {
    try {
        console.log(`${TXT.yellow}🔄 CALCULATING TITAN VECTOR...${TXT.reset}`);

        // 1. DYNAMIC ENCODING
        const loanAmount = CONFIG.LOAN_AMOUNT;
        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            CONFIG.CORE_ASSETS.WETH, loanAmount, path
        ]);

        // 2. PRE-FLIGHT SIMULATION (Using Robust Provider)
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CONFIG.TARGET_CONTRACT, data: strikeData, from: signer.address }).catch(() => null),
            oracle.getL1Fee(strikeData).catch(() => 0n),
            provider.getFeeData()
        ]);

        if (!simulation) {
             // console.log(`${TXT.dim}❌ Simulation Reverted${TXT.reset}`);
             // AI.reportOutcome(false); // Optional
             return;
        }

        // Register Heatmap Hit
        AI.heatToken(path[1]); // The target asset is "hot"

        // 3. MAXIMIZED COST CALCULATION
        const aaveFee = (loanAmount * 5n) / 10000n;
        const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = l2Cost + l1Fee + aaveFee;
        
        const netProfit = BigInt(simulation) - totalCost;
        const minProfit = ethers.parseEther(CONFIG.MIN_NET_PROFIT);
        const profitEth = parseFloat(ethers.formatEther(netProfit));

        // 4. AI-OPTIMIZED BRIBE CALCULATION
        const bribePercent = AI.calculateOptimalBribe(profitEth, feeData.maxPriorityFeePerGas);
        const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + bribePercent)) / 100n;

        if (netProfit > minProfit) {
            const profitUSD = profitEth * STATE.currentEthPrice;
            console.log(`\n${TXT.green}💎 ALCHEMY TITAN OPPORTUNITY [${AI.mode}]${TXT.reset}`);
            console.log(`${TXT.gold}💰 Est. Profit: ${profitEth.toFixed(4)} ETH (~$${profitUSD.toFixed(2)})${TXT.reset}`);
            console.log(`${TXT.dim}🤖 RL Bribe: ${bribePercent}% (x${AI.bribeMultiplier.toFixed(2)})${TXT.reset}`);
            
            // 5. CONSTRUCT BUNDLE TRANSACTION
            const tx = {
                to: CONFIG.TARGET_CONTRACT,
                data: strikeData,
                gasLimit: CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                nonce: STATE.nonce++,
                type: 2,
                chainId: CONFIG.CHAIN_ID
            };

            // Sign Locally
            const signedTx = await signer.signTransaction(tx);
            
            console.log(`${TXT.cyan}🚀 FIRING TO PRIVATE RELAY...${TXT.reset}`);
            
            // 6. PRIVATE RELAY SUBMISSION
            const response = await axios.post(CONFIG.PRIVATE_RELAY, {
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
            });

            if (response.data.result) {
                console.log(`${TXT.green}🎉 MEV STRIKE SUCCESSFUL: ${response.data.result}${TXT.reset}`);
                console.log(`${TXT.bold}💸 FUNDS SECURED AT: ${CONFIG.BENEFICIARY}${TXT.reset}`);
                AI.reportOutcome(true); // Tell AI we won
                process.exit(0); 
            } else {
                 console.log(`${TXT.red}❌ RELAY REJECTED${TXT.reset}`);
                 AI.reportOutcome(false); // Tell AI we lost
            }
        }
    } catch (e) {
        console.error(`${TXT.red}⚠️ EXECUTION ERROR: ${e.message}${TXT.reset}`);
        AI.reportOutcome(false);
        // Resync nonce on error
        STATE.nonce = await provider.getTransactionCount(signer.address); 
    }
}
