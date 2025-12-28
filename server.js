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
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    TOKENS: { 
        WETH: "0x4200000000000000000000000000000000000006", 
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        DEGEN: "0x4edbc9ba171790664872997239bc7a3f3a633190",
        AERO: "0x9401518c83Bf58717007e39F9ba4b2C7E759A5af"
    },
    LOAN_AMOUNT: ethers.parseEther("30"),
    GAS_LIMIT: 950000,
    PRIORITY_BRIBE: 15n, 
    WHALE_THRESHOLD: ethers.parseEther("0.1")
};

const RPC_URL = process.env.QUICKNODE_HTTP || "https://mainnet.base.org";
const WSS_URL = process.env.QUICKNODE_WSS || "wss://base-rpc.publicnode.com";

// --- MASTER THREAD ---
if (cluster.isPrimary) {
    console.log(`${TXT.bold}${TXT.gold}╔═══════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   🔱 APEX v38.17.1 | RATE-LIMITED MODE      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚═══════════════════════════════════════════════╝${TXT.reset}\n`);
    
    console.log(`${TXT.cyan}[MASTER] Spawning Single Worker...${TXT.reset}`);
    const worker = cluster.fork();
    
    worker.on('exit', (code, signal) => {
        console.log(`${TXT.red}⚠️ Worker died. Respawning in 5s...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 5000); // Slower respawn to cool down API
    });
} else {
    runWorker().catch(err => {
        console.error(`${TXT.red}❌ FATAL ERROR:${TXT.reset}`, err.message);
        process.exit(1);
    });
}

// --- WORKER THREAD ---
async function runWorker() {
    const rawKey = process.env.TREASURY_PRIVATE_KEY;
    if (!rawKey) { 
        console.error(`${TXT.red}❌ CONFIG ERROR: TREASURY_PRIVATE_KEY missing${TXT.reset}`); 
        process.exit(1); 
    }
    
    console.log(`${TXT.dim}[WORKER] Connecting to RPC...${TXT.reset}`);

    // RATE LIMITER: Use a standard JsonRpcProvider but catch 429 errors
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(rawKey.trim(), provider);
    
    const flashContract = new ethers.Contract(CONFIG.CONTRACT_ADDR, [
        "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount) external returns (uint256)"
    ], signer);

    let nextNonce;
    let scanCount = 0;
    const seenHashes = new Set();

    // 1. SAFE BOOT SEQUENCE
    try {
        // Wait random time to desync from other potential runners
        await new Promise(r => setTimeout(r, Math.random() * 2000));
        console.log(`${TXT.dim}[WORKER] Fetching Nonce...${TXT.reset}`);
        nextNonce = await provider.getTransactionCount(signer.address);
        console.log(`${TXT.cyan}[INIT] Nonce Synced: ${nextNonce}${TXT.reset}`);
    } catch (e) {
        console.error(`${TXT.red}❌ BOOT FAILED: ${e.message}${TXT.reset}`);
        if (e.message.includes("429") || e.message.includes("limit")) {
             console.log(`${TXT.yellow}➜ API Rate Limit Hit. Waiting 10s...${TXT.reset}`);
             await new Promise(r => setTimeout(r, 10000));
             process.exit(1); // Restart fresh
        }
        process.exit(1);
    }

    // 2. CONNECTION LOGIC
    let ws = null;
    function connect() {
        if (ws) { try { ws.terminate(); } catch(e){} }
        
        console.log(`${TXT.dim}[WORKER] Connecting WS...${TXT.reset}`);
        ws = new WebSocket(WSS_URL);

        ws.on('open', () => {
            console.log(`${TXT.green}📡 SOCKET CONNECTED${TXT.reset}`);
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newPendingTransactions"] }));
        });

        ws.on('message', async (data) => {
            try {
                const parsed = JSON.parse(data);
                const txHash = parsed.params?.result;
                if (txHash && !seenHashes.has(txHash)) {
                    seenHashes.add(txHash);
                    scanCount++;
                    // Rate Limit: Only process 1 out of every 2 transactions to save API credits
                    if (scanCount % 2 === 0) {
                        processTransaction(txHash).catch(() => {}); 
                    }
                }
            } catch (e) {}
        });

        ws.on('close', () => setTimeout(connect, 3000)); // Slower reconnect
        ws.on('error', () => ws.terminate());
    }

    // 3. SAFE PROCESSOR
    async function processTransaction(txHash) {
        // A. FETCH
        const tx = await provider.getTransaction(txHash).catch(() => null);
        if (!tx || !tx.value || tx.value < CONFIG.WHALE_THRESHOLD) return;

        console.log(`\n${TXT.magenta}🎯 WHALE: ${ethers.formatEther(tx.value)} ETH${TXT.reset}`);

        // B. SIMULATION (Only simulate 1 path to save API calls)
        try {
            const profit = await flashContract.executeFlashArbitrage.staticCall(
                CONFIG.TOKENS.WETH, CONFIG.TOKENS.DEGEN, CONFIG.LOAN_AMOUNT
            );
            
            if (BigInt(profit) > 0n) {
                console.log(`${TXT.gold}💰 PROFIT: ${ethers.formatEther(profit)} ETH${TXT.reset}`);
                await executeStrike();
            }
        } catch (e) {
            // Simulation failed, likely no profit
        }
    }

    async function executeStrike() {
        try {
            const feeData = await provider.getFeeData();
            const txData = flashContract.interface.encodeFunctionData("executeFlashArbitrage", [CONFIG.TOKENS.WETH, CONFIG.TOKENS.DEGEN, CONFIG.LOAN_AMOUNT]);
            
            const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + CONFIG.PRIORITY_BRIBE)) / 100n;

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
            
            console.log(`${TXT.yellow}⚡ FIRING...${TXT.reset}`);
            // Use Merkle (Free) instead of QuickNode for sendRawTransaction
            await axios.post(CONFIG.MERKLE_RPC, { 
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] 
            });

            console.log(`${TXT.green}🚀 SENT${TXT.reset}`);
        } catch (e) {
            if (e.message.includes("nonce")) nextNonce = await provider.getTransactionCount(signer.address);
        }
    }

    setInterval(() => {
        process.stdout.write(`\r${TXT.dim}[SCANNING]${TXT.reset} Scanned: ${scanCount}    `);
        seenHashes.clear();
    }, 5000);
    
    connect();
}
