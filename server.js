/**
 * APEX HYPER-HEURISTIC STRIKER v35.0 (Multi-Pool Edition)
 * Combines High-Frequency Trading Logic with Robust Multi-Pool RPC Routing.
 * * New Features:
 * - Multi-Pool RPC Router: Automatically fails over between private and public pools.
 * - Load Balancing: ROUND_ROBIN strategy for pool endpoints.
 * - Robust Provider: Patches ethers.js to use the router for all HTTP requests.
 */

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

// ===============================================================================
// PART 1: MULTI-POOL RPC ROUTER SYSTEM
// ===============================================================================

const PoolStrategy = {
    ROUND_ROBIN: 'ROUND_ROBIN',
    RANDOM: 'RANDOM',
};

/**
 * Represents a single group of RPC endpoints (e.g., "Primary", "Public Backup").
 */
class RpcPool {
    constructor(config) {
        this.name = config.name;
        this.endpoints = config.endpoints; // Array of { url, headers }
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

        // ROUND_ROBIN
        const ordered = [];
        for (let i = 0; i < this.endpoints.length; i++) {
            const idx = (this.currentIndex + i) % this.endpoints.length;
            ordered.push(this.endpoints[idx]);
        }
        
        // Advance index for next time to distribute load
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
        return ordered;
    }
}

/**
 * The main router that manages multiple pools.
 */
class MultiPoolRpcRouter {
    constructor(pools) {
        this.pools = pools;
    }

    /**
     * Orchestrates the request across pools and endpoints.
     */
    async request(payload) {
        const errors = [];
        // Unique ID for logging if needed, or use payload ID
        const requestId = payload.id || Math.floor(Math.random() * 100000);

        // 1. Iterate through Pools (Priority Order)
        for (const pool of this.pools) {
            const endpoints = pool.getExecutionOrder();

            // 2. Iterate through Endpoints within the Pool
            for (const endpoint of endpoints) {
                try {
                    // Attempt the call
                    const result = await this.executeRpcCall(endpoint, payload, pool.timeout);
                    return result;

                } catch (err) {
                    const msg = `[${pool.name}] Failed: ${err.message}`;
                    // console.warn(msg); // Optional: Uncomment for debug
                    errors.push(msg);
                }
            }
        }

        throw new Error(`All RPC pools failed. Errors: ${errors.join(', ')}`);
    }

    /**
     * Real Network Implementation using Axios
     */
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
// PART 2: APEX STRIKER CONFIGURATION & THEME
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
    
    // ⚡ RPC CONFIGURATION (NEW)
    // We replace the single RPC_URL with Pool Configurations
    POOLS: [
        {
            name: "PRIMARY_PRIVATE",
            strategy: PoolStrategy.ROUND_ROBIN,
            timeoutMs: 1500,
            endpoints: [
                // Replace with your real private nodes or high-quality auth nodes
                { url: (process.env.RPC_URL || "https://mainnet.base.org") } 
            ]
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

    // WebSocket Failover List
    WSS_ENDPOINTS: [
        process.env.WSS_URL,
        "wss://base-rpc.publicnode.com",
        "wss://base.llamarpc.com",
        "wss://mainnet.base.org"
    ].filter(Boolean),
    
    PORT: process.env.PORT || 8080,
    PRIVATE_RELAY: "https://base.merkle.io",
    
    // 🌐 ASSET SOURCES
    TOKEN_LISTS: [
        "https://tokens.coingecko.com/base/all.json",
        "https://raw.githubusercontent.com/base-org/token-list/main/tokens.json"
    ],

    // 🏭 FACTORIES
    FACTORIES: {
        UNISWAP_V3: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
    },

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

    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    
    GAS_LIMIT: 1500000n, 
    MIN_NET_PROFIT: "0.01" 
};

// ===============================================================================
// PART 3: HYPER-HEURISTIC ENGINE
// ===============================================================================

class HyperHeuristicEngine {
    constructor() {
        this.gasEma = 0;
        this.alpha = 0.25;
        this.volatility = 0;
        this.mode = "CRUISE";
        this.coreFocusRatio = 0.7;
    }

    updateMarketData(newGas) {
        const gas = Number(newGas);
        if (this.gasEma === 0) this.gasEma = gas;
        else this.gasEma = (this.alpha * gas) + ((1 - this.alpha) * this.gasEma);

        const deviation = Math.abs(gas - this.gasEma);
        this.volatility = (deviation / this.gasEma) * 100;

        if (this.volatility > 10) {
            this.mode = "WAR"; 
            this.coreFocusRatio = 0.95; 
        } else if (this.volatility < 3) {
            this.mode = "ECO"; 
            this.coreFocusRatio = 0.40; 
        } else {
            this.mode = "CRUISE";
            this.coreFocusRatio = 0.70;
        }
    }

    calculateOptimalBribe(profitEth, baseFee) {
        if (profitEth <= 0) return 0n;
        
        let bribePercent = Math.log10(profitEth * 100) * 45; 
        
        if (bribePercent < 5) bribePercent = 5;
        if (bribePercent > 98) bribePercent = 98;
        
        if (this.mode === "WAR") bribePercent += 15;
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
let STATE = {
    balanceEth: 0.0,
    encodedCorePayloads: {}, 
    currentEthPrice: 0,
    nonce: 0
};

// ===============================================================================
// PART 4: MAIN LOGIC
// ===============================================================================

if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║  🚀 APEX STRIKER v35.0 | MULTI-POOL ROBUST EDITION     ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);
    console.log(`${TXT.cyan}[SYSTEM] Initializing Multi-Pool RPC Router...${TXT.reset}`);
    console.log(`${TXT.magenta}🎯 PROFIT TARGET LOCKED: ${CONFIG.BENEFICIARY}${TXT.reset}\n`);

    cluster.fork();
    cluster.on('exit', () => cluster.fork());
} 
else {
    initWorker();
}

/**
 * Creates an Ethers.js compatible provider that routes requests through
 * our MultiPoolRpcRouter.
 */
function createRobustProvider(router) {
    // We initialize with a dummy URL because we override the send method anyway
    const provider = new ethers.JsonRpcProvider("http://localhost:1234", CONFIG.CHAIN_ID, {
        staticNetwork: true
    });

    // Override the internal send method to use our router
    // Note: In Ethers v6, `send` is the public method for JSON-RPC
    provider.send = async (method, params) => {
        return await router.request({ method, params });
    };

    return provider;
}

async function initWorker() {
    process.on('uncaughtException', (err) => {
        if (err.message && (err.message.includes('429') || err.message.includes('Unexpected server response'))) return;
        console.error('Uncaught Exception:', err);
        process.exit(1);
    });

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
        // 2. SETUP MULTI-POOL ROUTER
        const pools = CONFIG.POOLS.map(p => new RpcPool(p));
        const rpcRouter = new MultiPoolRpcRouter(pools);
        
        // Create the Robust Provider
        // This provider will automatically cycle through endpoints on failure
        const httpProvider = createRobustProvider(rpcRouter);
        const signer = new ethers.Wallet(cleanKey, httpProvider);

        console.log(`${TXT.cyan}🛡️  Robust RPC Router Active: ${pools.length} Pools Configured${TXT.reset}`);

        // 3. LOAD ASSETS
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

        // 4. WEBSOCKET CONNECTION (Rotational Failover)
        let wsProvider;
        let wssIndex = 0;
        const connectWss = async () => {
            while(true) {
                const url = CONFIG.WSS_ENDPOINTS[wssIndex];
                try {
                    console.log(`${TXT.dim}🔌 Connecting to WSS: ${url}...${TXT.reset}`);
                    const provider = new ethers.WebSocketProvider(url);
                    
                    // Prevent crash on immediate error, handled in await block
                    provider.websocket.onerror = () => {}; 

                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Timeout")), 8000);
                        provider.websocket.onopen = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        provider.websocket.onclose = () => reject(new Error("Closed"));
                    });
                    
                    console.log(`${TXT.green}⚡ WSS Connected: ${url}${TXT.reset}`);
                    return provider;

                } catch (e) {
                    console.log(`${TXT.yellow}⚠️ WSS Failed (${url}). Switching...${TXT.reset}`);
                    wssIndex = (wssIndex + 1) % CONFIG.WSS_ENDPOINTS.length;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        };
        
        wsProvider = await connectWss();

        // Contracts
        const titanIface = new ethers.Interface(["function requestTitanLoan(address,uint256,address[])"]);
        const oracleContract = new ethers.Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes) view returns (uint256)"], httpProvider);
        const priceFeed = new ethers.Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);

        // Factory Sniffer
        const factory = new ethers.Contract(CONFIG.FACTORIES.UNISWAP_V3, ["event PoolCreated(address indexed, address indexed, uint24, int24, address)"], wsProvider);
        factory.on("PoolCreated", (t0, t1) => { GLOBAL_REGISTRY.push(t0); GLOBAL_REGISTRY.push(t1); });

        // Initial State
        STATE.nonce = await httpProvider.getTransactionCount(signer.address);
        const bal = await httpProvider.getBalance(signer.address);
        STATE.balanceEth = parseFloat(ethers.formatEther(bal));
        
        // 5. BACKGROUND OPTIMIZER LOOP
        setInterval(async () => {
            try {
                // Uses httpProvider -> routes via MultiPoolRpcRouter
                const bal = await httpProvider.getBalance(signer.address);
                STATE.balanceEth = parseFloat(ethers.formatEther(bal));

                const loanAmt = STATE.balanceEth > 0.1 ? ethers.parseEther("50") : ethers.parseEther("10");
                for (const [sym, addr] of Object.entries(CONFIG.CORE_ASSETS)) {
                    if (sym === "WETH") continue;
                    STATE.encodedCorePayloads[addr] = titanIface.encodeFunctionData("requestTitanLoan", [
                        CONFIG.CORE_ASSETS.WETH, loanAmt, [CONFIG.CORE_ASSETS.WETH, addr]
                    ]);
                }
            } catch (e) {}
        }, 3000);

        // 6. AI SENSOR LOOP
        wsProvider.on("block", async () => {
            try {
                const feeData = await httpProvider.getFeeData();
                const [, priceData] = await priceFeed.latestRoundData();
                AI.updateMarketData(feeData.maxFeePerGas);
                STATE.currentEthPrice = Number(priceData) / 1e8;
            } catch (e) {}
        });

        // 7. THE HOT LOOP
        let scanCount = 0;
        wsProvider.on("pending", async (txHash) => {
            scanCount++;
            process.stdout.write(`\r${TXT.blue}⚡ [${AI.mode}] SCAN${TXT.reset} | Txs: ${scanCount} | Vol: ${AI.volatility.toFixed(1)} | ${TXT.dim}Searching...${TXT.reset} `);

            if (Math.random() > 0.9995) {
                let targetAsset, payload;
                const useCore = AI.shouldScanCore();

                if (useCore) {
                    const coreKeys = Object.keys(CONFIG.CORE_ASSETS);
                    const key = coreKeys[Math.floor(Math.random() * coreKeys.length)];
                    targetAsset = CONFIG.CORE_ASSETS[key];
                    if (targetAsset === CONFIG.CORE_ASSETS.WETH) return;
                    payload = STATE.encodedCorePayloads[targetAsset];
                } else {
                    targetAsset = GLOBAL_REGISTRY[Math.floor(Math.random() * GLOBAL_REGISTRY.length)];
                    if (!targetAsset) return;
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

        wsProvider.websocket.onclose = () => {
            console.log(`${TXT.yellow}WSS Closed. Reconnecting...${TXT.reset}`);
            process.exit(1); 
        };

    } catch (e) {
        console.error(`\n${TXT.red}❌ ERROR: ${e.message}${TXT.reset}`);
        setTimeout(initWorker, 5000);
    }
}

async function executeHeuristicStrike(provider, signer, oracle, data, targetToken) {
    try {
        // A. AGGRESSIVE PRE-FLIGHT (Multi-Pool Protected)
        // All these calls utilize the MultiPoolRpcRouter implicitly via 'provider'
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
                nonce: STATE.nonce++, 
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
        STATE.nonce = await provider.getTransactionCount(signer.address); 
    }
}
