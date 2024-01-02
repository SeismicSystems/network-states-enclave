rm -rf /usr/src/app/contracts/worlds.json

. /root/.bashrc
foundryup


pnpm -C contracts dev
