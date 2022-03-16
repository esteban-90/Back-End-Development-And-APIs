require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const port = process.env.PORT;

const app = express();

app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", (_, res) => {
  res.sendFile(`${process.cwd()}/views/index.html`);
});

app.post("/api/fileanalyse", multer().single("upfile"), (req, res) => {
  const {
    file: { originalname, mimetype, size },
  } = req;

  const data = { name: originalname, type: mimetype, size };

  res.json(data);
});

app.listen(port, () => {
  console.log(`Your app is listening on port ${port}`);
});
