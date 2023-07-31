use std::fmt;

use num_bigint::{BigUint, RandomBits, ToBigUint};
use rand::{rngs::ThreadRng, Rng};

#[derive(Debug)]
struct Player {
    symbol: char,
}

#[derive(Clone)]
struct Tile<'a> {
    owner: &'a Player,
    resources: u16,
    key: BigUint,
}
impl<'a> fmt::Display for Tile<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "({}, {}, {})",
            self.owner.symbol,
            self.resources,
            self.key.clone() % 10.to_biguint().unwrap()
        )
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
const UNOWNED: Player = Player { symbol: '_' };

const GRID_SIZE: usize = 5;
const START_RESOURCES: u16 = 9;

fn init_grid<'a>(sz: usize, rng: &mut ThreadRng, unowned: &'a Player) -> Grid<'a> {
    Grid {
        t: (0..sz)
            .map(|_| {
                (0..sz)
                    .map(|_| Tile {
                        owner: unowned,
                        resources: 0,
                        key: rng.sample(RandomBits::new(256)),
                    })
                    .collect()
            })
            .collect(),
    }
}

fn main() {
    let mut rng = rand::thread_rng();
    let mut grid = init_grid(GRID_SIZE, &mut rng, &UNOWNED);
    println!("\n{}", grid);
}
