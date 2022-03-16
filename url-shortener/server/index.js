require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const autoIncrement = require("mongoose-auto-increment");
const urlRegexSafe = require("url-regex-safe");

const {
  env: { DB_URI, DB_NAME, PORT },
} = process;

mongoose.connect(
  DB_URI,
  { useNewUrlParser: true, useUnifiedTopology: true, dbName: DB_NAME },
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Connected successfully to ${DB_URI}/${DB_NAME}`);
    }
  }
);

autoIncrement.initialize(mongoose.connection);

const schema = new mongoose.Schema(
  {
    original_url: {
      type: String,
      required: true,
      validate: {
        validator(url) {
          return urlRegexSafe({ exact: true, strict: true }).test(url);
        },
        message: "invalid url",
      },
    },
    short_url: Number,
  },

  {
    toJSON: {
      transform(_, ret) {
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

schema.plugin(autoIncrement.plugin, { model: "Url", field: "short_url", startAt: 1 });

const Model = mongoose.model("Url", schema);

const app = express();
const router = express.Router();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", (_, res) => {
  res.sendFile(`${process.cwd()}/views/index.html`);
});

router.post("/", (req, res) => {
  const url = { original_url: req.body.url };

  Model.findOne(url, (_, doc) => {
    if (doc) {
      res.json(doc);
    } else {
      Model.create(url, (err, doc) => {
        if (err) {
          const { message: msg } = err;
          res.json({ error: msg.substring(msg.lastIndexOf(":") + 2) });
        } else {
          res.json(doc);
        }
      });
    }
  });
});

router.get("/:short_url", (req, res) => {
  Model.findOne({ short_url: +req.params.short_url }, (err, doc) => {
    if (err) {
      res.json({ error: err.message });
    } else if (!doc) {
      res.json({ error: "not found" });
    } else {
      res.redirect(doc.get("original_url"));
    }
  });
});

app.use("/api/shorturl", router);

const server = app.listen(PORT, "localhost", () => {
  const { address, port } = server.address();
  console.log(`App running on http://${address}:${port}`);
});
