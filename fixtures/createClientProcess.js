import { spawn } from 'child_process';
const createClientProcess = (client, gameID) => {
  let exec = `${client.workDir}/${client.name}`;
  let args = ['-nazwa', client.name];
  if (gameID) args.push('-gra', gameID);
  else args.push('-nowa');
  if (client.moreArgs) {
    for (const arg of client.moreArgs) {
      args.push(arg);
    }
  }
  if (client.lang == 'node') {
    exec = 'node';
    args = [client.workDir, '--nazwa', client.name];
    if (gameID) args.push('--gra', `${gameID}`);
    else args.push('--nowa', 'true');
  }
  const process = spawn(exec, args);
  const name = client.name;
  process.stdout.on('data', (data) => {
    console.log(`(${name}) [INFO] ${data}`);
  });

  process.stderr.on('data', (data) => {
    console.log(`(${name}) [EINFO] ${data}`);
  });

  process.on('close', (code) => {
    console.log(`(${name}) [EXIT] CODE: ${code}`);
  });
  return process;
};

export default createClientProcess;
