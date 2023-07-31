use std::fmt;

#[derive(Debug)]
struct Player {
    symbol: char,
}

#[derive(Clone)]
struct Tile<'a> {
    owner: &'a Player,
    resources: u16,
}
impl<'a> fmt::Display for Tile<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.owner.symbol, self.resources)
    }
}

struct Grid<'a> {
    t: Vec<Vec<Tile<'a>>>,
}

impl<'a> fmt::Display for Grid<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for row in &self.t {
            for tile in row {
                write!(f, "{} ", tile)?;
            }
            write!(f, "\n")?;
        }
        Ok(())
    }
}

const PLAYER_A: Player = Player { symbol: 'A' };
const PLAYER_B: Player = Player { symbol: 'B' };
const PLAYER_C: Player = Player { symbol: 'C' };
const UNOWNED: Player = Player { symbol: 'X' };

const GRID_SIZE: usize = 5;
const START_RESOURCES: u16 = 9;

fn init_grid<'a>(
    sz: usize,
    resource: u16,
    unowned: &'a Player,
    player_a: &'a Player,
    player_b: &'a Player,
    player_c: &'a Player,
) -> Grid<'a> {
    let mut g = Grid {
        t: vec![
            vec![
                Tile {
                    owner: unowned,
                    resources: 0
                };
                sz
            ];
            sz
        ],
    };
    g.t[0][0] = Tile {
        owner: &player_a,
        resources: resource,
    };
    g.t[0][sz - 1] = Tile {
        owner: &player_b,
        resources: resource,
    };
    g.t[sz - 1][sz - 1] = Tile {
        owner: &player_c,
        resources: resource,
    };
    g
}

fn main() {
    let mut grid = init_grid(GRID_SIZE, START_RESOURCES, &UNOWNED, &PLAYER_A, &PLAYER_B, &PLAYER_C);
    println!("\n{}", grid);
}
