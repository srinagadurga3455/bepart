const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());


// ==================================================
// RAZORPAY WEBHOOK
// IMPORTANT: This must come BEFORE express.json()
// ==================================================

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      console.log("Razorpay webhook received");

      const signature = req.headers["x-razorpay-signature"];

      const expectedSignature = crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_WEBHOOK_SECRET
        )
        .update(req.body)
        .digest("hex");

      // Verify Razorpay signature
      if (signature !== expectedSignature) {
        console.log("Invalid webhook signature");

        return res.status(400).json({
          error: "Invalid webhook signature",
        });
      }

      // Convert raw body into JSON
      const event = JSON.parse(req.body.toString());

      console.log("Webhook event:", event.event);

      // Handle successful payment
      if (event.event === "order.paid") {
        const order = event.payload.order.entity;
        const payment = event.payload.payment.entity;

        console.log("Order ID:", order.id);
        console.log("Payment ID:", payment.id);
        console.log("Amount:", payment.amount);

        // TODO:
        // Update your database here
      }

      res.status(200).json({
        received: true,
      });

    } catch (error) {
      console.error("Webhook error:", error);

      res.status(500).json({
        error: "Webhook processing failed",
      });
    }
  }
);


// ==================================================
// NORMAL JSON REQUESTS
// ==================================================

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


// ==================================================
// CREATE RAZORPAY ORDER
// ==================================================

app.post("/order", async (req, res) => {
  try {

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const options = {
      amount: req.body.amount,
      currency: req.body.currency,
      receipt: req.body.receipt,
    };

    const order = await razorpay.orders.create(options);

    console.log("Order created:", order);

    res.json(order);

  } catch (error) {

    console.error("Order creation error:", error);

    res.status(500).json({
      error: "Failed to create Razorpay order",
    });
  }
});


// ==================================================
// VERIFY RAZORPAY PAYMENT
// ==================================================

app.post("/order/validate", async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    console.log("Order ID:", razorpay_order_id);
    console.log("Payment ID:", razorpay_payment_id);
    console.log("Received Signature:", razorpay_signature);

    const sha = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_SECRET
    );

    sha.update(
      `${razorpay_order_id}|${razorpay_payment_id}`
    );

    const digest = sha.digest("hex");

    console.log("Generated Signature:", digest);

    if (digest !== razorpay_signature) {

      return res.status(400).json({
        msg: "Transaction is not legit!",
      });

    }

    console.log("Payment verified successfully");

    res.json({
      msg: "success",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

  } catch (error) {

    console.error("Validation error:", error);

    res.status(500).json({
      msg: "Payment verification failed",
    });
  }
});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});