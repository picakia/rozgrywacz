import fs from 'node:fs/promises';
import CONFIG from './CONFIG.js';

const loadRozgrywki = async () => {
    const fileContent = await fs.readFile(CONFIG.rozgrywkiJSON, 'utf8');
    const loadedCases = JSON.parse(fileContent);
    return loadedCases;
};

export default loadRozgrywki;

