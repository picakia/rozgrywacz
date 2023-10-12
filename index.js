import { spawn } from 'child_process';
import { basename } from 'path';

let waiters = {
  serverListen: undefined,
  gameID: undefined,
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

const processData = (data) => {
  if (data.includes('server listening')) waiters.serverListen = true;
  if (data.includes('Nowa gra')) {
    waiters.gameID = String(data).split('"')[1];
  }
};

const createProcess = (executable, ...params) => {
  const process = spawn(executable, [...params]);
  const name = basename(executable);
  process.stdout.on('data', (data) => {
    console.log(`(${name}) [INFO] \n${data}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`(${name}) [ERROR] ${data}`);
    processData(data);
  });

  process.on('close', (code) => {
    console.log(`(${name}) [EXIT] CODE: ${code}`);
  });
};

const main = async () => {
  const server = createProcess('../turniej/gra_go/turtleServer');

  await waitForVar('serverListen', 3000);

  for (let i = 0; i < 2; i++) {
    const gracz1 = createProcess(
      '../hackathon/gra_go/gracz1',
      '-nazwa',
      'gracz1',
      '-nowa'
    );
    await waitForVar('gameID');

    const gracz2 = createProcess(
      '../hackathon/gra_go/gracz2',
      '-nazwa',
      'gracz2',
      '-gra',
      waiters.gameID
    );
    waiters.gameID = undefined
  }
};

(async () => {
  await main();
})();
