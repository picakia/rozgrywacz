import { spawn } from 'child_process';
import { basename } from 'path';

let waiters = {
  serverListen: undefined,
  gameID: undefined,
  gameCounted: undefined,
};

let numOfGames = 1;

let binsToMake = [
  {
    name: 'turtleServer',
    workDir: '../turniej/gra_go',
    path: './serwer/main.go',
  },
  {
    name: 'greedybot',
    workDir: '../hackathon/gra_go',
    path: './klient/greedybot/main.go',
  },
  {
    name: 'random',
    workDir: '../hackathon/gra_go',
    path: './klient/random/main.go',
  },
];

let players = {};

const singleBin = (name, workDir, path) =>
  new Promise((resolve, reject) => {
    const process = spawn('go', ['build', '-C', workDir, '-o', name, path]);
    process.stdout.on('data', (data) => {
      console.log(`(${name}) [INFO] \n${data}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`(${name}) [ERROR] ${data}`);
    });

    process.on('close', (code) => {
      console.log(`(${name}) [BUILD FINISHED] CODE: ${code}`);
      if (code == 0) resolve(0);
      else reject(code);
    });
  });

const prepareBinaries = async () => {
  for (const binToMake of binsToMake) {
    await singleBin(binToMake.name, binToMake.workDir, binToMake.path);
  }
  return 0;
};

const waitForVar = (varName, ms = 1000) =>
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
  if (data.includes('server listening')) waiters.serverListen = true;
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
      players[graczName].numer = index + 1;
    }
    console.log('[INFO KOLEJNOSC]', players);
  }
  if (data.includes('"KtoWygral"')) {
    const stanLogLine = String(data)
      .split('\n')
      .find((item) => item.includes('"KtoWygral"'));
    //console.log('[INFO STAN]', stanLogLine);
    const json = JSON.parse(stanLogLine.split('stan: ')[1]);
    console.log('[INFO STAN]', json);
    const winner = Object.keys(players).find(
      (key) => players[key].numer == json.KtoWygral
    );
    players[winner].wins++;
    waiters.gameCounted = true;
  }
};

const processClientMessages = (data) => {
  if (data.includes('Nowa gra')) {
    waiters.gameID = String(data).split('"')[1];
  }
};

const createServerProcess = (executable, ...params) => {
  const process = spawn(executable, [...params]);
  const name = basename(executable);
  process.stdout.on('data', (data) => {
    console.log(`(${name}) [INFO] \n${data}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`(${name}) [ERROR] ${data}`);
    processServerMessages(data);
  });

  process.on('close', (code) => {
    console.log(`(${name}) [EXIT] CODE: ${code}`);
  });
};

const createClientProcess = (executable, ...params) => {
  const process = spawn(executable, [...params]);
  const name = basename(executable);
  process.stdout.on('data', (data) => {
    console.log(`(${name}) [INFO] \n${data}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`(${name}) [ERROR] ${data}`);
    processClientMessages(data);
  });

  process.on('close', (code) => {
    console.log(`(${name}) [EXIT] CODE: ${code}`);
  });
};

const main = async () => {
  await prepareBinaries();
  const server = binsToMake[0];
  createServerProcess(`${server.workDir}/${server.name}`);

  await waitForVar('serverListen', 3000);

  for (let i = 0; i < numOfGames; i++) {
    for (const [index, gracz] of binsToMake.entries()) {
      if (index == 0) continue;
      if (index == 1) {
        createClientProcess(
          `${gracz.workDir}/${gracz.name}`,
          '-nazwa',
          gracz.name,
          '-nowa'
        );
        players[gracz.name] = { wins: 0 };
        await waitForVar('gameID');
        continue;
      }
      createClientProcess(
        `${gracz.workDir}/${gracz.name}`,
        '-nazwa',
        gracz.name,
        '-gra',
        waiters.gameID
      );
      players[gracz.name] = { wins: 0 };
      if (index == binsToMake.length - 1) {
        waiters.gameID = undefined;
        continue;
      }
    }
    await waitForVar('gameCounted');
    waiters.gameCounted = undefined;
    console.log("[INFO SUMMARY]", players);
  }
};

(async () => {
  await main();
})();
