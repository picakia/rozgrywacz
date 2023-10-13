import { spawn } from 'child_process';
const singleGoBin = (name, workDir, path) =>
  new Promise((resolve, reject) => {
    const process = spawn('go', ['build', '-C', workDir, '-o', name, path]);
    process.stdout.on('data', (data) => {
      console.log(`(${name}) [INFO] ${data}`);
    });

    process.stderr.on('data', (data) => {
      console.log(`(${name}) [EINFO] ${data}`);
    });

    process.on('close', (code) => {
      console.log(`(${name}) [BUILD FINISHED] CODE: ${code}`);
      if (code == 0) resolve(0);
      else reject(code);
    });
  });

const prepareBinaries = async (binsToMake) => {
  for (const binToMake of binsToMake) {
    if (binToMake.lang == 'go')
      await singleGoBin(binToMake.name, binToMake.workDir, binToMake.path);
  }
  return 0;
};

export default prepareBinaries;
