// @ts-ignore
import { groth16 } from "snarkjs";
import { Groth16Proof, Utils } from "./Utils";
import { Player } from "./Player";
import { Tile, Location } from "./Tile";

export class Board {
    static MOVE_WASM: string = "../circuits/move/move.wasm";
    static MOVE_PROVKEY: string = "../circuits/move/move.zkey";
    static PERIMETER: number[][] = [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((y) => [x, y])
    );

    t: Tile[][];

    public constructor() {
        this.t = new Array<Array<Tile>>();
    }

    /*
     * Seed game board by sampling access key for each tile, updating on-chain
     * merkle tree along the way. Doesn't do any sampling if isInit flag is off.
     * With that setting, it only initializes board with mystery tiles.
     */
    public async seed(sz: number, isInit: boolean, nStates: any) {
        for (let i = 0; i < sz; i++) {
            let row: Tile[] = new Array<Tile>();
            for (let j = 0; j < sz; j++) {
                if (isInit) {
                    let tl: Tile = Tile.genUnowned({ r: i, c: j });
                    await nStates.set(tl.hash());
                    await Utils.sleep(200);
                    row.push(tl);
                } else {
                    row.push(Tile.mystery({ r: i, c: j }));
                }
            }
            this.t.push(row);
        }
    }

    /*
     * Check if a location = (row, col) pair is within the bounds of the board.
     */
    private inBounds(r: number, c: number): boolean {
        return r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0;
    }

    /*
     * Throws an error if a presented location isn't in bounds.
     */
    private assertBounds(l: Location) {
        if (!this.inBounds(l.r, l.c)) {
            throw new Error("Tried to edit tile out of bounds.");
        }
    }

    /*
     * Spawn Player at a Location. Used for development. Enclave only func.
     */
    public spawn(l: Location, pl: Player, resource: number) {
        this.assertBounds(l);

        let r = l.r,
            c = l.c;
        if (this.t[r][c].owner != Tile.UNOWNED) {
            throw new Error("Tried to spawn player on an owned tile.");
        }
        this.t[r][c] = Tile.genOwned(pl, { r: r, c: c }, resource);
    }

    /*
     * Displays colored gameboard. Local belief of what the gameboard is from 
     * the perspective of the client.
     */
    public printView(): void {
        for (let i = 0; i < this.t.length; i++) {
            for (let j = 0; j < this.t[0].length; j++) {
                let tl: Tile = this.getTile({ r: i, c: j });
                let color;
                const reset = "\x1b[0m";
                if (tl.owner.symbol === "A") {
                    color = "\x1b[32m";
                } else if (tl.owner.symbol === "B") {
                    color = "\x1b[31m";
                } else if (tl.owner.symbol === "C") {
                    color = "\x1b[44m";
                } else {
                    color = "\x1b[37m";
                }
                process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
            }
            process.stdout.write("\n");
        }
        process.stdout.write("---\n");
    }

    /*
     * Getter for Tile at a location.
     */
    public getTile(l: Location): Tile {
        this.assertBounds(l);
        return this.t[l.r][l.c];
    }

    /*
     * Set location to new Tile value. Enclave-only func.
     */
    public setTile(tl: Tile) {
        this.t[tl.loc.r][tl.loc.c] = tl;
    }

    /*
     * Check if a location is NOT in the FoW for requesting player. Enclave-only
     * func.
     */
    public noFog(l: Location, reqPlayer: Player): boolean {
        let r = l.r,
            c = l.c;
        let foundNeighbor = false;
        Board.PERIMETER.forEach(([dy, dx]) => {
            let nr = r + dy,
                nc = c + dx;
            if (
                this.inBounds(nr, nc) &&
                this.t[nr][nc].owner.bjjPub.equals(reqPlayer.bjjPub)
            ) {
                foundNeighbor = true;
            }
        });
        return foundNeighbor;
    }

    /*
     * Returns true if every Tile in this board instance is a Mystery. Only
     * happens when not player isn't spawned yet.
     */
    public noVisibility() {
        for (let i = 0; i < this.t.length; i++) {
            for (let j = 0; j < this.t[0].length; j++) {
                const tl: Tile = this.getTile({ r: i, c: j });
                if (!tl.isMystery()) {
                    return false;
                }
            }
        }
        return true;
    }

    /*
     * Computes proper state of tile an army is about to move onto. Goes through
     * game logic of what happens during a battle.
     */
    static computeOntoTile(
        tTo: Tile,
        tFrom: Tile,
        uFrom: Tile,
        nMobilize: number
    ): Tile {
        let uTo: Tile;
        if (tTo.owner === tFrom.owner) {
            uTo = Tile.genOwned(tTo.owner, tTo.loc, tTo.resources + nMobilize);
        } else {
            uTo = Tile.genOwned(tTo.owner, tTo.loc, tTo.resources - nMobilize);
            if (uTo.resources < 0) {
                uTo.owner = uFrom.owner;
                uTo.resources *= -1;
            }
        }
        return uTo;
    }

    /*
     * Generates state transition, nullifier combo, and ZKP needed to move 
     * troops from one tile to another.
     */
    public async constructMove(
        mRoot: BigInt,
        from: Location,
        to: Location,
        nMobilize: number
    ): Promise<[Tile, Tile, Tile, Tile, Groth16Proof]> {
        const tFrom: Tile = this.getTile(from);
        const tTo: Tile = this.getTile(to);
        const uFrom: Tile = Tile.genOwned(
            tFrom.owner,
            tFrom.loc,
            tFrom.resources - nMobilize
        );
        const uTo: Tile = Board.computeOntoTile(tTo, tFrom, uFrom, nMobilize);

        const { proof, _ } = await groth16.fullProve(
            {
                root: mRoot.toString(),
                hUFrom: uFrom.hash(),
                hUTo: uTo.hash(),
                rhoFrom: tFrom.nullifier(),
                rhoTo: tTo.nullifier(),
                tFrom: tFrom.toCircuitInput(),
                tTo: tTo.toCircuitInput(),
                uFrom: uFrom.toCircuitInput(),
                uTo: uTo.toCircuitInput(),
            },
            Board.MOVE_WASM,
            Board.MOVE_PROVKEY
        );
        return [tFrom, tTo, uFrom, uTo, proof];
    }
}
