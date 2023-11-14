#! /bin/bash

PTAU=$1

# virtual_cpp
circom virtual/virtual.circom --c --r1cs

# ./virtual
cd virtual_cpp
make
cd ..

# virtual.zkey
yarn run snarkjs groth16 setup virtual.r1cs \
                               $PTAU \
                               virtual.zkey

mv virtual.zkey virtual/
mv virtual_cpp/virtual virtual/

rm -rf virtual_cpp virtual_js virtual.r1cs

# ./virtual <input.json> <output.wtns>
# ./rapidsnark-prover <circuit.zkey> <witness.wtns> <proof.json> <public.json>