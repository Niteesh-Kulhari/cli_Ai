import express from "express";
import dotenv from "dotenv";
import cors from "cors"; // Import the CORS middleware
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000", // Replace with your frontend's origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (req, res) => {
  res.send("OK");
});

app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return res.json(session);
});

app.get("/device", async (req, res) => {
  const user_code = req.query.user_code;
  res.redirect(`http://localhost:3000/device?user_code=${user_code}`);
});

app.listen(3001, () => {
  console.log("Server is running on Port 3001");
});
