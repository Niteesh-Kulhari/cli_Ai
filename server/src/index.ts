import express from "express";

const app = express();

app.get("/health", (req, res) => {
  res.send("OK");
});

app.listen("3001", () => {
  console.log("Server is running on Port 3000");
});
