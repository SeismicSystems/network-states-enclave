#!/bin/bash

: '
  In execution, this script is managed by PM2. On startup, pnpm dev is called.
  In case the enclave crashes, pnpm dev:recover is called.
'

if [ -f "encryption_key.txt" ]
then
    pnpm dev:recover
else
    touch encryption_key.txt
    pnpm dev
fi
