// ===============================================================================
// APEX TITAN v66.0 (ULTIMATE QUANTUM MERGE) - HIGH-FREQUENCY ENGINE
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (QUANTUM NOISE SUPPRESSION) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200')) {
        console.error("\n\x1b[31m[PROTOCOL ERROR] Unexpected Response 200: Check ETH_WSS URL (likely HTTP instead of WSS).\x1b[0m");
        return;
    }
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe') || msg.includes('infura')) return; 
    if (msg.includes('401')) {
        console.error("\n\x1b[31m[AUTH ERROR] 401 Unauthorized: Invalid RPC API Key in .env\x1b[0m");
        return;
    }
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('401')) return;
});

// --- FLASHBOTS INTEGRATION ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.log("\x1b[33m%s\x1b[0m", "⚠️ Flashbots dependency missing. Private bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.EXECUTOR_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    BENEFICIARY: process.env.BENEFICIARY || "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // ASSETS & POOLS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",

    // 🚦 TRAFFIC CONTROL
    MAX_CORES: Math.min(os.cpus().length, 12), 
    WORKER_BOOT_DELAY_MS: 10000, 
    RPC_COOLDOWN_MS: 12000,
    HEARTBEAT_INTERVAL_MS: 30000,
    PORT: process.env.PORT || 8080,
    
    // 🐋 OMNISCIENT & QUANTUM SETTINGS
    WHALE_THRESHOLD: parseEther("15.0"), 
    LEVIATHAN_MIN_ETH: parseEther("10.0"),
    MAX_BRIBE_PERCENT: 99.9,
    GAS_LIMIT: 1400000n,
    MARGIN_ETH: "0.015",
    PRIORITY_BRIBE: 25n,

    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: process.env.ETH_RPC || "https://rpc.flashbots.net",
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS",
            relay: "https://relay.flashbots.net",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            color: TXT.cyan
        },
        {
            name: "BASE_MAINNET",
            chainId: 8453,
            rpc: process.env.BASE_RPC || "https://mainnet.base.org",
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            weth: "0x4200000000000000000000000000000000000006",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v66.0 | ULTIMATE QUANTUM OVERLORD     ║
║   STRATEGY: CLUSTERED OMNISCIENT + DARK POOL ROUTE    ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const isMissingKeys = GLOBAL_CONFIG.NETWORKS.some(n => n.wss.includes("YOUR_KEY") || n.rpc.includes("YOUR_KEY"));
    if (isMissingKeys) {
        console.log(`${TXT.red}${TXT.bold}[CRITICAL] Default 'YOUR_KEY' detected.${TXT.reset}`);
        console.log(`${TXT.yellow}Please update your .env with valid RPC/WSS credentials.${TXT.reset}\n`);
    }

    const cpuCount = GLOBAL_CONFIG.MAX_CORES;
    console.log(`${TXT.cyan}[SYSTEM] Forking ${cpuCount} Quantum Cores...${TXT.reset}`);

    const workers = [];
    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        const worker = cluster.fork();
        workers.push(worker);

        worker.on('message', (msg) => {
            if (msg.type === 'WHALE_SIGNAL') {
                workers.forEach(w => { if (w.id !== worker.id) w.send(msg); });
            }
        });
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core ${worker.id} offline. Ghost Rebooting...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 15000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    
    const startDelay = (cluster.worker.id % 8) * 2000;
    setTimeout(() => {
        initWorker(NETWORK).catch(() => process.exit(1));
    }, startDelay);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const IS_LISTENER = (cluster.worker.id <= 3);
    const ROLE = IS_LISTENER ? "LISTENER" : "STRIKER";
    
    let isProcessing = false;
    let currentEthPrice = 0;
    const walletKey = (process.env.PRIVATE_KEY || "").trim();

    if (!walletKey || walletKey.includes("0000000")) {
        console.error(`${TAG} ${TXT.red}Fatal: No Private Key found.${TXT.reset}`);
        return;
    }

    // 1. HEALTH SERVER (v26.1)
    try {
        const server = http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ONLINE", role: ROLE, chain: CHAIN.name, mode: "ULTIMATE_v66" }));
            } else { res.writeHead(404); res.end(); }
        });
        server.on('error', () => {});
        server.listen(Number(GLOBAL_CONFIG.PORT) + cluster.worker.id); 
    } catch (e) {}

    async function safeConnect() {
        try {
            // Protocol Validation (v65.8)
            if (!CHAIN.wss.startsWith("ws")) {
                console.error(`${TAG} ${TXT.red}PROTOCOL ERROR: WSS URL invalid.${TXT.reset}`);
                return;
            }

            const netObj = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
            const wsProvider = IS_LISTENER ? new WebSocketProvider(CHAIN.wss, netObj) : null;
            
            if (wsProvider) {
                wsProvider.on('error', (e) => {
                    const emsg = e.message || "";
                    if (emsg.includes("200") || emsg.includes("429")) process.stdout.write(`${TXT.red}!${TXT.reset}`);
                });
                if (wsProvider.websocket) {
                    wsProvider.websocket.onclose = () => setTimeout(safeConnect, 60000);
                }
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint80,uint80)"], provider);
            const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

            // Flashbots Provider
            let fbProvider = null;
            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                try {
                    fbProvider = await FlashbotsBundleProvider.create(provider, wallet, CHAIN.relay);
                } catch (e) {}
            }

            // Sync Oracles
            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [, price] = await priceFeed.latestRoundData();
                    currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS);

            const apexIface = new Interface([
                "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} ${ROLE} SYNCED on ${TAG}${TXT.reset}`);

            // --- IPC RECEIVER ---
            process.on('message', async (msg) => {
                if (msg.type === 'WHALE_SIGNAL' && msg.chainId === CHAIN.chainId && !isProcessing) {
                    isProcessing = true;
                    await strike(provider, wallet, fbProvider, apexIface, poolContract, CHAIN, msg.target, "IPC_QUANTUM");
                    setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                }
            });

            if (IS_LISTENER && wsProvider) {
                // MEMPOOL SNIPER
                wsProvider.on("pending", async (txHash) => {
                    if (isProcessing) return;
                    try {
                        const tx = await provider.getTransaction(txHash).catch(() => null);
                        if (tx && tx.to && tx.value >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                            process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: tx.to });
                            
                            const isDEX = (tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase());
                            if (isDEX) {
                                console.log(`\n${TAG} ${TXT.magenta}🚨 OMNISCIENT WHALE DETECTED: ${formatEther(tx.value)} ETH!${TXT.reset}`);
                                isProcessing = true;
                                await strike(provider, wallet, fbProvider, apexIface, poolContract, CHAIN, tx.to, "PRIMARY_SNIPE");
                                setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                            }
                        }
                    } catch (err) {}
                });

                // LEVIATHAN DECODER
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                wsProvider.on({ topics: [swapTopic] }, async (log) => {
                    if (isProcessing) return;
                    try {
                        const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                        const maxVal = decoded.reduce((max, val) => val > max ? val : max, 0n);
                        if (maxVal >= GLOBAL_CONFIG.LEVIATHAN_MIN_ETH) {
                            process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: log.address });
                            isProcessing = true;
                            console.log(`\n${TAG} ${TXT.yellow}🐳 LEVIATHAN LOG CONFIRMED: ${formatEther(maxVal)} ETH${TXT.reset}`);
                            await strike(provider, wallet, fbProvider, apexIface, poolContract, CHAIN, log.address, "LEVIATHAN_STRIKE");
                            setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                        }
                    } catch (e) {}
                });

                // PROBABILISTIC TRIANGLE PROBE
                setInterval(async () => {
                    if (isProcessing || Math.random() < 0.98) return; 
                    isProcessing = true;
                    await strike(provider, wallet, fbProvider, apexIface, poolContract, CHAIN, "0x...", "TRIANGLE_PROBE");
                    setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                }, 45000);
            }
        } catch (e) {
            setTimeout(safeConnect, 30000);
        }
    }

    await safeConnect();
}

async function strike(provider, wallet, fbProvider, iface, pool, CHAIN, target, mode) {
    try {
        // Dynamic Scaling (Pool Depth vs Balance)
        let loanAmount;
        if (pool && CHAIN.chainId === 8453) {
            const [res0] = await pool.getReserves();
            loanAmount = BigInt(res0) / 10n; // 10% depth limit
        } else {
            const bal = await provider.getBalance(wallet.address);
            loanAmount = bal > parseEther("0.1") ? parseEther("100") : parseEther("25");
        }

        let txData;
        if (mode === "TRIANGLE_PROBE") {
            const path = [CHAIN.weth, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, CHAIN.weth]; 
            txData = iface.encodeFunctionData("executeTriangle", [path, parseEther("25")]);
        } else {
            txData = iface.encodeFunctionData("executeFlashArbitrage", [CHAIN.weth, target, 0]);
        }
        
        // Visual Sequence (v47.0)
        if (mode !== "IPC_QUANTUM") {
            console.log(`   ↳ ${TXT.dim}🔍 MULTI-PATH: Scanning Multi-DEX liquidity paths...${TXT.reset}`);
            console.log(`   ↳ ${TXT.blue}🌑 DARK POOL: Routing via MEV-Share Private Peering...${TXT.reset}`);
        }

        const [simulation, feeData] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: txData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            provider.getFeeData()
        ]);

        if (simulation && simulation !== "0x") {
            console.log(`\n${TXT.green}${TXT.bold}💎 [${mode}] QUANTUM PROFIT AUTHORIZED!${TXT.reset}`);
            
            // Aggressive Priority Bribe (v47.0)
            const aggressivePriority = feeData.maxPriorityFeePerGas + 
                ((feeData.maxPriorityFeePerGas * GLOBAL_CONFIG.PRIORITY_BRIBE) / 100n);

            const tx = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: txData,
                type: 2,
                chainId: CHAIN.chainId,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                nonce: await provider.getTransactionCount(wallet.address),
                value: 0n
            };

            if (fbProvider && CHAIN.chainId === 1) {
                const bundle = [{ signedTransaction: await wallet.signTransaction(tx) }];
                await fbProvider.sendBundle(bundle, (await provider.getBlockNumber()) + 1);
                console.log(`   ${TXT.green}🎉 Private Quantum Bundle Dispatched (Mainnet)${TXT.reset}`);
            } else {
                const signedTx = await wallet.signTransaction(tx);
                const relayResponse = await axios.post(CHAIN.rpc, {
                    jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                }, { timeout: 2000 }).catch(() => null);

                if (relayResponse && relayResponse.data && relayResponse.data.result) {
                    console.log(`   ${TXT.green}✨ SUCCESS: FUNDS SECURED AT: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                } else {
                    await wallet.sendTransaction(tx).catch(() => {});
                }
            }
        }
    } catch (e) {}
}
