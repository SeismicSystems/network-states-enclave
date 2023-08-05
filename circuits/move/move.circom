pragma circom 2.0.3;

template Main() {
    signal input a;
    signal input b;
    signal input c;

    a * b === c;
}

component main { public [ a, b, c ] } = Main();
