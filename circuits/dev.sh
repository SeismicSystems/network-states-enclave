#! /bin/bash

: '
  Boilerplate circuit compilation & smoke testing. Do not use in prod. Assumes
  naming convention: {$NAME/, $NAME/$NAME.circom, $NAME/${NAME}.func.json,
  and $NAME/${NAME}.smoke.json}. Outputs solidity verifier in 
  ../contracts/src and proving key in $NAME/.
'

NAME=$1
PTAU=$2
UPPER_NAME="$(tr '[:lower:]' '[:upper:]' <<< ${NAME:0:1})${NAME:1}"

# Compile circuit
circom ${NAME}/${NAME}.circom --r1cs --wasm

# Generate proving key
yarn run snarkjs groth16 setup ${NAME}.r1cs \
                               $PTAU \
                               ${NAME}.zkey

# Generate verifying key
yarn run snarkjs zkey export verificationkey ${NAME}.zkey \
                                             ${NAME}.vkey.json

# Compute witness, used as smoke test for circuit
mv ${NAME}_js/generate_witness.js ${NAME}_js/generate_witness.cjs
node ${NAME}_js/generate_witness.cjs \
     ${NAME}_js/${NAME}.wasm \
     ${NAME}/${NAME}.smoke.json \
     ${NAME}.wtns

# Export solidity verifier
yarn run snarkjs zkey export solidityverifier ${NAME}.zkey \
                                              ${NAME}Verifier.sol
sed -i -e 's/0.6.11;/0.8.13;/g' ${NAME}Verifier.sol
mv ${UPPER_NAME}Verifier.sol ../contracts/src

# Save proving key and witness generation script
mv ${NAME}_js/${NAME}.wasm ${NAME}.zkey ${NAME}/

# Clean up
rm -r ${NAME}Verifier.sol-e ${NAME}.vkey.json 
rm -r ${NAME}.wtns ${NAME}_js/ ${NAME}.r1cs
