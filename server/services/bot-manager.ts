import {randomBytes} from "crypto";
import type {
  BotData,
  BotDifficulty,
  Position,
  Position3D,
  Direction,
  Direction3D,
  GameState,
  GameState3D,
  PlayerGameState,
  PlayerGameState3D,
  GameSettings,
} from "../../shared/types.js";
import {PLAYER_COLORS} from "../../shared/types.js";

type PathNode = {
  position: Position | Position3D;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: PathNode;
};

export class BotManager {
  private bots = new Map<string, BotData>();
  private botDecisions = new Map<string, Direction | Direction3D>();
  private lastMoveTime = new Map<string, number>();

  // Bot-Namen für verschiedene Schwierigkeitsgrade
  private readonly botNames = {
    easy: ["Rookie", "Newbie", "Beginner", "Starter"],
    medium: ["Hunter", "Tracker", "Seeker", "Chaser"],
    hard: ["Viper", "Cobra", "Python", "Anaconda"],
  };

  // Bot zu Raum hinzufügen
  async addBot(
    roomId: string,
    difficulty: BotDifficulty,
    usedColors: string[]
  ): Promise<BotData> {
    const botId = this.generateBotId();
    const availableColor = this.getAvailableColor(usedColors);
    const botName = this.generateBotName(difficulty);

    const botData: BotData = {
      id: botId,
      name: botName,
      color: availableColor,
      roomId,
      difficulty,
      isReady: true, // Bots sind immer bereit
      createdAt: Date.now(),
    };

    this.bots.set(botId, botData);
    console.log(
      `🤖 Bot ${botName} (${difficulty}) zu Raum ${roomId} hinzugefügt`
    );

    return botData;
  }

  // Bot entfernen
  async removeBot(botId: string): Promise<boolean> {
    const bot = this.bots.get(botId);
    if (!bot) {
      return false;
    }

    this.bots.delete(botId);
    this.botDecisions.delete(botId);
    this.lastMoveTime.delete(botId);

    console.log(`🗑️ Bot ${bot.name} entfernt`);
    return true;
  }

  // Alle Bots in einem Raum abrufen
  async getBotsInRoom(roomId: string): Promise<BotData[]> {
    const botsInRoom: BotData[] = [];

    for (const bot of this.bots.values()) {
      if (bot.roomId === roomId) {
        botsInRoom.push(bot);
      }
    }

    return botsInRoom;
  }

  // Bot-Entscheidung für nächsten Zug (2D)
  async getBotMove(
    botId: string,
    gameState: GameState,
    gameSettings: GameSettings
  ): Promise<Direction | null> {
    const bot = this.bots.get(botId);
    if (!bot) {
      console.log(`🤖❌ Bot ${botId} nicht gefunden`);
      return null;
    }

    const botPlayer = gameState.players.find((p) => p.id === botId);
    if (!botPlayer || !botPlayer.alive) {
      console.log(`🤖💀 Bot ${bot.name} ist tot oder nicht im Spiel`);
      return null;
    }

    // Bewegungsgeschwindigkeit basierend auf Schwierigkeit
    const moveDelay = this.getMoveDelay(bot.difficulty);
    const lastMove = this.lastMoveTime.get(botId) || 0;
    const now = Date.now();

    if (now - lastMove < moveDelay) {
      const cachedDirection =
        (this.botDecisions.get(botId) as Direction) || botPlayer.direction;
      console.log(
        `🤖⏱️ Bot ${bot.name} wartet noch (${
          now - lastMove
        }ms/${moveDelay}ms), cached: ${cachedDirection}`
      );
      return cachedDirection;
    }

    console.log(
      `🤖🎯 Bot ${bot.name} (${bot.difficulty}) berechnet neuen Zug...`
    );
    console.log(
      `🤖📍 Position: (${botPlayer.snake[0].x}, ${botPlayer.snake[0].y}), Score: ${botPlayer.score}`
    );
    console.log(`🤖🍎 Verfügbares Futter: ${gameState.food.length} Stück`);

    const newDirection = this.calculateBestMove2D(
      botPlayer,
      gameState,
      gameSettings,
      bot.difficulty
    );
    this.botDecisions.set(botId, newDirection);
    this.lastMoveTime.set(botId, now);

    console.log(`🤖➡️ Bot ${bot.name} wählt Richtung: ${newDirection}`);
    return newDirection;
  }

  // Bot-Entscheidung für nächsten Zug (3D)
  async getBotMove3D(
    botId: string,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): Promise<Direction3D | null> {
    const bot = this.bots.get(botId);
    if (!bot) {
      return null;
    }

    const botPlayer = gameState.players.find((p) => p.id === botId);
    if (!botPlayer || !botPlayer.alive) {
      return null;
    }

    const moveDelay = this.getMoveDelay(bot.difficulty);
    const lastMove = this.lastMoveTime.get(botId) || 0;
    const now = Date.now();

    if (now - lastMove < moveDelay) {
      return (
        (this.botDecisions.get(botId) as Direction3D) || botPlayer.direction
      );
    }

    const newDirection = this.calculateBestMove3D(
      botPlayer,
      gameState,
      gameSettings,
      bot.difficulty
    );
    this.botDecisions.set(botId, newDirection);
    this.lastMoveTime.set(botId, now);

    return newDirection;
  }

  // Berechne besten Zug für 2D
  private calculateBestMove2D(
    botPlayer: PlayerGameState,
    gameState: GameState,
    gameSettings: GameSettings,
    difficulty: BotDifficulty
  ): Direction {
    const head = botPlayer.snake[0];
    const possibleMoves: Direction[] = ["up", "down", "left", "right"];
    const validMoves: Array<{direction: Direction; score: number}> = [];

    for (const direction of possibleMoves) {
      // Verhindere Rückwärtsbewegung
      if (this.isOppositeDirection2D(direction, botPlayer.direction)) {
        continue;
      }

      const nextPosition = this.getNextPosition2D(head, direction);

      // Prüfe Kollisionen
      if (this.wouldCollide2D(nextPosition, gameState, gameSettings)) {
        continue;
      }

      const score = this.evaluateMove2D(
        nextPosition,
        gameState,
        gameSettings,
        difficulty
      );
      validMoves.push({direction, score});
    }

    if (validMoves.length === 0) {
      // NOTFALL: DIREKTE FUTTER-SUCHE ohne Kollisionsprüfung
      console.log(
        `🤖🚨 Bot ${botPlayer.id} hat keine gültigen Züge! DIREKTE FUTTER-SUCHE aktiviert!`
      );

      const nearestFood = this.findNearestFood2D(head, gameState.food);
      if (nearestFood) {
        const directDirection = this.getDirectionToFood2D(head, nearestFood);
        if (
          directDirection &&
          !this.isOppositeDirection2D(directDirection, botPlayer.direction)
        ) {
          console.log(`🤖🍎🆘 Bot geht DIREKT zum Futter: ${directDirection}`);
          return directDirection;
        }
      }

      // Letzter Ausweg: Zufällige Richtung
      const emergencyMoves: Direction[] = ["up", "down", "left", "right"];
      const nonOpposite = emergencyMoves.filter(
        (dir) => !this.isOppositeDirection2D(dir, botPlayer.direction)
      );

      if (nonOpposite.length > 0) {
        const emergencyDirection =
          nonOpposite[Math.floor(Math.random() * nonOpposite.length)];
        console.log(
          `🤖🆘 Bot versucht Notfall-Richtung: ${emergencyDirection}`
        );
        return emergencyDirection;
      }

      console.log(
        `🤖💀 Bot kann sich nicht bewegen, behält aktuelle Richtung: ${botPlayer.direction}`
      );
      return botPlayer.direction;
    }

    // Sortiere Züge nach Bewertung
    validMoves.sort((a, b) => b.score - a.score);

    console.log(
      `🤖🧠 Bot-Entscheidung (${difficulty}):`,
      validMoves.map((m) => `${m.direction}:${m.score.toFixed(1)}`).join(", ")
    );

    // Wähle besten Zug basierend auf Schwierigkeit - EASY BOTS GEHEN DIREKT ZUM FUTTER!
    if (difficulty === "easy") {
      // Einfach: 90% beste Bewegung (zum Futter), 10% zufällig
      if (Math.random() < 0.9) {
        console.log(
          `🤖🍎✅ Easy Bot wählt BESTE Bewegung (zum Futter): ${validMoves[0].direction}`
        );
        return validMoves[0].direction;
      } else {
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        console.log(
          `🤖🎲 Easy Bot wählt zufällige Bewegung: ${validMoves[randomIndex].direction}`
        );
        return validMoves[randomIndex].direction;
      }
    } else if (difficulty === "medium") {
      // Mittel: 85% beste Bewegung, 15% zweitbeste
      if (Math.random() < 0.85 || validMoves.length === 1) {
        console.log(
          `🤖✅ Medium Bot wählt beste Bewegung: ${validMoves[0].direction}`
        );
        return validMoves[0].direction;
      } else {
        const secondBest =
          validMoves.length > 1 ? validMoves[1] : validMoves[0];
        console.log(
          `🤖🥈 Medium Bot wählt zweitbeste Bewegung: ${secondBest.direction}`
        );
        return secondBest.direction;
      }
    } else {
      // Schwer: 95% beste Bewegung, 5% zweitbeste
      if (Math.random() < 0.95 || validMoves.length === 1) {
        console.log(
          `🤖🏆 Hard Bot wählt beste Bewegung: ${validMoves[0].direction}`
        );
        return validMoves[0].direction;
      } else {
        const secondBest =
          validMoves.length > 1 ? validMoves[1] : validMoves[0];
        console.log(
          `🤖🥈 Hard Bot wählt zweitbeste Bewegung: ${secondBest.direction}`
        );
        return secondBest.direction;
      }
    }
  }

  // Berechne besten Zug für 3D
  private calculateBestMove3D(
    botPlayer: PlayerGameState3D,
    gameState: GameState3D,
    gameSettings: GameSettings,
    difficulty: BotDifficulty
  ): Direction3D {
    const head = botPlayer.snake[0];
    const possibleMoves: Direction3D[] = [
      "up",
      "down",
      "left",
      "right",
      "forward",
      "backward",
    ];
    const validMoves: Array<{direction: Direction3D; score: number}> = [];

    for (const direction of possibleMoves) {
      if (this.isOppositeDirection3D(direction, botPlayer.direction)) {
        continue;
      }

      const nextPosition = this.getNextPosition3D(head, direction);

      if (this.wouldCollide3D(nextPosition, gameState, gameSettings)) {
        continue;
      }

      const score = this.evaluateMove3D(
        nextPosition,
        gameState,
        gameSettings,
        difficulty
      );
      validMoves.push({direction, score});
    }

    if (validMoves.length === 0) {
      return botPlayer.direction;
    }

    if (difficulty === "easy") {
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      return validMoves[randomIndex].direction;
    } else if (difficulty === "medium") {
      validMoves.sort((a, b) => b.score - a.score);
      const topMoves = validMoves.slice(0, Math.min(2, validMoves.length));
      const randomIndex = Math.floor(Math.random() * topMoves.length);
      return topMoves[randomIndex].direction;
    } else {
      validMoves.sort((a, b) => b.score - a.score);
      return validMoves[0].direction;
    }
  }

  // Verbessertes A*-Pathfinding für 2D
  private findPath2D(
    start: Position,
    goal: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): Position[] {
    const maxIterations = 200; // Verhindere endlose Schleifen
    let iterations = 0;

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();
    const startNode: PathNode = {
      position: start,
      gCost: 0,
      hCost: this.calculateDistance2D(start, goal),
      fCost: 0,
    };
    startNode.fCost = startNode.gCost + startNode.hCost;
    openSet.push(startNode);

    console.log(
      `🤖🗺️ Pathfinding von (${start.x}, ${start.y}) zu (${goal.x}, ${goal.y})`
    );

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Finde Node mit niedrigstem fCost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const currentNode = openSet.shift()!;
      const posKey = `${currentNode.position.x},${currentNode.position.y}`;

      if (closedSet.has(posKey)) continue;
      closedSet.add(posKey);

      // Ziel erreicht?
      if (
        currentNode.position.x === goal.x &&
        currentNode.position.y === goal.y
      ) {
        const path: Position[] = [];
        let node: PathNode | undefined = currentNode;
        while (node) {
          path.unshift(node.position as Position);
          node = node.parent;
        }
        const finalPath = path.slice(1); // Ohne Startposition
        console.log(
          `🤖✅ Pfad gefunden! Länge: ${finalPath.length}, Iterationen: ${iterations}`
        );
        return finalPath;
      }

      // Nachbarn prüfen
      const directions: Direction[] = ["up", "down", "left", "right"];
      for (const direction of directions) {
        const neighborPos = this.getNextPosition2D(
          currentNode.position as Position,
          direction
        );
        const neighborKey = `${neighborPos.x},${neighborPos.y}`;

        if (
          closedSet.has(neighborKey) ||
          this.wouldCollide2D(neighborPos, gameState, gameSettings)
        ) {
          continue;
        }

        const gCost = currentNode.gCost + 1;
        // Verbesserte Heuristik: Manhattan-Distanz + kleine Zufälligkeit für Variation
        const hCost =
          this.calculateDistance2D(neighborPos, goal) + Math.random() * 0.1;
        const fCost = gCost + hCost;

        const existingNode = openSet.find(
          (n) =>
            (n.position as Position).x === neighborPos.x &&
            (n.position as Position).y === neighborPos.y
        );

        if (!existingNode || gCost < existingNode.gCost) {
          const neighborNode: PathNode = {
            position: neighborPos,
            gCost,
            hCost,
            fCost,
            parent: currentNode,
          };

          if (!existingNode) {
            openSet.push(neighborNode);
          } else {
            Object.assign(existingNode, neighborNode);
          }
        }
      }
    }

    console.log(`🤖❌ Kein Pfad gefunden nach ${iterations} Iterationen`);
    return []; // Kein Pfad gefunden
  }

  // VEREINFACHTE Bewerte Zug für 2D - FUTTER HAT ABSOLUTE PRIORITÄT!
  private evaluateMove2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings,
    difficulty: BotDifficulty
  ): number {
    let score = 0;
    let debugInfo: string[] = [];

    console.log(`🤖🔍 Bewerte Position (${position.x}, ${position.y})`);
    console.log(
      `🍎 Verfügbares Futter:`,
      gameState.food.map((f) => `(${f.x},${f.y})`).join(", ")
    );

    // FUTTER HAT ABSOLUTE PRIORITÄT - IMMER POSITIVE, HOHE SCORES!
    const nearestFood = this.findNearestFood2D(position, gameState.food);
    if (nearestFood) {
      const directDistance = this.calculateDistance2D(position, nearestFood);
      console.log(
        `🍎➡️ Nächstes Futter bei (${nearestFood.x}, ${nearestFood.y}), Distanz: ${directDistance}`
      );

      // VEREINFACHTE FUTTER-BEWERTUNG: Je näher, desto besser (IMMER POSITIV!)
      const foodScore = Math.max(500, 1000 - directDistance * 20); // Minimum 500, Maximum 1000 Punkte
      score += foodScore;
      debugInfo.push(
        `🍎FUTTER:${foodScore.toFixed(1)}(dist:${directDistance})`
      );

      console.log(
        `🍎✅ Futter-Score: ${foodScore} (Distanz: ${directDistance})`
      );
    } else {
      debugInfo.push("🍎❌Kein-Futter");
      console.log(`🤖🍎❌ Kein Futter verfügbar!`);
    }

    // Freiraum-Bewertung (deutlich reduziert, damit Futter Priorität hat)
    const freeSpace = this.calculateAdvancedFreeSpace2D(
      position,
      gameState,
      gameSettings
    );
    const freeSpaceScore = freeSpace * 2; // Reduziert von 5 auf 2
    score += freeSpaceScore;
    debugInfo.push(`Freiraum:${freeSpaceScore.toFixed(1)}(${freeSpace})`);

    // Gefahrenbewertung (STARK REDUZIERT, damit sie Futter nicht überschreibt)
    const dangerScore =
      this.evaluateDanger2D(position, gameState, gameSettings) * 0.3; // Nur 30% der ursprünglichen Gefahr
    score += dangerScore;
    if (dangerScore < 0) debugInfo.push(`Gefahr:${dangerScore.toFixed(1)}`);

    // Schwierigkeitsgrad-spezifische Strategien (reduziert)
    if (difficulty === "easy") {
      // Easy Bots: Fokus nur auf Futter, minimale Zufälligkeit
      score += Math.random() * 10 - 5; // Reduziert von 30 auf 10
      debugInfo.push("Easy-Modus");
    } else if (difficulty === "medium") {
      const balancedScore =
        this.evaluateBalancedStrategy2D(position, gameState, gameSettings) *
        0.5;
      score += balancedScore;
      if (balancedScore > 0)
        debugInfo.push(`Balance:${balancedScore.toFixed(1)}`);
    } else {
      const aggressiveScore =
        this.evaluateAggressiveStrategy2D(position, gameState, gameSettings) *
        0.5;
      score += aggressiveScore;
      if (aggressiveScore > 0)
        debugInfo.push(`Aggro:${aggressiveScore.toFixed(1)}`);
    }

    console.log(
      `🤖📊 FINALE Position (${position.x}, ${
        position.y
      }) Score: ${score.toFixed(1)} [${debugInfo.join(", ")}]`
    );
    return score;
  }

  // A*-Pathfinding für 3D
  private findPath3D(
    start: Position3D,
    goal: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): Position3D[] {
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();
    const startNode: PathNode = {
      position: start,
      gCost: 0,
      hCost: this.calculateDistance3D(start, goal),
      fCost: 0,
    };
    startNode.fCost = startNode.gCost + startNode.hCost;
    openSet.push(startNode);

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.fCost - b.fCost);
      const currentNode = openSet.shift()!;
      const posKey = `${currentNode.position.x},${currentNode.position.y},${
        (currentNode.position as Position3D).z
      }`;

      if (closedSet.has(posKey)) continue;
      closedSet.add(posKey);

      if (
        currentNode.position.x === goal.x &&
        currentNode.position.y === goal.y &&
        (currentNode.position as Position3D).z === goal.z
      ) {
        const path: Position3D[] = [];
        let node: PathNode | undefined = currentNode;
        while (node) {
          path.unshift(node.position as Position3D);
          node = node.parent;
        }
        return path.slice(1);
      }

      const directions: Direction3D[] = [
        "up",
        "down",
        "left",
        "right",
        "forward",
        "backward",
      ];
      for (const direction of directions) {
        const neighborPos = this.getNextPosition3D(
          currentNode.position as Position3D,
          direction
        );
        const neighborKey = `${neighborPos.x},${neighborPos.y},${neighborPos.z}`;

        if (
          closedSet.has(neighborKey) ||
          this.wouldCollide3D(neighborPos, gameState, gameSettings)
        ) {
          continue;
        }

        const gCost = currentNode.gCost + 1;
        const hCost = this.calculateDistance3D(neighborPos, goal);
        const fCost = gCost + hCost;

        const existingNode = openSet.find((n) => {
          const pos = n.position as Position3D;
          return (
            pos.x === neighborPos.x &&
            pos.y === neighborPos.y &&
            pos.z === neighborPos.z
          );
        });

        if (!existingNode || gCost < existingNode.gCost) {
          const neighborNode: PathNode = {
            position: neighborPos,
            gCost,
            hCost,
            fCost,
            parent: currentNode,
          };

          if (!existingNode) {
            openSet.push(neighborNode);
          } else {
            Object.assign(existingNode, neighborNode);
          }
        }
      }
    }

    return [];
  }

  // VEREINFACHTE Bewerte Zug für 3D - FUTTER HAT ABSOLUTE PRIORITÄT!
  private evaluateMove3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings,
    difficulty: BotDifficulty
  ): number {
    let score = 0;
    let debugInfo: string[] = [];

    console.log(
      `🤖🔍3D Bewerte Position (${position.x}, ${position.y}, ${position.z})`
    );
    console.log(
      `🍎3D Verfügbares Futter:`,
      gameState.food.map((f) => `(${f.x},${f.y},${f.z})`).join(", ")
    );

    // FUTTER HAT ABSOLUTE PRIORITÄT - IMMER POSITIVE, HOHE SCORES!
    const nearestFood = this.findNearestFood3D(position, gameState.food);
    if (nearestFood) {
      const directDistance = this.calculateDistance3D(position, nearestFood);
      console.log(
        `🍎➡️3D Nächstes Futter bei (${nearestFood.x}, ${nearestFood.y}, ${nearestFood.z}), Distanz: ${directDistance}`
      );

      // VEREINFACHTE FUTTER-BEWERTUNG: Je näher, desto besser (IMMER POSITIV!)
      const foodScore = Math.max(500, 1000 - directDistance * 15); // Minimum 500, Maximum 1000 Punkte
      score += foodScore;
      debugInfo.push(
        `🍎FUTTER:${foodScore.toFixed(1)}(dist:${directDistance})`
      );

      console.log(
        `🍎✅3D Futter-Score: ${foodScore} (Distanz: ${directDistance})`
      );
    } else {
      debugInfo.push("🍎❌Kein-Futter");
      console.log(`🤖🍎❌3D Kein Futter verfügbar!`);
    }

    // 3D-Freiraum-Bewertung (reduziert)
    const freeSpace = this.calculateAdvancedFreeSpace3D(
      position,
      gameState,
      gameSettings
    );
    const freeSpaceScore = freeSpace * 3; // Reduziert von 12 auf 3
    score += freeSpaceScore;
    debugInfo.push(`Freiraum:${freeSpaceScore.toFixed(1)}(${freeSpace})`);

    // 3D-Gefahrenvermeidung (STARK REDUZIERT)
    const dangerScore =
      this.evaluateDanger3D(position, gameState, gameSettings) * 0.3;
    score += dangerScore;
    if (dangerScore < 0) debugInfo.push(`Gefahr:${dangerScore.toFixed(1)}`);

    // 3D-spezifische Strategien (reduziert)
    if (difficulty === "easy") {
      score += Math.random() * 10 - 5;
      debugInfo.push("Easy-3D-Modus");
    } else if (difficulty === "medium") {
      const balancedScore =
        this.evaluateBalancedStrategy3D(position, gameState, gameSettings) *
        0.5;
      score += balancedScore;
      if (balancedScore > 0)
        debugInfo.push(`Balance:${balancedScore.toFixed(1)}`);
    } else {
      const aggressiveScore =
        this.evaluateAggressiveStrategy3D(position, gameState, gameSettings) *
        0.5;
      score += aggressiveScore;
      if (aggressiveScore > 0)
        debugInfo.push(`Aggro:${aggressiveScore.toFixed(1)}`);
    }

    console.log(
      `🤖📊3D FINALE Position (${position.x}, ${position.y}, ${
        position.z
      }) Score: ${score.toFixed(1)} [${debugInfo.join(", ")}]`
    );
    return score;
  }

  // Hilfsmethoden
  private generateBotId(): string {
    return `bot_${randomBytes(8).toString("hex")}`;
  }

  private generateBotName(difficulty: BotDifficulty): string {
    const names = this.botNames[difficulty];
    const baseName = names[Math.floor(Math.random() * names.length)];
    const suffix = Math.floor(Math.random() * 100);
    return `${baseName}${suffix}`;
  }

  private getAvailableColor(usedColors: string[]): string {
    for (const color of PLAYER_COLORS) {
      if (!usedColors.includes(color)) {
        return color;
      }
    }
    return PLAYER_COLORS[0]; // Fallback
  }

  private isOppositeDirection2D(dir1: Direction, dir2: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    return opposites[dir1] === dir2;
  }

  private isOppositeDirection3D(dir1: Direction3D, dir2: Direction3D): boolean {
    const opposites: Record<Direction3D, Direction3D> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
      forward: "backward",
      backward: "forward",
    };
    return opposites[dir1] === dir2;
  }

  private getNextPosition2D(
    position: Position,
    direction: Direction
  ): Position {
    switch (direction) {
      case "up":
        return {x: position.x, y: position.y - 1};
      case "down":
        return {x: position.x, y: position.y + 1};
      case "left":
        return {x: position.x - 1, y: position.y};
      case "right":
        return {x: position.x + 1, y: position.y};
    }
  }

  private getNextPosition3D(
    position: Position3D,
    direction: Direction3D
  ): Position3D {
    switch (direction) {
      case "up":
        return {x: position.x, y: position.y - 1, z: position.z};
      case "down":
        return {x: position.x, y: position.y + 1, z: position.z};
      case "left":
        return {x: position.x - 1, y: position.y, z: position.z};
      case "right":
        return {x: position.x + 1, y: position.y, z: position.z};
      case "forward":
        return {x: position.x, y: position.y, z: position.z + 1};
      case "backward":
        return {x: position.x, y: position.y, z: position.z - 1};
    }
  }

  private wouldCollide2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): boolean {
    // Wand-Kollision prüfen
    const boardSize = this.getBoardSize2D(gameSettings.boardSize);
    if (
      position.x < 0 ||
      position.x >= boardSize.width ||
      position.y < 0 ||
      position.y >= boardSize.height
    ) {
      return true;
    }

    // Schlangen-Kollision prüfen
    for (const player of gameState.players) {
      if (player.alive) {
        for (const segment of player.snake) {
          if (segment.x === position.x && segment.y === position.y) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private wouldCollide3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): boolean {
    const boardSize = this.getBoardSize3D(gameSettings.boardSize);
    if (
      position.x < 0 ||
      position.x >= boardSize.width ||
      position.y < 0 ||
      position.y >= boardSize.height ||
      position.z < 0 ||
      position.z >= boardSize.depth
    ) {
      return true;
    }

    for (const player of gameState.players) {
      if (player.alive) {
        for (const segment of player.snake) {
          if (
            segment.x === position.x &&
            segment.y === position.y &&
            segment.z === position.z
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private findNearestFood2D(
    position: Position,
    food: Position[]
  ): Position | null {
    if (food.length === 0) return null;

    let nearest = food[0];
    let minDistance = this.calculateDistance2D(position, nearest);

    for (const f of food) {
      const distance = this.calculateDistance2D(position, f);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = f;
      }
    }

    return nearest;
  }

  private findNearestFood3D(
    position: Position3D,
    food: Position3D[]
  ): Position3D | null {
    if (food.length === 0) return null;

    let nearest = food[0];
    let minDistance = this.calculateDistance3D(position, nearest);

    for (const f of food) {
      const distance = this.calculateDistance3D(position, f);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = f;
      }
    }

    return nearest;
  }

  private calculateDistance2D(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  private calculateDistance3D(pos1: Position3D, pos2: Position3D): number {
    return (
      Math.abs(pos1.x - pos2.x) +
      Math.abs(pos1.y - pos2.y) +
      Math.abs(pos1.z - pos2.z)
    );
  }

  // Erweiterte Freiraum-Berechnung
  private calculateAdvancedFreeSpace2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): number {
    const visited = new Set<string>();
    const queue: Position[] = [position];
    let freeSpace = 0;
    const maxDepth = 15;

    while (queue.length > 0 && freeSpace < maxDepth) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);
      freeSpace++;

      const directions: Direction[] = ["up", "down", "left", "right"];
      for (const direction of directions) {
        const next = this.getNextPosition2D(current, direction);
        const nextKey = `${next.x},${next.y}`;

        if (
          !visited.has(nextKey) &&
          !this.wouldCollide2D(next, gameState, gameSettings)
        ) {
          queue.push(next);
        }
      }
    }

    return freeSpace;
  }

  // Gefahrenbewertung
  private evaluateDanger2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): number {
    let dangerScore = 0;

    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const enemyHead = player.snake[0];
        const distance = this.calculateDistance2D(position, enemyHead);

        // Sehr nahe Gegner sind gefährlich
        if (distance <= 3) {
          dangerScore -= (4 - distance) * 50;
        }

        // Prüfe ob Gegner uns abschneiden könnte
        if (distance <= 5 && player.snake.length >= 3) {
          const enemyDirection = this.predictEnemyDirection(player);
          if (
            enemyDirection &&
            this.couldIntercept(position, enemyHead, enemyDirection)
          ) {
            dangerScore -= 30;
          }
        }
      }
    }

    // Wandnähe bewerten
    const boardSize = this.getBoardSize2D(gameSettings.boardSize);
    const wallDistance = Math.min(
      position.x,
      position.y,
      boardSize.width - 1 - position.x,
      boardSize.height - 1 - position.y
    );

    if (wallDistance <= 2) {
      dangerScore -= (3 - wallDistance) * 20;
    }

    return dangerScore;
  }

  // Aggressive Strategie für schwere Bots
  private evaluateAggressiveStrategy2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): number {
    let score = 0;

    // Suche nach Möglichkeiten, Gegner abzuschneiden
    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const enemyHead = player.snake[0];
        const distance = this.calculateDistance2D(position, enemyHead);

        // Belohne aggressive Positionierung
        if (distance >= 3 && distance <= 8) {
          score += 25;
        }

        // Bonus für Territoriumskontrolle
        if (
          this.controlsTerritory(position, enemyHead, gameState, gameSettings)
        ) {
          score += 40;
        }
      }
    }

    return score;
  }

  // Ausgewogene Strategie für mittlere Bots
  private evaluateBalancedStrategy2D(
    position: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): number {
    let score = 0;

    // Balance zwischen Sicherheit und Aggression
    const centerX = this.getBoardSize2D(gameSettings.boardSize).width / 2;
    const centerY = this.getBoardSize2D(gameSettings.boardSize).height / 2;
    const distanceToCenter = this.calculateDistance2D(position, {
      x: centerX,
      y: centerY,
    });

    // Bevorzuge zentrale Positionen
    score += Math.max(0, 20 - distanceToCenter);

    // Moderate Risikobereitschaft
    const nearbyEnemies = this.countNearbyEnemies(position, gameState, 5);
    if (nearbyEnemies === 1) {
      score += 15; // Ein Gegner in der Nähe ist manageable
    } else if (nearbyEnemies > 1) {
      score -= nearbyEnemies * 10; // Mehrere Gegner vermeiden
    }

    return score;
  }

  // Erweiterte 3D-Freiraum-Berechnung
  private calculateAdvancedFreeSpace3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): number {
    const visited = new Set<string>();
    const queue: Position3D[] = [position];
    let freeSpace = 0;
    const maxDepth = 20;

    while (queue.length > 0 && freeSpace < maxDepth) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y},${current.z}`;

      if (visited.has(key)) continue;
      visited.add(key);
      freeSpace++;

      const directions: Direction3D[] = [
        "up",
        "down",
        "left",
        "right",
        "forward",
        "backward",
      ];
      for (const direction of directions) {
        const next = this.getNextPosition3D(current, direction);
        const nextKey = `${next.x},${next.y},${next.z}`;

        if (
          !visited.has(nextKey) &&
          !this.wouldCollide3D(next, gameState, gameSettings)
        ) {
          queue.push(next);
        }
      }
    }

    return freeSpace;
  }

  // 3D-Gefahrenbewertung
  private evaluateDanger3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): number {
    let dangerScore = 0;

    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const enemyHead = player.snake[0];
        const distance = this.calculateDistance3D(position, enemyHead);

        if (distance <= 3) {
          dangerScore -= (4 - distance) * 40;
        }

        if (distance <= 5 && player.snake.length >= 3) {
          const enemyDirection = this.predictEnemyDirection3D(player);
          if (
            enemyDirection &&
            this.couldIntercept3D(position, enemyHead, enemyDirection)
          ) {
            dangerScore -= 25;
          }
        }
      }
    }

    // 3D-Wandnähe bewerten
    const boardSize = this.getBoardSize3D(gameSettings.boardSize);
    const wallDistance = Math.min(
      position.x,
      position.y,
      position.z,
      boardSize.width - 1 - position.x,
      boardSize.height - 1 - position.y,
      boardSize.depth - 1 - position.z
    );

    if (wallDistance <= 2) {
      dangerScore -= (3 - wallDistance) * 15;
    }

    return dangerScore;
  }

  // 3D-Aggressive Strategie
  private evaluateAggressiveStrategy3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): number {
    let score = 0;

    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const enemyHead = player.snake[0];
        const distance = this.calculateDistance3D(position, enemyHead);

        if (distance >= 3 && distance <= 8) {
          score += 20;
        }

        if (
          this.controlsTerritory3D(position, enemyHead, gameState, gameSettings)
        ) {
          score += 35;
        }
      }
    }

    return score;
  }

  // 3D-Ausgewogene Strategie
  private evaluateBalancedStrategy3D(
    position: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): number {
    let score = 0;

    const boardSize = this.getBoardSize3D(gameSettings.boardSize);
    const centerX = boardSize.width / 2;
    const centerY = boardSize.height / 2;
    const centerZ = boardSize.depth / 2;
    const distanceToCenter = this.calculateDistance3D(position, {
      x: centerX,
      y: centerY,
      z: centerZ,
    });

    score += Math.max(0, 25 - distanceToCenter);

    const nearbyEnemies = this.countNearbyEnemies3D(position, gameState, 5);
    if (nearbyEnemies === 1) {
      score += 12;
    } else if (nearbyEnemies > 1) {
      score -= nearbyEnemies * 8;
    }

    return score;
  }

  // 3D-Hilfsmethoden
  private predictEnemyDirection3D(
    player: PlayerGameState3D
  ): Direction3D | null {
    if (player.snake.length < 2) return null;

    const head = player.snake[0];
    const neck = player.snake[1];

    if (head.x > neck.x) return "right";
    if (head.x < neck.x) return "left";
    if (head.y > neck.y) return "down";
    if (head.y < neck.y) return "up";
    if (head.z > neck.z) return "forward";
    if (head.z < neck.z) return "backward";

    return null;
  }

  private couldIntercept3D(
    botPos: Position3D,
    enemyHead: Position3D,
    enemyDirection: Direction3D
  ): boolean {
    const enemyNext = this.getNextPosition3D(enemyHead, enemyDirection);
    const distanceToEnemy = this.calculateDistance3D(botPos, enemyNext);
    return distanceToEnemy <= 2;
  }

  private controlsTerritory3D(
    botPos: Position3D,
    enemyPos: Position3D,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): boolean {
    for (const food of gameState.food) {
      const botToFood = this.calculateDistance3D(botPos, food);
      const enemyToFood = this.calculateDistance3D(enemyPos, food);

      if (botToFood < enemyToFood && botToFood <= 6) {
        return true;
      }
    }
    return false;
  }

  private countNearbyEnemies3D(
    position: Position3D,
    gameState: GameState3D,
    radius: number
  ): number {
    let count = 0;
    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const distance = this.calculateDistance3D(position, player.snake[0]);
        if (distance <= radius) {
          count++;
        }
      }
    }
    return count;
  }

  private getBoardSize2D(size: "small" | "medium" | "large") {
    const sizes = {
      small: {width: 20, height: 20},
      medium: {width: 30, height: 30},
      large: {width: 40, height: 40},
    };
    return sizes[size];
  }

  private getBoardSize3D(size: "small" | "medium" | "large") {
    const sizes = {
      small: {width: 20, height: 20, depth: 20},
      medium: {width: 30, height: 30, depth: 30},
      large: {width: 40, height: 40, depth: 40},
    };
    return sizes[size];
  }

  // Alle Bots in einem Raum entfernen
  async removeAllBotsInRoom(roomId: string): Promise<void> {
    const botsToRemove: string[] = [];

    for (const [botId, bot] of this.bots.entries()) {
      if (bot.roomId === roomId) {
        botsToRemove.push(botId);
      }
    }

    for (const botId of botsToRemove) {
      await this.removeBot(botId);
    }
  }

  // DIREKTE FUTTER-SUCHE Hilfsfunktionen
  private getDirectionToFood2D(
    position: Position,
    food: Position
  ): Direction | null {
    const dx = food.x - position.x;
    const dy = food.y - position.y;

    // Wähle die Richtung mit der größten Distanz
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    } else if (Math.abs(dy) > 0) {
      return dy > 0 ? "down" : "up";
    }

    return null; // Bereits am Futter
  }

  private getDirectionToFood3D(
    position: Position3D,
    food: Position3D
  ): Direction3D | null {
    const dx = food.x - position.x;
    const dy = food.y - position.y;
    const dz = food.z - position.z;

    // Wähle die Richtung mit der größten Distanz
    const maxDistance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));

    if (Math.abs(dx) === maxDistance) {
      return dx > 0 ? "right" : "left";
    } else if (Math.abs(dy) === maxDistance) {
      return dy > 0 ? "down" : "up";
    } else if (Math.abs(dz) === maxDistance) {
      return dz > 0 ? "forward" : "backward";
    }

    return null; // Bereits am Futter
  }

  // Hilfsmethoden für erweiterte Bot-Intelligenz
  private predictEnemyDirection(player: PlayerGameState): Direction | null {
    if (player.snake.length < 2) return null;

    const head = player.snake[0];
    const neck = player.snake[1];

    if (head.x > neck.x) return "right";
    if (head.x < neck.x) return "left";
    if (head.y > neck.y) return "down";
    if (head.y < neck.y) return "up";

    return null;
  }

  private couldIntercept(
    botPos: Position,
    enemyHead: Position,
    enemyDirection: Direction
  ): boolean {
    const enemyNext = this.getNextPosition2D(enemyHead, enemyDirection);
    const distanceToEnemy = this.calculateDistance2D(botPos, enemyNext);
    return distanceToEnemy <= 2;
  }

  private controlsTerritory(
    botPos: Position,
    enemyPos: Position,
    gameState: GameState,
    gameSettings: GameSettings
  ): boolean {
    // Prüfe ob Bot zwischen Gegner und Futter steht
    for (const food of gameState.food) {
      const botToFood = this.calculateDistance2D(botPos, food);
      const enemyToFood = this.calculateDistance2D(enemyPos, food);

      if (botToFood < enemyToFood && botToFood <= 5) {
        return true;
      }
    }
    return false;
  }

  private countNearbyEnemies(
    position: Position,
    gameState: GameState,
    radius: number
  ): number {
    let count = 0;
    for (const player of gameState.players) {
      if (player.alive && player.snake.length > 0) {
        const distance = this.calculateDistance2D(position, player.snake[0]);
        if (distance <= radius) {
          count++;
        }
      }
    }
    return count;
  }

  // Drastisch verbesserte Bewegungsgeschwindigkeiten
  private getMoveDelay(difficulty: BotDifficulty): number {
    switch (difficulty) {
      case "easy":
        return 150; // Viel schneller
      case "medium":
        return 100; // Sehr schnell
      case "hard":
        return 50; // Extrem schnell
      default:
        return 100;
    }
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      totalBots: this.bots.size,
      bots: Array.from(this.bots.values()).map((bot) => ({
        id: bot.id,
        name: bot.name,
        roomId: bot.roomId,
        difficulty: bot.difficulty,
        createdAt: new Date(bot.createdAt).toISOString(),
      })),
    };
  }
}
