import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

/*
 * Enclave's public-key for signature scheme. Used to verify that sender is
 * enclave and not malicious.
 */
let signingPubkey: string | undefined;

const app = express();

app.use(express.json());

app.post("/setPubkey", (req, res) => {
    if (signingPubkey == undefined) {
        signingPubkey = req.body.pubkey;
        console.log("pubkey: ", signingPubkey);
        res.send("Signing public key set");
    } else {
        res.send("Cannot reset signing public key");
    }
});

app.listen(process.env.DA_SERVER_PORT, async () => {
    console.log(
        `Server running on http://localhost:${process.env.DA_SERVER_PORT}`
    );
});
