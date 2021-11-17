require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const fileupload = require("express-fileupload");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
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
app.use(fileupload());

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
    const doctorCollection = database.collection("doctors");
    console.log("db connected");

    // doctost add image proccecing
    app.post("/doctos", async (req, res) => {
      const name = req.body.name;
      const email = req.body.email;
      const pic = req.files.image;
      const picData = pic.data;
      const encodedPic = picData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");

      const doctor = {
        name,
        email,
        image: imageBuffer,
      };
      const result = await doctorCollection.insertOne(doctor);
      res.json(result);
    });
    //get doctors
    app.get("/doctos", async (req, res) => {
      const cursor = await doctorCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });
    // add appointment
    app.post("/appointment", async (req, res) => {
      const appoint = req.body;
      console.log(appoint);
      const result = await appointment.insertOne(appoint);
      console.log(result);
      res.json(result);
    });

    //get appoint per single
    app.get("/appointment/:id", async (req, res) => {
      const _id = req.params.id;
      console.log(_id);
      const query = { _id: ObjectId(_id) };
      const result = await appointment.findOne(query);
      res.json(result);
    });
    //update payment statement
    app.put("/appointment/payment/:id", async (req, res) => {
      const _id = req.params.id;
      const query = { _id: ObjectId(_id) };
      const payment = req.body;
      console.log(payment);
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };

      const result = await appointment.updateOne(query, updateDoc);
      console.log(result);
      res.json(result);
    });
    //get appointment
    app.get("/appointment", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();

      const query = { email: email, date: date };
      const cursor = appointment.find({ email: email, date: date });
      const result = await cursor.toArray();

      console.log(result);
      console.log(email, date);
      res.json(result);
      // if (req.decoderEmail) {
      //   const email = req.query.email;
      //   const date = new Date(req.query.date).toLocaleDateString();
      //   // console.log(date);
      //   const query = { email: email, date: date };
      //   const cursor = appointment.find(query);
      //   const result = await cursor.toArray();
      //   res.json(result);
      // } else {
      //   res.status(401).json({ message: "user donot" });
      // }
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

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
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
