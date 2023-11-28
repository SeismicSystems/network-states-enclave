#! /bin/bash

ARCH=$1
PTAU=$2

# virtual_cpp
circom virtual/virtual.circom --c --r1cs

# Generate witness generator
awk '/#include/ {print; next} !p {print "namespace CIRCUIT_NAME {\n"; p=1} {print} END {print "\n}"}' virtual_cpp/virtual.cpp >temp && mv temp virtual_cpp/virtual.cpp

# If necessary, clone circom_c_witness_generator
if [ ! -d "circom_c_witness_generator" ]; then
  git clone https://github.com/bajpai244/circom_c_witness_generator.git
fi
cd circom_c_witness_generator

./witness_generator.sh $ARCH ../virtual_cpp/virtual.cpp ../virtual_cpp/virtual.dat
mv wtns_build/circuit ../virtual/virtual-witness-generator
mv ../virtual_cpp/virtual.dat ../virtual/virtual-witness-generator.dat
cd ..

# virtual.zkey
yarn run snarkjs groth16 setup virtual.r1cs \
  $PTAU \
  virtual.zkey

# Export solidity verifier
yarn run snarkjs zkey export solidityverifier virtual.zkey \
  VirtualVerifier.sol
sed -i -e 's/0.6.11;/0.8.13;/g' VirtualVerifier.sol
mv VirtualVerifier.sol ../contracts/src

rm -rf virtual.r1cs virtual_cpp VirtualVerifier.sol-e
mv virtual.zkey virtual

# If necessary, clone and compile rapidsnark
if [ ! -d "../virtual/virtual-prover" ]; then
  git clone https://github.com/iden3/rapidsnark.git

  cd rapidsnark
  git submodule init
  git submodule update

  if [ "$ARCH" = "x86_64" ]; then
    ./build_gmp.sh host
    mkdir build_prover && cd build_prover
    cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package
    make -j4 && make install
  elif [ "$ARCH" = "arm64" ]; then
    ./build_gmp.sh macos_arm64
    mkdir build_prover_macos_arm64 && cd build_prover_macos_arm64
    cmake .. -DTARGET_PLATFORM=macos_arm64 -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package_macos_arm64
    make -j4 && make install
  fi

  mv ../package_macos_arm64/bin/prover ../../virtual/virtual-prover
fi
