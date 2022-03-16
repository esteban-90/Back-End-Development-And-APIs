require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const moment = require("moment");

const {
  env: { DB_LOCAL_URI: DB_URI, PORT },
} = process;

const utils = {
  formatDate(date) {
    return moment(date).format("ddd MMM DD YYYY");
  },
  isValidDate(date) {
    return moment(date, "YYYY-MM-DD", true).isValid();
  },
  getDate(date) {
    return moment(date);
  },
};

const exercise = new mongoose.Schema(
  {
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, default: utils.getDate() },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { versionKey: false }
);

const user = new mongoose.Schema(
  {
    username: { type: String, required: true },
    log: [{ type: mongoose.Schema.Types.ObjectId, ref: "Exercise" }],
  },
  { versionKey: false }
);

const Exercise = mongoose.model("Exercise", exercise);
const User = mongoose.model("User", user);

const app = express();
const router = express.Router();

moment.suppressDeprecationWarnings = true;

mongoose.connect(
  DB_URI,
  { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false },
  (err) => {
    if (err) console.error(err);
    else console.log(`Connected successfully to ${DB_URI}`);
  }
);

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", (_, res) => {
  res.sendFile(`${process.cwd()}/views/index.html`);
});

router.get("/", (_, res, next) => {
  User.find({}, "-log", { lean: true }, (err, docs) => {
    if (docs) res.json(docs);
    else next(err.message);
  });
});

router.get("/:id/logs", (req, res, next) => {
  const {
    query: { from, to, limit },
  } = req;

  const { isValidDate: check } = utils;

  let match = { date: {} };

  if (check(from)) match.date["$gte"] = from;
  if (check(to)) match.date["$lte"] = to;
  if (!check(from) && !check(to)) match = undefined;

  User.findById(
    req.params.id,
    null,
    {
      populate: {
        path: "log",
        select: "-userId -_id",
        match,
        options: { limit: +limit },
      },
      lean: true,
    },
    (err, doc) => {
      if (doc) {
        const { username, _id, log } = doc;
        const { formatDate } = utils;

        const data = {
          username,
          count: log.length,
          _id,
          log: log.map(({ date, ...rest }) => ({
            ...rest,
            date: formatDate(date),
          })),
        };

        res.json(data);
      } else {
        next(err?.message ?? "user not found");
      }
    }
  );
});

router.post("/", (req, res, next) => {
  User.create({ username: req.body.username }, (err, doc) => {
    if (doc) {
      const data = { username: doc.username, _id: doc._id };
      res.json(data);
    } else {
      next(err.message);
    }
  });
});

router.post("/:id/exercises", (req, res, next) => {
  const {
    params: { id },
  } = req;

  User.exists({ _id: id }, (err, doc) => {
    if (doc) {
      const {
        body: { description, duration, date },
      } = req;

      const { isValidDate, getDate } = utils;

      const data = {
        description,
        duration: parseInt(duration),
        date: isValidDate(date) ? getDate(date) : undefined,
        userId: id,
      };

      Exercise.create(data, (err, doc) => {
        if (doc) {
          User.findByIdAndUpdate(
            doc.userId,
            { $push: { log: doc._id } },
            { new: true, populate: { path: "log", select: "-userId -_id" }, lean: true },
            (err, doc) => {
              if (doc) {
                const { username, _id, log } = doc;
                const { date, ...rest } = log.at(-1);
                const { formatDate } = utils;

                const data = {
                  username,
                  ...rest,
                  date: formatDate(date),
                  _id,
                };

                res.json(data);
              } else {
                next(err.message);
              }
            }
          );
        } else {
          next(err.message);
        }
      });
    } else {
      next(err?.message ?? "user not found");
    }
  });
});

app.use("/api/users", router);

const server = app.listen(PORT, "localhost", () => {
  const { address, port } = server.address();
  console.log(`App running on http://${address}:${port}`);
});
