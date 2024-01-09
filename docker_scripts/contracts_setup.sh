. /root/.bashrc
foundryup

. /usr/src/app/.env
cd circuits
yarn
mkdir artifacts
cd artifacts
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_17.ptau
cd ..
yarn dev
rm -rf node_modules
cd ..

cd contracts
pnpm install
pnpm build
cd ..
