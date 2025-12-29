import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Constants
const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const MIN_SPEED = 80;

const SnakeGame = () => {
  // Game State
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 10 });
  const [direction, setDirection] = useState({ x: 1, y: 0 }); // Moving Right
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  // Refs for mutable state needed inside the interval without re-triggering it
  // This "fixes" the stale closure problem common in React hooks game loops.
  const snakeRef = useRef(snake);
  const directionRef = useRef(direction);
  const lastProcessedDirectionRef = useRef(direction); // Fixes the "rapid reverse" bug
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const scoreRef = useRef(score);
  
  // Sync refs with state
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Initialize High Score from local storage if available
  useEffect(() => {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const generateFood = useCallback(() => {
    // Generate food that isn't on the snake
    let newFood;
    let isOnSnake = true;
    while (isOnSnake) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      // eslint-disable-next-line no-loop-func
      isOnSnake = snakeRef.current.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }
    setFood(newFood);
  }, []);

  const resetGame = () => {
    const initialSnake = [{ x: 10, y: 10 }];
    const initialDir = { x: 1, y: 0 };
    
    setSnake(initialSnake);
    setDirection(initialDir);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
    
    // Reset Refs
    snakeRef.current = initialSnake;
    directionRef.current = initialDir;
    lastProcessedDirectionRef.current = initialDir;
    gameOverRef.current = false;
    isPausedRef.current = false;
    scoreRef.current = 0;

    generateFood();
  };

  const handleGameOver = () => {
    setGameOver(true);
    setIsPaused(true);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      localStorage.setItem('snakeHighScore', scoreRef.current.toString());
    }
  };

  const gameLoop = useCallback(() => {
    if (isPausedRef.current || gameOverRef.current) return;

    const currentHead = snakeRef.current[0];
    const currentDir = directionRef.current;
    
    // Calculate new head position
    const newHead = {
      x: currentHead.x + currentDir.x,
      y: currentHead.y + currentDir.y
    };

    // 1. Check Wall Collision
    if (
      newHead.x < 0 || 
      newHead.x >= GRID_SIZE || 
      newHead.y < 0 || 
      newHead.y >= GRID_SIZE
    ) {
      handleGameOver();
      return;
    }

    // 2. Check Self Collision
    // We check against all segments except the very last one (which will move away unless we grew)
    // But to be safe and robust, we check all current segments.
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      handleGameOver();
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];

    // 3. Check Food Collision
    if (newHead.x === food.x && newHead.y === food.y) {
      setScore(s => s + 1);
      generateFood();
      // Don't pop the tail, so we grow
    } else {
      newSnake.pop(); // Remove tail
    }

    setSnake(newSnake);
    
    // Update the "last processed" direction to prevent double-turn suicide
    lastProcessedDirectionRef.current = currentDir;
  }, [food, generateFood]);

  // The Game Interval
  useEffect(() => {
    // Dynamic speed based on score
    const speed = Math.max(MIN_SPEED, INITIAL_SPEED - (score * 2));
    const intervalId = setInterval(gameLoop, speed);
    return () => clearInterval(intervalId);
  }, [gameLoop, score]); // Re-create interval when speed changes (score changes)

  // Input Handling
  const changeDirection = useCallback((newDir) => {
    if (isPausedRef.current || gameOverRef.current) return;

    const lastDir = lastProcessedDirectionRef.current;

    // Prevent reversing directly
    const isOpposite = (newDir.x === -lastDir.x && newDir.y === 0) || 
                       (newDir.y === -lastDir.y && newDir.x === 0);
    
    if (!isOpposite) {
      setDirection(newDir);
      directionRef.current = newDir; // Update ref immediately for rapid inputs
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    // Prevent default scrolling for arrow keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case 'ArrowUp': changeDirection({ x: 0, y: -1 }); break;
      case 'ArrowDown': changeDirection({ x: 0, y: 1 }); break;
      case 'ArrowLeft': changeDirection({ x: -1, y: 0 }); break;
      case 'ArrowRight': changeDirection({ x: 1, y: 0 }); break;
      case ' ': 
      case 'Enter':
        if (gameOver) resetGame();
        else if (!gameStarted) resetGame();
        else setIsPaused(p => !p);
        break;
      default: break;
    }
  }, [changeDirection, gameOver, gameStarted]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Render Helpers
  const getSegmentStyle = (x, y, isHead) => {
    const size = 100 / GRID_SIZE;
    return {
      left: `${x * size}%`,
      top: `${y * size}%`,
      width: `${size}%`,
      height: `${size}%`,
    };
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-lg">{score}</span>
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            High Score: {highScore}
          </div>
        </div>

        {/* Game Board Container */}
        <div className="p-4">
          <div className="relative w-full aspect-square bg-slate-900 rounded-lg border-2 border-slate-700 shadow-inner overflow-hidden">
            
            {/* Grid Background (Optional subtle pattern) */}
            <div className="absolute inset-0 opacity-10" 
                 style={{ 
                   backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', 
                   backgroundSize: `${100/GRID_SIZE}% ${100/GRID_SIZE}%` 
                 }}>
            </div>

            {/* Food */}
            <div
              className="absolute bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse transition-all duration-300"
              style={{
                ...getSegmentStyle(food.x, food.y, false),
                transform: 'scale(0.8)'
              }}
            />

            {/* Snake */}
            {snake.map((segment, index) => {
              const isHead = index === 0;
              return (
                <div
                  key={`${segment.x}-${segment.y}-${index}`}
                  className={`absolute transition-all duration-100 ${isHead ? 'z-10 bg-emerald-400' : 'z-0 bg-emerald-600'}`}
                  style={{
                    ...getSegmentStyle(segment.x, segment.y, isHead),
                    borderRadius: isHead ? '25%' : '15%',
                    transform: isHead ? 'scale(1.05)' : 'scale(0.95)'
                  }}
                >
                  {isHead && (
                     <div className="absolute inset-0 flex items-center justify-center space-x-[2px]">
                        <div className="w-1.5 h-1.5 bg-slate-900 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-slate-900 rounded-full"></div>
                     </div>
                  )}
                </div>
              );
            })}

            {/* Overlays */}
            {!gameStarted && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center z-20">
                <h1 className="text-4xl font-bold text-emerald-400 mb-2">SNAKE</h1>
                <p className="text-slate-400 mb-6 text-sm">Use arrow keys or buttons to move</p>
                <button 
                  onClick={resetGame}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3 rounded-full font-bold flex items-center space-x-2 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Game</span>
                </button>
              </div>
            )}

            {gameStarted && gameOver && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-300">
                <div className="text-red-500 font-bold text-3xl mb-1">GAME OVER</div>
                <div className="text-slate-300 text-lg mb-6">Score: {score}</div>
                <button 
                  onClick={resetGame}
                  className="bg-slate-100 hover:bg-white text-slate-900 px-8 py-3 rounded-full font-bold flex items-center space-x-2 transition-transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}
            
            {gameStarted && isPaused && !gameOver && (
              <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="bg-slate-800 px-6 py-3 rounded-full text-emerald-400 font-bold flex items-center shadow-xl border border-slate-700">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  PAUSED
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Area */}
        <div className="bg-slate-800 p-6 border-t border-slate-700">
          {/* Desktop Hint */}
          <div className="hidden md:flex justify-center text-xs text-slate-500 space-x-6 mb-2">
            <span className="flex items-center"><span className="border border-slate-600 px-1 rounded mr-1">Space</span> to Pause</span>
            <span className="flex items-center"><span className="border border-slate-600 px-1 rounded mr-1">Arrows</span> to Move</span>
          </div>

          {/* Mobile D-Pad */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto md:hidden">
            <div />
            <button 
              className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 p-4 rounded-xl flex items-center justify-center transition-colors shadow-lg"
              onPointerDown={(e) => { e.preventDefault(); changeDirection({ x: 0, y: -1 }); }}
            >
              <ChevronUp className="w-6 h-6" />
            </button>
            <div />
            
            <button 
              className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 p-4 rounded-xl flex items-center justify-center transition-colors shadow-lg"
              onPointerDown={(e) => { e.preventDefault(); changeDirection({ x: -1, y: 0 }); }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 p-4 rounded-xl flex items-center justify-center transition-colors shadow-lg border-2 border-slate-600/50"
              onClick={() => { if(gameStarted && !gameOver) setIsPaused(p => !p); else resetGame(); }}
            >
              {isPaused || !gameStarted ? <Play className="w-6 h-6 fill-current" /> : <div className="w-4 h-4 bg-slate-300 rounded-sm" />}
            </button>
            <button 
              className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 p-4 rounded-xl flex items-center justify-center transition-colors shadow-lg"
              onPointerDown={(e) => { e.preventDefault(); changeDirection({ x: 1, y: 0 }); }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            <div />
            <button 
              className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 p-4 rounded-xl flex items-center justify-center transition-colors shadow-lg"
              onPointerDown={(e) => { e.preventDefault(); changeDirection({ x: 0, y: 1 }); }}
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <div />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SnakeGame;
