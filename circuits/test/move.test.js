import { createRequire } from 'module';

describe("move circuit", () => {
    let requireESM;

    beforeEach(async () => {
        requireESM = createRequire(import.meta.url);
        const { Player, Tile, Board, Location, Utils } = requireESM('../../game');
        
        // Your code setup using Player, Tile, Board, Location, Utils
    });

    afterEach(() => {
        jest.resetModules();
    });

    it("fails if either of the nullifiers are invalid", async () => {
        // Your test code here
    });
});