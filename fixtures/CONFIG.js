const CONFIG = {
  numOfGames: 5,
  defaultTimeout: 100,
  invalidMovesMax: 100,
  turtleServer: {
    name: 'turtleServer',
    workDir: '../turniej/gra_go',
    path: './serwer/main.go',
    lang: 'go',
  },
  rozgrywkiJSON: 'rozgrywkiExample.json',
};
export default CONFIG;
