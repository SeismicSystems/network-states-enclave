export default class Player {
  symbol: string;

  constructor(s_: string) {
    this.symbol = s_;
  }

  toString(): string {
    return `${this.symbol}`;
  }
}
