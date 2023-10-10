import express from "express";
import http from "http";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const app = express();
const server = http.createServer(app);

server.listen(process.env.DA_SERVER_PORT, async () => {
    console.log(
        `Server running on http://localhost:${process.env.DA_SERVER_PORT}`
    );
});
