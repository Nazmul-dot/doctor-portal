require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_ACCOUNT);
const port = process.env.PORT || 8000;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const varifyBytoken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    // console.log(req.headers.authorization);
    const token = req.headers.authorization.split("Bearer ")[1];
    // console.log(token);
    const decodeduser = await admin.auth().verifyIdToken(token);
    // console.log(decodeduser);
    req.decoderEmail = decodeduser.email;
  }
  next();
};

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.iohnz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
async function run() {
  try {
    await client.connect();
    const database = client.db("doctor-portal");
    const appointment = database.collection("appointment");
    const userCollection = database.collection("users");
    console.log("db connected");

    // add appointment
    app.post("/appointment", async (req, res) => {
      const appoint = req.body;
      // console.log(app);
      const result = await appointment.insertOne(appoint);
      res.json(result);
    });

    //get appointment
    app.get("/appointment", varifyBytoken, async (req, res) => {
      if (req.decoderEmail) {
        const email = req.query.email;
        const date = new Date(req.query.date).toLocaleDateString();
        // console.log(date);
        const query = { email: email, date: date };
        const cursor = appointment.find(query);
        const result = await cursor.toArray();
        res.json(result);
      } else {
        res.status(401).json({ message: "user donot" });
      }
    });

    // cheak admin
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const result = await userCollection.findOne(filter);
      // console.log(result.Role);
      let isAdmin = false;
      if (result?.Role === "Admin") {
        isAdmin = true;
      }
      res.json({ Admin: isAdmin });
    });
    // ADD USER
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });
    app.put("/user", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          user,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    // add admin
    app.put("/user/admin", varifyBytoken, async (req, res) => {
      const requester = req.decoderEmail;
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount) {
          const filter = { email: req.body.email };
          const updateDoc = {
            $set: {
              Role: "Admin",
            },
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          console.log("admin add success");
          res.json(result);
        }
      } else {
        res.status(401).json({ message: "do not exiset this user" });
      }
    });
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello doctor portal!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
