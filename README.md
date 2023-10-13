# Rozgrywacz

## Usage

* Enter bots in rozgrywki.json
* run `node index.js`

## Additional info

* Program expects source code of `turniej` to be in upper directory (or configurable in CONFIG.js)
* You can pass more params to your bot using "moreArgs" in json 

* SET lang to **goBin** when running from built binary and **go** when you want to build from source before rounds

## DEBUG
  /*
  {
    name: 'greedybot',
    workDir: '../hackathon/gra_go',
    path: './klient/greedybot/main.go',
    lang: 'go',
  },
  {
    name: 'greedybotv1',
    workDir: '../otherBots',
    lang: 'goBin',
  },
  {
    name: 'greedybotv3',
    workDir: '../otherBots',
    lang: 'goBin',
  },
  {
    name: 'AllInclusiveV2',
    workDir: '../otherBots',
    lang: 'goBin',
    moreArgs: ['-bot', 'botv2'],
  },
  {
    name: 'PedzaceZolwiePoTurecku',
    workDir: '../otherBots',
    lang: 'goBin',
  },
  {
    name: 'greedybotv1',
    workDir: '../otherBots',
    lang: 'goBin',
  },
  {
    name: 'random',
    workDir: '../hackathon/gra_go',
    path: './klient/random/main.go',
    lang: 'go',
  },
  {
    name: 'random',
    workDir: '../hackathon/gra_go',
    lang: 'goBin',
  },
  */
