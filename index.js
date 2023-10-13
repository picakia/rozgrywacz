import { spawn } from 'child_process';
import { basename } from 'path';
import fs from 'fs/promises';
import CONFIG from './fixtures/CONFIG.js';
import prepareBinaries from './fixtures/buildUtils.js';
import createClientProcess from './fixtures/createClientProcess.js';
import rozgrywki from './rozgrywki.json' assert { type: 'json' };

// count invalid card plays to stop the game
let invalidCounter = 0;

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

const processServerMessages = (data) => {
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
    const gracze = graczeLogLine
      .replaceAll('"', '')
      .replaceAll(' ', '')
      .split(/[1-5]\./)
      .slice(1);
    console.log(gracze);
    for (const [index, graczName] of gracze.entries()) {
      if (!currentGame[graczName]) currentGame[graczName] = {};
      currentGame[graczName].numer = index + 1;
    }
    console.log('[INFO KOLEJNOŚĆ]', currentGame);
  }
  // find kto Wygrał
  if (data.includes('"KtoWygral"')) {
    if (waiters.gameCounted == undefined) {
      const stanLogLine = String(data)
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
      );
      currentGame[winner].wins++;
      waiters.gameCounted = true;
    }
  }
  // find Invalid card
  if (data.includes('invalid card')) {
    if (invalidCounter == 6) {
      console.log('[INFO] BOT wybrał zbyt dużo razy złą kartę, traci punkt!');
      invalidCounter = 0;
      const buggyPlayer = String(data)
        .split('WykonajRuch(): ')[1]
        .split(/ wykonał| żąda/)[0];
      console.log('[DEBUG]', buggyPlayer);
      console.log('[BUGGED FINISH]');
      console.dir(players, { depth: null });
      processes[buggyPlayer].kill();
      process.exit(1);
    }
    invalidCounter++;
  }
  // find Invalid color
  if (data.includes('invalid color')) {
    if (invalidCounter == 6) {
      console.log('[INFO] BOT wybrał zbyt dużo razy zły kolor, traci punkt!');
      invalidCounter = 0;
      const buggyPlayer = String(data)
        .split('WykonajRuch(): ')[1]
        .split(/ wykonał| żąda/)[0];
      console.log('[DEBUG]', buggyPlayer);
      console.log('[BUGGED FINISH]');
      console.dir(players, { depth: null });
      processes[buggyPlayer].kill();
      process.exit(1);
    }
    invalidCounter++;
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
  }
  players[rozgrywkaName].push(currentGame);
  currentGame = {};
  //console.log('[INFO FULL SUMMARY]', players);
  await sleep(500);
  processes.server.kill();
};

(async () => {
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
