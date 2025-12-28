const cluster = require('cluster');
const { ethers } = require('ethers');
const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", silver: "\x1b[38;5;250m"
};

// --- CONFIGURATION ---
const CONFIG = {
    CHAIN_ID: 8453,
    CONTRACT_ADDR: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    MERKLE_RPC: "https://base.merkle.io",
    
    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    
    // 🏦 ASSETS
    TOKENS: { 
        WETH: "0x4200000000000000000000000000000000000006", 
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        DEGEN: "0x4edbc9ba171790664872997239bc7a3f3a633190",
        AERO: "0x9401518c83Bf58717007e39F9ba4b2C7E759A5af"
    },

    // ⚙️ EXECUTION
    LOAN_AMOUNT: ethers.parseEther("30"),
    GAS_LIMIT: 950000,
    PRIORITY_BRIBE: 15n, // 15% Miner Tip
    WHALE_THRESHOLD: ethers.parseEther("0.1")
};

// DUAL-LANE INFRASTRUCTURE
const RPC_URL = process.env.QUICKNODE_HTTP || "https://mainnet.base.org";
const WSS_URL = process.env.QUICKNODE_WSS || "wss://base-rpc.publicnode.com";

// --- MASTER THREAD ---
if (cluster.isPrimary) {
    // Removed console.clear() to preserve startup errors
    console.log(`${TXT.bold}${TXT.gold}╔═══════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║       🔱 APEX v38.17.0 | MACH-1 CLUSTER       ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚═══════════════════════════════════════════════╝${TXT.reset}\n`);
    
    console.log(`${TXT.cyan}[MASTER] Spawning Worker...${TXT.reset}`);
    const worker = cluster.fork();
    
    worker.on('exit', (code, signal) => {
        console.log(`${TXT.red}⚠️ Worker died (Code: ${code}, Signal: ${signal}). Respawning in 3s...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} else {
    runWorker().catch(err => {
        console.error(`${TXT.red}❌ FATAL WORKER ERROR:${TXT.reset}`, err);
        process.exit(1);
    });
}

// --- WORKER THREAD ---
async function runWorker() {
    // 1. SETUP
    const rawKey = process.env.TREASURY_PRIVATE_KEY;
    if (!rawKey) { 
        console.error(`${TXT.red}❌ CONFIG ERROR: TREASURY_PRIVATE_KEY is missing in .env${TXT.reset}`); 
        process.exit(1); 
    }
    
    console.log(`${TXT.dim}[WORKER] Connecting to RPC: ${RPC_URL}...${TXT.reset}`);

    // Add static network to avoid auto-detection lag
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    const signer = new ethers.Wallet(rawKey.trim(), provider);
    
    // Contracts
    const flashContract = new ethers.Contract(CONFIG.CONTRACT_ADDR, [
        "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount) external returns (uint256)"
    ], signer);
    
    const gasOracle = new ethers.Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes) view returns (uint256)"], provider);

    // State
    let nextNonce;
    
    // TIMEOUT WRAPPER to prevent hanging on initial connection
    try {
        console.log(`${TXT.dim}[WORKER] Syncing Nonce (Timeout: 5s)...${TXT.reset}`);
        const noncePromise = provider.getTransactionCount(signer.address);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Connection Timeout")), 5000));
        nextNonce = await Promise.race([noncePromise, timeoutPromise]);
    } catch (e) {
        console.error(`${TXT.red}❌ RPC CONNECTION FAILED: ${e.message}${TXT.reset}`);
        console.log(`${TXT.yellow}➜ Please check your internet connection or RPC_URL in .env${TXT.reset}`);
        process.exit(1);
    }

    let ws = null;
    let scanCount = 0;
    const seenHashes = new Set();

    process.stdout.write(`${TXT.cyan}[INIT] Mach-1 Nonce Synced: ${nextNonce}${TXT.reset}\n`);

    // 2. CONNECTION LOGIC
    function connect() {
        if (ws) {
            try { ws.terminate(); } catch(e){}
        }
        
        console.log(`${TXT.dim}[WORKER] Connecting to WebSocket...${TXT.reset}`);
        ws = new WebSocket(WSS_URL);

        ws.on('open', () => {
            console.log(`${TXT.green}📡 RAW SOCKET CONNECTED${TXT.reset}`);
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newPendingTransactions"] }));
        });

        ws.on('message', async (data) => {
            try {
                const parsed = JSON.parse(data);
                const txHash = parsed.params?.result;
                if (txHash && !seenHashes.has(txHash)) {
                    seenHashes.add(txHash);
                    scanCount++;
                    // Don't await this, run in background
                    processTransaction(txHash).catch(err => { /* Silent fail on individual tx error */ }); 
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        ws.on('close', () => {
            console.log(`${TXT.yellow}⚠️ WS Closed. Reconnecting...${TXT.reset}`);
            setTimeout(connect, 1000);
        });
        
        ws.on('error', (err) => {
            console.error(`${TXT.red}❌ WS Error: ${err.message}${TXT.reset}`);
            ws.terminate();
        });
    }

    // 3. ZERO-LATENCY PROCESSOR
    async function processTransaction(txHash) {
        // A. AGGRESSIVE FETCH
        const tx = await provider.getTransaction(txHash).catch(() => null);
        
        // If node hasn't indexed it yet, skip
        if (!tx || !tx.value || tx.value < CONFIG.WHALE_THRESHOLD) return;

        console.log(`\n${TXT.magenta}🎯 WHALE DETECTED: ${ethers.formatEther(tx.value)} ETH${TXT.reset}`);

        // B. PARALLEL PATH SOLVING
        const paths = [
            [CONFIG.TOKENS.WETH, CONFIG.TOKENS.DEGEN],
            [CONFIG.TOKENS.WETH, CONFIG.TOKENS.AERO],
            [CONFIG.TOKENS.WETH, CONFIG.TOKENS.USDC]
        ];

        const promises = paths.map(async (path) => {
            const [tokenIn, tokenOut] = path;
            try {
                // Static Call Simulation
                const profit = await flashContract.executeFlashArbitrage.staticCall(tokenIn, tokenOut, CONFIG.LOAN_AMOUNT);
                return { profit: BigInt(profit), path };
            } catch (e) {
                return { profit: 0n, path };
            }
        });

        const results = await Promise.all(promises);
        const bestResult = results.reduce((max, curr) => curr.profit > max.profit ? curr : max, { profit: 0n });

        // C. EXECUTION TRIGGER
        if (bestResult.profit > 0n) {
            console.log(`${TXT.gold}💰 PROFIT FOUND: ${ethers.formatEther(bestResult.profit)} ETH${TXT.reset}`);
            await executeStrike(bestResult.path);
        }
    }

    async function executeStrike(path) {
        try {
            const [tokenIn, tokenOut] = path;
            
            // 1. Calculate Real Gas
            const feeData = await provider.getFeeData();
            const txData = flashContract.interface.encodeFunctionData("executeFlashArbitrage", [tokenIn, tokenOut, CONFIG.LOAN_AMOUNT]);
            // Optional: getL1Fee might fail on non-OP stacks, wrap it
            // const l1Fee = await gasOracle.getL1Fee(txData).catch(() => 0n); 

            // 2. Bribe Calculation
            const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + CONFIG.PRIORITY_BRIBE)) / 100n;
            
            // 3. Send to Private RPC (Merkle) via Axios for privacy
            const txObj = {
                to: CONFIG.CONTRACT_ADDR,
                data: txData,
                gasLimit: CONFIG.GAS_LIMIT,
                maxPriorityFeePerGas: aggressivePriority,
                maxFeePerGas: feeData.maxFeePerGas,
                nonce: nextNonce++,
                type: 2,
                chainId: 8453
            };

            const signedTx = await signer.signTransaction(txObj);
            
            console.log(`${TXT.yellow}⚡ FIRING TO MERKLE...${TXT.reset}`);
            const res = await axios.post(CONFIG.MERKLE_RPC, { 
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] 
            });

            if (res.data.result) {
                console.log(`${TXT.green}🚀 STRIKE SUCCESS: ${res.data.result}${TXT.reset}`);
            } else {
                console.log(`${TXT.red}❌ REVERTED: ${JSON.stringify(res.data)}${TXT.reset}`);
            }

        } catch (e) {
            console.log(`${TXT.red}❌ STRIKE ERROR: ${e.message}${TXT.reset}`);
            if (e.message.includes("nonce")) nextNonce = await provider.getTransactionCount(signer.address);
        }
    }

    // Start
    setInterval(() => {
        process.stdout.write(`\r${TXT.dim}[SCANNING]${TXT.reset} ${TXT.cyan}Mach-1 Active${TXT.reset} | ${TXT.silver}Tx Scanned: ${scanCount}${TXT.reset}    `);
        seenHashes.clear(); 
    }, 5000);
    
    connect();
}
