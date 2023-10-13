import { spawn } from 'child_process';
import { basename } from 'path';
import fs from 'fs/promises';
import CONFIG from './fixtures/CONFIG.js';
import prepareBinaries from './fixtures/buildUtils.js';
import createClientProcess from './fixtures/createClientProcess.js';
import loadRozgrywki from './fixtures/loadRozgrywki.js';

// for saving results
let players = {};
let currentGame = {};

// for syncing
let waiters = {
  serverListen: undefined,
  gameID: undefined,
  gameCounted: undefined,
};

let processes = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForVar = (varName, ms = CONFIG.defaultTimeout) =>
  new Promise((resolve) => {
    const loop = () => {
      if (waiters[varName] !== undefined) {
        console.log(`[INFO] Got "${varName}"!`);
        resolve();
      } else {
        console.log(`[INFO] waiting for variable "${varName}"...`);
        setTimeout(loop, ms);
      }
    };
    loop();
  });

const processServerMessages = async (data) => {
  // find server listen
  if (data.includes('server listening')) waiters.serverListen = true;
  // find gameID
  if (data.includes('nowaGra()')) {
    waiters.gameID = String(data).split(' nowaGra')[0].split(' ').at(-1);
  }
  // find kolejność graczy
  if (data.includes('kolejność graczy')) {
    const graczeLogLine = String(data)
      .split('\n')
      .find((item) => item.includes('kolejność graczy'));
    const graczeToTrim = graczeLogLine
      .split('graczy:')[1]
      .replaceAll(' ', '')
      .split(/[1-5]\.\"/)
      .slice(1);
    let gracze = [];
    for (const gracz of graczeToTrim) {
      gracze.push(gracz.slice(0, -1));
    }
    console.log('[DEBUG] LOG GRACZE LINE', graczeLogLine);
    console.log('[DEBUG] GRACZE', gracze);
    for (const [index, graczName] of gracze.entries()) {
      if (!currentGame[graczName]) currentGame[graczName] = {};
      currentGame[graczName].numer = index + 1;
    }
    console.log('[INFO KOLEJNOŚĆ]', currentGame);
  }
  // find kto Wygrał
  if (data.includes('WynikGry.WygranyGracz')) {
    if (waiters.gameCounted == undefined) {
      // OLD METHOD
      /*const stanLogLine = String(data)
        .split('\n')
        .find((item) => item.includes('"KtoWygral"'));
      //console.log('[INFO STAN]', stanLogLine);
      let json;
      try {
        json = JSON.parse(stanLogLine.split('stan: ')[1]);
      } catch (err) {
        console.log('[SERVER ERROR] Server returned unfinished JSON');
        waiters.gameCounted = true;
        return;
      }
      console.log('[INFO STAN]', json);
      if (json.KtoWygral < 1) {
        console.log('[SERVER ERROR] Server returned -1 as KtoWygral');
        waiters.gameCounted = true;
        return;
      }
      const winner = Object.keys(currentGame).find(
        (key) => currentGame[key].numer == json.KtoWygral
      );*/

      const stanLogLine = String(data)
        .split('\n')
        .find((item) => item.includes('WynikGry.WygranyGracz'));
      const winner = stanLogLine
        .split('WynikGry.WygranyGracz: ')[1]
        .replaceAll('"', '');

      // Should be fixed by server
      if (!winner) {
        return
        /*for (const bot of Object.keys(processes)) {
          if (bot == 'server') continue;
          processes[bot].kill();
        }

        const czasRuchuLogLine = String(data)
          .split('\n')
          .find((item) => item.includes('arenaFlow()'));
        const loser = czasRuchuLogLine.split('dla gracza: ')[1];
        console.log('[INFO STAN 2] Winner missing', czasRuchuLogLine, loser);
        const winners = Object.keys(currentGame).filter(
          (key) => key != loser && key != 'name'
        );
        console.log('[DEBUG] winners', winners);
        for (const winner of winners) {
          if (winner == 'name') continue;
          currentGame[winner].wins++;
        }
        waiters.gameCounted = true;

        console.log('[BUGGED WygranyGracz]');
        console.dir(currentGame, { depth: null });
        return*/
      }

      console.log('[INFO STAN] LOG LINE', stanLogLine, winner);
      console.log('[INFO STAN] WINNER', stanLogLine);
      currentGame[winner].wins++;
      waiters.gameCounted = true;
    }
  }
  // find Invalid card or color
  if (data.includes('invalid')) {
    const invalidLogLines = String(data)
      .split('\n')
      .filter(
        (item) => item.includes('WykonajRuch()') && item.includes('invalid')
      );
    if (invalidLogLines.length == 0) return;
    console.log(
      '[DEBUG] INVALID COUNT',
      invalidLogLines,
      invalidLogLines.length
    );
    let buggyPlayer;
    buggyPlayer = invalidLogLines[0]
      .split('WykonajRuch(): ')[1]
      .split(/ wykonał| żąda/)[0];
    if (!buggyPlayer) {
      buggyPlayer = invalidLogLines[1]
        .split('WykonajRuch(): ')[1]
        .split(/ wykonał| żąda/)[0];
    }

    console.log('[DEBUG] Buggy player', buggyPlayer);
    if (currentGame[buggyPlayer].invalidMoves)
      currentGame[buggyPlayer].invalidMoves += invalidLogLines.length;
    else currentGame[buggyPlayer].invalidMoves = invalidLogLines.length;

    console.log(
      `[INFO] BOT ${buggyPlayer} wybrał złą kartę lub zły kolor, to już ${currentGame[buggyPlayer].invalidMoves} raz!`
    );
    if (
      currentGame[buggyPlayer].invalidMoves >= CONFIG.invalidMovesMax &&
      waiters.gameCounted == undefined
    ) {
      for (const bot of Object.keys(processes)) {
        if (bot == 'server') continue;
        processes[bot].kill();
      }

      console.log(
        `[INFO] BOT ${buggyPlayer} wybrał zbyt dużo razy złą kartę lub zły kolor, traci punkt!`
      );

      const winners = Object.keys(currentGame).filter(
        (key) => key != buggyPlayer && key != 'name'
      );
      console.log('[DEBUG] winners', winners);
      for (const winner of winners) {
        if (winner == 'name') continue;
        currentGame[winner].wins++;
      }
      waiters.gameCounted = true;

      console.log('[BUGGED FINISH]');
      console.dir(currentGame, { depth: null });
      //process.exit(1);
    }
  }
};

const createServerProcess = (executable, ...params) => {
  const process = spawn(executable, [...params]);
  const name = basename(executable);
  process.stdout.on('data', (data) => {
    console.log(`(${name}) [INFO] ${data}`);
    processServerMessages(data);
  });

  process.stderr.on('data', (data) => {
    console.log(`(${name}) [EINFO] ${data}`);
    processServerMessages(data);
  });

  process.on('close', (code) => {
    console.log(`(${name}) [EXIT] CODE: ${code}`);
  });
  return process;
};

const main = async (binsToMake, rozgrywkaName, meczName) => {
  if (!players[rozgrywkaName]) players[rozgrywkaName] = [];
  currentGame = { name: meczName };
  await prepareBinaries(binsToMake);
  const server = binsToMake[0];
  processes.server = createServerProcess(`${server.workDir}/${server.name}`);

  await waitForVar('serverListen', 3000);

  for (let i = 0; i < CONFIG.numOfGames; i++) {
    console.log(
      `-------------------------- ROZPOCZYNAM GRĘ ${
        i + 1
      } --------------------------`
    );
    for (const [index, gracz] of binsToMake.entries()) {
      if (index == 0) continue;
      if (index == 1) {
        processes[gracz.name] = createClientProcess(gracz);
        if (!currentGame[gracz.name]) currentGame[gracz.name] = { wins: 0 };
        await waitForVar('gameID');
        continue;
      }
      processes[gracz.name] = createClientProcess(gracz, waiters.gameID);
      if (!currentGame[gracz.name]) currentGame[gracz.name] = { wins: 0 };
      if (index == binsToMake.length - 1) {
        waiters.gameID = undefined;
        continue;
      }
    }
    await waitForVar('gameCounted');
    waiters.gameCounted = undefined;
    console.log('[INFO SUMMARY]', currentGame);
    // Reset invalidMoves
    for (const [index, gracz] of binsToMake.entries()) {
      if (index == 0) continue;
      currentGame[gracz.name].invalidMoves = 0;
    }
  }
  players[rozgrywkaName].push(currentGame);
  currentGame = {};
  //console.log('[INFO FULL SUMMARY]', players);
  await sleep(100);
  processes.server.kill();
  console.log('[INFO] WAITING AFTER KILL');
};

(async () => {
  const rozgrywki = await loadRozgrywki();
  for (const rozgrywka of rozgrywki) {
    for (const mecz of rozgrywka.mecze) {
      let binsToMake = [CONFIG.turtleServer, ...mecz.boty];
      let meczName = '';
      for (const [index, bot] of mecz.boty.entries()) {
        if (index == mecz.boty.length - 1) meczName += `${bot.displayName}`;
        else meczName += `${bot.displayName} vs `;
      }
      await main(binsToMake, rozgrywka.name, meczName);
    }
  }
  console.log(`-------------------------- FINISH --------------------------`);
  console.dir(players, { depth: null });
  await fs.writeFile('WYNIKI.json', JSON.stringify(players, null, 2));
})();
