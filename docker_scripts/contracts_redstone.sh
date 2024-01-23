. /root/.bashrc
foundryup

cd contracts
pnpm install
pnpm deploy:redstone
rm -rf node_modules